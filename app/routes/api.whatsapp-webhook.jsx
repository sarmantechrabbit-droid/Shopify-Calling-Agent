/**
 * WhatsApp Webhook Route
 *
 * POST /api/whatsapp-webhook
 *
 * Receives incoming WhatsApp replies from Twilio.
 * Maps customer replies to order intents and updates the order/callLog accordingly.
 *
 * Expected Twilio webhook body (x-www-form-urlencoded):
 *   - Body: the text the customer replied with
 *   - From: whatsapp:+91XXXXXXXXXX
 *   - To: whatsapp:+1XXXXXXXXXX
 *   - MessageSid: unique message ID
 */

import prisma from "../db.server.js";
import {
  CALL_INTENT,
  CALL_STATUS,
  ORDER_STATUS,
  handleCallResult,
  getLatestOpenCallLogByPhone,
} from "../services/orderCallService.server.js";

/**
 * Normalize the incoming phone number from Twilio's "whatsapp:+91XXXXXXXXXX" format
 * to a plain E.164 number "+91XXXXXXXXXX".
 */
function normalizeWhatsAppPhone(from) {
  if (!from) return null;
  return String(from).replace(/^whatsapp:/i, "").trim();
}

/**
 * Map the customer's WhatsApp reply to a CALL_INTENT.
 *
 * Supports:
 *   "1" or "yes"  → CONFIRM
 *   "2" or "no"   → CANCEL
 *   "3"           → WRONG_NUMBER
 *
 * Returns null if the reply cannot be mapped.
 */
function mapReplyToIntent(body) {
  if (!body || typeof body !== "string") return null;

  const text = body.trim().toLowerCase();

  // Exact number matches
  if (text === "1") return CALL_INTENT.CONFIRM;
  if (text === "2") return CALL_INTENT.CANCEL;
  if (text === "3") return CALL_INTENT.WRONG_NUMBER;

  // Keyword matches
  if (text === "yes" || text === "confirm" || text === "haan" || text === "ha") {
    return CALL_INTENT.CONFIRM;
  }
  if (text === "no" || text === "cancel" || text === "nahi" || text === "nako") {
    return CALL_INTENT.CANCEL;
  }

  return null;
}

function logWA(event, payload) {
  console.log(`[WhatsAppWebhook] ${event} ${JSON.stringify(payload)}`);
}

export async function action({ request }) {
  const logId = Math.random().toString(36).substring(7);
  console.log(`\n[WhatsAppWebhook][${logId}] 📥 INCOMING WHATSAPP MESSAGE`);

  let body;
  try {
    // Twilio sends application/x-www-form-urlencoded
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData);
    }
  } catch (err) {
    console.error(`[WhatsAppWebhook][${logId}] Failed to parse body:`, err.message);
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const messageBody = body?.Body || body?.body || "";
  const fromRaw = body?.From || body?.from || "";
  const messageSid = body?.MessageSid || body?.messageSid || "";

  const phoneNumber = normalizeWhatsAppPhone(fromRaw);

  logWA("RECEIVED", { logId, messageSid, from: fromRaw, phoneNumber, body: messageBody });

  if (!phoneNumber) {
    logWA("IGNORED_NO_PHONE", { logId });
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // ── Map the reply to an intent ──
  const intent = mapReplyToIntent(messageBody);

  if (!intent) {
    logWA("IGNORED_UNKNOWN_REPLY", { logId, messageBody });
    // Reply with a help message
    const helpMessage =
      `Sorry, we didn't understand your reply.\n\n` +
      `Please reply:\n` +
      `1 - YES (Confirm)\n` +
      `2 - NO (Cancel)\n` +
      `3 - I did not place this order`;
    return new Response(
      `<Response><Message>${helpMessage}</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  // ── Find the latest open callLog for this phone number ──
  const callLog = await getLatestOpenCallLogByPhone(phoneNumber);

  if (!callLog) {
    logWA("NO_OPEN_CALLLOG", { logId, phoneNumber });
    return new Response(
      `<Response><Message>No pending order found for your number.</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  // ── Guard: order already in terminal state ──
  if (
    callLog.order &&
    (callLog.order.orderStatus === ORDER_STATUS.CONFIRMED ||
      callLog.order.orderStatus === ORDER_STATUS.CANCELLED ||
      callLog.order.orderStatus === ORDER_STATUS.INVALID)
  ) {
    logWA("IGNORED_ALREADY_TERMINAL", {
      logId,
      orderId: callLog.orderId,
      callLogId: callLog.id,
      orderStatus: callLog.order.orderStatus,
    });
    return new Response(
      `<Response><Message>This order has already been processed. No further action needed.</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  // ── Guard: duplicate webhook (whatsappRepliedAt already set) ──
  if (callLog.whatsappRepliedAt) {
    logWA("IGNORED_DUPLICATE", {
      logId,
      callLogId: callLog.id,
      whatsappRepliedAt: callLog.whatsappRepliedAt,
    });
    return new Response(
      `<Response><Message>Your response has already been recorded. Thank you!</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  // ── Process the reply ──
  try {
    const result = await handleCallResult(callLog.orderId, intent, {
      callLogId: callLog.id,
      failureReason: "Confirmed via WhatsApp",
      fromWhatsApp: true,
    });

    // Update whatsappRepliedAt timestamp and mark as replied
    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        whatsappRepliedAt: new Date(),
        whatsappReplied: true,
      },
    });

    logWA("PROCESSED", {
      logId,
      orderId: callLog.orderId,
      callLogId: callLog.id,
      intent,
      result,
    });

    // Build confirmation reply
    let replyMessage;
    if (intent === CALL_INTENT.CONFIRM) {
      replyMessage = `✅ Your Order #${callLog.order?.shopifyOrderId || ""} has been CONFIRMED. Thank you!`;
    } else if (intent === CALL_INTENT.CANCEL) {
      replyMessage = `❌ Your Order #${callLog.order?.shopifyOrderId || ""} has been CANCELLED.`;
    } else if (intent === CALL_INTENT.WRONG_NUMBER) {
      replyMessage = `⚠️ We've noted this was not your order. Sorry for the inconvenience.`;
    } else {
      replyMessage = `Your response has been recorded. Thank you!`;
    }

    return new Response(
      `<Response><Message>${replyMessage}</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  } catch (err) {
    console.error(`[WhatsAppWebhook][${logId}] Error processing reply:`, err);
    return new Response(
      `<Response><Message>Something went wrong. Please try again later.</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }
}

/**
 * GET handler — health check for the webhook endpoint.
 */
export async function loader() {
  return Response.json({
    status: "WhatsApp Webhook Active",
    time: new Date().toISOString(),
  });
}
