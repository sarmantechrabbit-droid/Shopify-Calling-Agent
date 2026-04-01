/**
 * WhatsApp Test API
 *
 * POST /api/whatsapp-test
 *   intent: "check-connection" — verifies Twilio credentials are valid
 *   intent: "send-test"        — sends a test WhatsApp message
 */

import twilio from "twilio";

export const action = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { intent, twilioSid, twilioToken, twilioWaFrom } = body;

  /* ── Check Connection ─────────────────────────────────────── */
  if (intent === "check-connection") {
    if (!twilioSid || !twilioToken) {
      return Response.json({
        connected: false,
        error: "Missing Account SID or Auth Token",
      });
    }

    try {
      const client = twilio(twilioSid, twilioToken);
      // Fetch the account info — this verifies credentials
      const account = await client.api.accounts(twilioSid).fetch();

      console.log(
        `[WhatsApp-Test] ✅ Twilio connected: ${account.friendlyName} (${account.status})`,
      );

      return Response.json({
        connected: true,
        accountName: account.friendlyName,
        accountStatus: account.status,
      });
    } catch (err) {
      console.error("[WhatsApp-Test] ❌ Connection check failed:", err.message);

      let errorMsg = "Invalid credentials";
      if (err.code === 20003) errorMsg = "Invalid Account SID or Auth Token";
      else if (err.code === 20404) errorMsg = "Account not found";
      else if (err.message?.includes("ENOTFOUND"))
        errorMsg = "Network error — cannot reach Twilio";
      else errorMsg = err.message;

      return Response.json({ connected: false, error: errorMsg });
    }
  }

  /* ── Send Test Message ────────────────────────────────────── */
  if (intent === "send-test") {
    const { testNumber } = body;

    if (!twilioSid || !twilioToken || !twilioWaFrom) {
      return Response.json({
        success: false,
        error: "Missing Twilio credentials",
      });
    }
    if (!testNumber) {
      return Response.json({ success: false, error: "Missing phone number" });
    }

    try {
      const client = twilio(twilioSid, twilioToken);

      // Ensure whatsapp: prefix
      const from = twilioWaFrom.startsWith("whatsapp:")
        ? twilioWaFrom
        : `whatsapp:${twilioWaFrom}`;
      const to = testNumber.startsWith("whatsapp:")
        ? testNumber
        : `whatsapp:${testNumber}`;

      const message = await client.messages.create({
        from,
        to,
        body: "🧪 Test message from your Shopify AI Agent!\n\nIf you received this, your WhatsApp integration is working correctly. ✅\n\nThis is an automated test — no action needed.",
      });

      console.log(
        `[WhatsApp-Test] ✅ Test message sent SID=${message.sid} to=${to}`,
      );

      return Response.json({
        success: true,
        messageSid: message.sid,
        status: message.status,
      });
    } catch (err) {
      console.error("[WhatsApp-Test] ❌ Send test failed:", err.message);

      let errorMsg = "Failed to send message";
      if (err.code === 21608)
        errorMsg =
          "Number not registered in Twilio WhatsApp Sandbox. Ask the recipient to join your sandbox first.";
      else if (err.code === 21211)
        errorMsg =
          "Invalid phone number format. Use E.164 format: +919876543210";
      else if (err.code === 20003) errorMsg = "Invalid Twilio credentials";
      else if (err.code === 63007)
        errorMsg = "WhatsApp number not associated with your Twilio account";
      else errorMsg = err.message;

      return Response.json({ success: false, error: errorMsg });
    }
  }

  return Response.json({ error: "Unknown intent" }, { status: 400 });
};
