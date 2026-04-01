/**
 * Reminder Service
 *
 * Periodically checks for unreplied WhatsApp messages and sends a second
 * reminder after 1 minute of no customer response.
 *
 * After the second reminder, if the customer still doesn't reply within
 * FINAL_TIMEOUT_MS, the order is escalated to PENDING_MANUAL_REVIEW
 * and the callLog status changes to FAILED.
 *
 * Uses setInterval (10s) — NOT cron.
 * Uses a global singleton guard to prevent duplicate intervals under Vite HMR.
 */

import prisma from "../db.server.js";
import twilio from "twilio";

// ── Configuration ─────────────────────────────────────────────────────────────
const REMINDER_CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds
const REMINDER_DELAY_MS = 60_000;          // Send reminder after 1 minute
const FINAL_TIMEOUT_MS = 5 * 60_000;       // Escalate 5 mins after second reminder
const REMINDER_MESSAGE = "Reminder: Please confirm your order by replying YES or NO.";

// ── Twilio Helpers ────────────────────────────────────────────────────────────

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("[Reminder] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in env");
  }

  return twilio(accountSid, authToken);
}

function getWhatsAppFrom() {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    throw new Error("[Reminder] Missing TWILIO_WHATSAPP_FROM in env");
  }
  return from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
}

function formatWhatsAppNumber(phoneNumber) {
  if (!phoneNumber) throw new Error("[Reminder] Missing phoneNumber");
  return phoneNumber.startsWith("whatsapp:") ? phoneNumber : `whatsapp:${phoneNumber}`;
}

// ── Core: Send Reminder ───────────────────────────────────────────────────────

/**
 * Send a second WhatsApp reminder message for a given callLog.
 *
 * @param {object} callLog - Must include the `order` relation
 */
async function sendReminder(callLog) {
  const client = getTwilioClient();
  const from = getWhatsAppFrom();
  const to = formatWhatsAppNumber(callLog.order.phoneNumber);

  const { order } = callLog;
  const body = 
    `Reminder for ${order.customerName}:\n` +
    `Order ID: ${order.shopifyOrderId}\n` +
    `Total: ₹${order.totalPrice}\n` +
    (order.address ? `Address: ${order.address}\n\n` : "\n") +
    `Please confirm your order by replying YES or NO.`;

  console.log(
    `[Reminder] Sending second reminder to ${to} for orderId=${order.id} callLogId=${callLog.id}`
  );

  try {
    const message = await client.messages.create({
      from,
      to,
      body,
    });

    console.log(`[Reminder] ✅ Reminder sent SID=${message.sid} to=${to}`);
    return message;
  } catch (err) {
    console.error(`[Reminder] ❌ Failed to send reminder to ${to}:`, err.message);
    throw err;
  }
}

// ── Core: Check & Send Reminders ──────────────────────────────────────────────

/**
 * Query the database for unreplied WhatsApp messages older than 1 minute
 * and send a second reminder for each.
 */
async function checkAndSendReminders() {
  try {
    const cutoff = new Date(Date.now() - REMINDER_DELAY_MS);

    // Find all callLogs where:
    //   - WhatsApp was sent (whatsappSentAt is set)
    //   - Customer has NOT replied (whatsappReplied = false)
    //   - Second reminder has NOT been sent yet (secondReminderSent = false)
    //   - At least 1 minute has passed since the first WhatsApp (whatsappSentAt <= cutoff)
    //   - Status is WHATSAPP_SENT (still waiting for reply)
    const pendingReminders = await prisma.callLog.findMany({
      where: {
        status: "WHATSAPP_SENT",
        whatsappSentAt: { lte: cutoff },
        whatsappReplied: false,
        secondReminderSent: false,
      },
      include: { order: true },
    });

    const config = await prisma.appConfig.findFirst({ where: { shop: "default" } });
    if (config && config.waAutoConfirm === false) return;

    if (pendingReminders.length === 0) return;

    console.log(
      `[Reminder] Found ${pendingReminders.length} unreplied WhatsApp message(s) — sending reminders...`
    );

    for (const callLog of pendingReminders) {
      if (!callLog.order) {
        console.warn(`[Reminder] callLog ${callLog.id} has no order relation — skipping`);
        continue;
      }

      // Double-check: skip if order is already in a terminal state
      if (
        callLog.order.orderStatus === "CONFIRMED" ||
        callLog.order.orderStatus === "CANCELLED" ||
        callLog.order.orderStatus === "INVALID"
      ) {
        console.log(
          `[Reminder] Order ${callLog.order.id} already in terminal state (${callLog.order.orderStatus}) — marking secondReminderSent to avoid future checks`
        );
        await prisma.callLog.update({
          where: { id: callLog.id },
          data: { secondReminderSent: true },
        });
        continue;
      }

      try {
        // Send the reminder
        await sendReminder(callLog);

        // Mark as sent so we don't send it again
        await prisma.callLog.update({
          where: { id: callLog.id },
          data: { secondReminderSent: true },
        });

        console.log(`[Reminder] ✅ Marked secondReminderSent=true for callLogId=${callLog.id}`);
      } catch (err) {
        // Log but don't crash — the next cycle will retry
        console.error(
          `[Reminder] ❌ Error processing reminder for callLogId=${callLog.id}:`,
          err.message
        );
      }
    }
  } catch (err) {
    console.error("[Reminder] ❌ Global reminder check failed:", err.message);
  }
}

// ── Core: Escalate timed-out WhatsApp orders ──────────────────────────────────

/**
 * After the second reminder has been sent and FINAL_TIMEOUT_MS has passed
 * with no customer reply, escalate:
 *   - callLog.status  →  FAILED
 *   - order.orderStatus  →  PENDING_MANUAL_REVIEW
 *
 * This prevents orders from being stuck forever in WHATSAPP_SENT status.
 */
async function escalateTimedOutWhatsApp() {
  try {
    const cutoff = new Date(Date.now() - FINAL_TIMEOUT_MS);

    // Call logs where:
    //   - Status is still WHATSAPP_SENT
    //   - Second reminder WAS already sent
    //   - Customer still hasn't replied
    //   - Enough time has passed since the WhatsApp was first sent
    const timedOut = await prisma.callLog.findMany({
      where: {
        status: "WHATSAPP_SENT",
        secondReminderSent: true,
        whatsappReplied: false,
        whatsappSentAt: { lte: cutoff },
      },
      include: { order: true },
    });

    if (timedOut.length === 0) return;

    console.log(
      `[Reminder] ⏰ Found ${timedOut.length} timed-out WhatsApp order(s) — escalating to PENDING_MANUAL_REVIEW...`
    );

    for (const callLog of timedOut) {
      try {
        // Skip if order is already in a terminal state
        if (
          callLog.order &&
          (callLog.order.orderStatus === "CONFIRMED" ||
           callLog.order.orderStatus === "CANCELLED" ||
           callLog.order.orderStatus === "INVALID")
        ) {
          // Just fix the callLog status to FAILED so it's not stuck
          await prisma.callLog.update({
            where: { id: callLog.id },
            data: { status: "FAILED" },
          });
          console.log(
            `[Reminder] Order ${callLog.order?.id} already terminal (${callLog.order?.orderStatus}) — marked callLog ${callLog.id} as FAILED`
          );
          continue;
        }

        // Escalate: update both callLog and order
        await prisma.$transaction([
          prisma.callLog.update({
            where: { id: callLog.id },
            data: {
              status: "FAILED",
              failureReason: "No WhatsApp reply after second reminder",
            },
          }),
          prisma.order.update({
            where: { id: callLog.orderId },
            data: { orderStatus: "PENDING_MANUAL_REVIEW" },
          }),
        ]);

        console.log(
          `[Reminder] ⏰ Escalated callLogId=${callLog.id} orderId=${callLog.orderId} → status=FAILED, orderStatus=PENDING_MANUAL_REVIEW`
        );
      } catch (err) {
        console.error(
          `[Reminder] ❌ Error escalating callLogId=${callLog.id}:`,
          err.message
        );
      }
    }
  } catch (err) {
    console.error("[Reminder] ❌ Global escalation check failed:", err.message);
  }
}

// ── Boot: Start Reminder Interval ─────────────────────────────────────────────

// eslint-disable-next-line no-undef
const g = global;

/**
 * Start the reminder polling interval.
 * Uses a global singleton guard to prevent duplicate intervals under Vite HMR.
 */
export function startReminderService() {
  // Clear any existing interval (hot reload safe)
  if (g.__aiAgentReminderIntervalId) {
    clearInterval(g.__aiAgentReminderIntervalId);
  }

  console.log(
    `[Reminder] 🚀 Reminder service started (checking every ${REMINDER_CHECK_INTERVAL_MS / 1000}s, ` +
    `reminder delay: ${REMINDER_DELAY_MS / 1000}s, ` +
    `final timeout: ${FINAL_TIMEOUT_MS / 1000}s)`
  );

  // Combined check: send reminders + escalate timed-out orders
  async function runChecks() {
    await checkAndSendReminders();
    await escalateTimedOutWhatsApp();
  }

  // Run once immediately, then on interval
  runChecks();
  g.__aiAgentReminderIntervalId = setInterval(runChecks, REMINDER_CHECK_INTERVAL_MS);
}
