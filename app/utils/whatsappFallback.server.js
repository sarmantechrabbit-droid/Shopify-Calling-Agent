/**
 * WhatsApp Fallback Utility
 *
 * Sends a WhatsApp message via Twilio after 3 failed call attempts.
 * The customer can reply with 1/2/3 to confirm, cancel, or report wrong number.
 *
 * Reads Twilio credentials from AppConfig DB first, falls back to env vars.
 */

import twilio from "twilio";
import prisma from "../db.server.js";

async function getDbConfig() {
  try {
    return await prisma.appConfig.findFirst({ where: { shop: "default" } });
  } catch (_) {
    return null;
  }
}

async function getTwilioClient() {
  const dbConfig = await getDbConfig();
  const accountSid = dbConfig?.twilioSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = dbConfig?.twilioToken || process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("[WhatsApp] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in env or DB config");
  }

  return twilio(accountSid, authToken);
}

async function getWhatsAppFrom() {
  const dbConfig = await getDbConfig();
  const from = dbConfig?.twilioWaFrom || process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    throw new Error("[WhatsApp] Missing TWILIO_WHATSAPP_FROM in env or DB config");
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
function buildMessageBody(customerName, orderId, totalPrice, address) {
  return (
    `Hello ${customerName}, thank you for your order!\n\n` +
    `Order ID: ${orderId}\n` +
    `Total: ₹${totalPrice}\n` +
    (address ? `Address: ${address}\n\n` : "\n") +
    `Please confirm your order by replying:\n` +
    `YES to confirm ✅\n` +
    `NO to cancel ❌`
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
  const client = await getTwilioClient();
  const from = await getWhatsAppFrom();
  const to = formatWhatsAppNumber(order.phoneNumber);

  const body = buildMessageBody(
    order.customerName,
    order.shopifyOrderId,
    order.totalPrice,
    order.address,
  );

  console.log(`[WhatsApp] Body for to=${to}: ${body}`);

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
