/**
 * WhatsApp Fallback Utility
 *
 * Sends a WhatsApp message via Twilio after 3 failed call attempts.
 * The customer can reply with 1/2/3 to confirm, cancel, or report wrong number.
 */

import twilio from "twilio";

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("[WhatsApp] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in env");
  }

  return twilio(accountSid, authToken);
}

function getWhatsAppFrom() {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    throw new Error("[WhatsApp] Missing TWILIO_WHATSAPP_FROM in env (e.g. whatsapp:+14155238886)");
  }
  // Ensure the "whatsapp:" prefix is present
  return from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
}

function formatWhatsAppNumber(phoneNumber) {
  // Ensure the "whatsapp:" prefix is present on the destination number
  if (!phoneNumber) throw new Error("[WhatsApp] Missing phoneNumber");
  return phoneNumber.startsWith("whatsapp:") ? phoneNumber : `whatsapp:${phoneNumber}`;
}

/**
 * Build the WhatsApp fallback message body.
 */
function buildMessageBody(customerName, orderId, totalPrice) {
  return (
    `Hi ${customerName},\n` +
    `You placed Order #${orderId} worth ₹${totalPrice}.\n\n` +
    `Please reply:\n` +
    `1 - YES (Confirm)\n` +
    `2 - NO (Cancel)\n` +
    `3 - I did not place this order`
  );
}

/**
 * Send the WhatsApp fallback message for a given callLog.
 *
 * @param {object} callLog - The CallLog record (must include `order` relation)
 * @returns {object} Twilio message SID and metadata
 */
export async function sendWhatsAppFallback(callLog) {
  if (!callLog?.order) {
    throw new Error("[WhatsApp] callLog must include order relation");
  }

  const { order } = callLog;
  const client = getTwilioClient();
  const from = getWhatsAppFrom();
  const to = formatWhatsAppNumber(order.phoneNumber);

  const body = buildMessageBody(
    order.customerName,
    order.shopifyOrderId,
    order.totalPrice,
  );

  console.log(`[WhatsApp] Sending fallback to ${to} for orderId=${order.id} callLogId=${callLog.id}`);

  try {
    const message = await client.messages.create({
      from,
      to,
      body,
    });

    console.log(`[WhatsApp] ✅ Message sent SID=${message.sid} to=${to}`);

    return {
      sid: message.sid,
      to,
      status: message.status,
    };
  } catch (err) {
    console.error(`[WhatsApp] ❌ Failed to send message to ${to}:`, err.message);
    throw err;
  }
}
