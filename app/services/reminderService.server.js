/**
 * Reminder Service
 *
 * Periodically checks for unreplied WhatsApp messages and sends a second
 * reminder after 1 minute of no customer response.
 *
 * Uses setInterval (10s) — NOT cron.
 * Uses a global singleton guard to prevent duplicate intervals under Vite HMR.
 */

import prisma from "../db.server.js";
import twilio from "twilio";

// ── Configuration ─────────────────────────────────────────────────────────────
const REMINDER_CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds
const REMINDER_DELAY_MS = 60_000;          // Send reminder after 1 minute
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

  console.log(
    `[Reminder] Sending second reminder to ${to} for orderId=${callLog.order.id} callLogId=${callLog.id}`
  );

  try {
    const message = await client.messages.create({
      from,
      to,
      body: REMINDER_MESSAGE,
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
    `reminder delay: ${REMINDER_DELAY_MS / 1000}s)`
  );

  // Run once immediately, then on interval
  checkAndSendReminders();
  g.__aiAgentReminderIntervalId = setInterval(checkAndSendReminders, REMINDER_CHECK_INTERVAL_MS);
}
