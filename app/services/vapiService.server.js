/**
 * Vapi AI Phone Call Service
 * Handles all communication with the Vapi REST API.
 *
 * Required env vars:
 *   VAPI_API_KEY          - Your Vapi secret key
 *   VAPI_PHONE_NUMBER_ID  - The Vapi phone number ID to call from
 *   VAPI_ASSISTANT_ID     - The Vapi assistant ID to use for the call
 */

const VAPI_BASE_URL = "https://api.vapi.ai";

export class VapiRequestError extends Error {
  constructor(message, { status, retryable = true } = {}) {
    super(message);
    this.name = "VapiRequestError";
    this.status = status;
    this.retryable = retryable;
  }
}

export function isPermanentVapiError(err) {
  return err instanceof VapiRequestError && err.retryable === false;
}

function buildFirstMessage(customerName) {
  const safeName = String(customerName ?? "").trim();
  if (!safeName) return "Hello, how are you today?";
  return `Hi ${safeName}, how are you today?`;
}

/**
 * Initiates an outbound AI phone call via Vapi.
 * @param {object} params
 * @param {string} params.customerName - Display name of the customer
 * @param {string} params.phone        - E.164 phone number e.g. +12125551234
 * @param {string} params.callId       - Internal DB call ID (used for naming)
 * @returns {Promise<object>} Vapi call object containing at least { id, status }
 */
export async function initiateVapiCall({ customerName, phone, callId }) {
  const apiKey = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!apiKey || !phoneNumberId || !assistantId) {
    throw new Error(
      "Missing Vapi configuration. Set VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, and VAPI_ASSISTANT_ID env vars.",
    );
  }

  // Vapi name field max 40 chars.
  const callName = `AI-${customerName.slice(0, 20)}-${callId.slice(-8)}`;

  const payload = {
    phoneNumberId,
    assistantId,
    customer: {
      name: customerName,
      number: phone,
    },
    name: callName,
    assistantOverrides: {
      firstMessage: buildFirstMessage(customerName),
    },
  };

  console.log("[Vapi] initiateVapiCall payload:", JSON.stringify(payload));

  const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[Vapi] API error response:", JSON.stringify(data));
    const errorText =
      data?.message || data?.error || JSON.stringify(data) || "Unknown Vapi error";
    const is4xx = response.status >= 400 && response.status < 500;
    const isRateLimit = response.status === 429;
    const retryable = !is4xx || isRateLimit;
    throw new VapiRequestError(`Vapi ${response.status}: ${errorText}`, {
      status: response.status,
      retryable,
    });
  }

  console.log("[Vapi] Call created:", data.id, "status:", data.status);
  return data;
}
