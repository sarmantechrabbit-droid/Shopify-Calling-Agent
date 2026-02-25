/**
 * Vapi Order Service
 *
 * Triggers outbound AI calls for order confirmation.
 *
 * IMPORTANT:
 * - systemPrompt and structured output MUST be configured
 *   in the Vapi Dashboard Assistant (NOT per call).
 * - assistantOverrides only supports runtime values like
 *   firstMessage, variableValues, serverUrl.
 */

const VAPI_BASE_URL = "https://api.vapi.ai";

/* ─────────────────────────────────────────────────────────────
   Error handling
   ───────────────────────────────────────────────────────────── */

export class VapiOrderError extends Error {
  constructor(message, { status, retryable = true } = {}) {
    super(message);
    this.name = "VapiOrderError";
    this.status = status;
    this.retryable = retryable;
  }
}

export function isPermanentOrderVapiError(err) {
  return err instanceof VapiOrderError && err.retryable === false;
}

/* ─────────────────────────────────────────────────────────────
   Intent Mapping & Scanners
   ───────────────────────────────────────────────────────────── */

export const ASSISTANT_INTENT_MAP = {
  confirm: 'confirm',
  confirmed: 'confirm',
  accepted: 'confirm',
  yes: 'confirm',
  confirming: 'confirm',
  cancel: 'cancel',
  cancelled: 'cancel',
  no: 'cancel',
  busy: 'busy',
  recall: 'recall_request',
  call_later: 'recall_request',
  pending: 'recall_request',
  wrong_number: 'wrong_number',
};

/**
 * Robust scanner to find intent in Vapi payloads.
 * Searches multiple paths and handles nested objects/UUID keys.
 */
export function scanForIntent(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 8) return null;

  // At top level, check every possible location for AI-generated results
  if (depth === 0) {
    const paths = [
      { name: "analysis", data: obj?.analysis || obj?.message?.analysis },
      { name: "artifact", data: obj?.artifact || obj?.message?.artifact || obj?.call?.artifact },
      { name: "structuredData", data: obj?.structuredData || obj?.message?.structuredData || obj?.analysis?.structuredData },
      { name: "structuredOutputs", data: obj?.structuredOutputs || obj?.message?.structuredOutputs || obj?.analysis?.structuredOutputs },
      { name: "toolCalls", data: obj?.toolCalls || obj?.message?.toolCalls },
      { name: "successEvaluation", data: obj?.analysis?.successEvaluation || obj?.message?.analysis?.successEvaluation }
    ];

    for (const { name, data } of paths) {
      if (!data) continue;
      const found = _deepScanIntentData(data, 0);
      if (found) {
        console.log(`[VapiScanner] ✅ Match in ${name}: "${found}"`);
        return found;
      }
    }
    return null;
  }
  return null;
}

function _deepScanIntentData(obj, depth) {
  if (!obj || depth > 6) return null;

  // Handle Stringified JSON
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    const lower = trimmed.toLowerCase();
    
    if (ASSISTANT_INTENT_MAP[lower]) return lower;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return _deepScanIntentData(parsed, depth + 1);
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = _deepScanIntentData(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof obj === 'object') {
    // 1. Check values first
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' || (value && typeof value === 'object')) {
        const found = _deepScanIntentData(value, depth + 1);
        if (found) return found;
      }
    }

    // 2. Check keys
    for (const [key, value] of Object.entries(obj)) {
      const k = String(key).toLowerCase().trim();
      const valStr = String(value).toLowerCase().trim();
      if (ASSISTANT_INTENT_MAP[k] && (value === true || valStr === 'true' || valStr === 'yes')) {
        return k;
      }
    }
  }

  return null;
}

/**
 * Scans a raw transcript string for confirmation keywords.
 */
export function scanTranscript(transcript) {
  if (!transcript || typeof transcript !== "string") return null;
  const text = transcript.toLowerCase();

  const confirmPatterns = [
    /\b(haan|ha|yes|confirm|confirmed|ok|okay|theek hai|thik hai|acha thik hai|order kar do|pakka)\b/,
  ];
  const cancelPatterns = [
    /\b(cancel|nahi|nahi chahiye|cancelled|mat karo|nako|no)\b/,
  ];
  const wrongNumberPatterns = [
    /\bwrong number\b/,
  ];

  for (const pat of wrongNumberPatterns) {
    if (pat.test(text)) return "wrong_number";
  }

  const parts = text.split(/[.!?\n]/).filter(p => p.trim().length > 0);
  const lastFewParts = parts.slice(-3).join(' ');

  for (const pat of cancelPatterns) {
    if (pat.test(lastFewParts)) return "cancel";
  }
  for (const pat of confirmPatterns) {
    if (pat.test(lastFewParts)) return "confirm";
  }

  return null;
}

/**
 * Fetches the call details from Vapi API and searches for an intent.
 */
export async function getVapiCallIntent(vapiCallId) {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey || !vapiCallId) return null;

  try {
    const res = await fetch(`${VAPI_BASE_URL}/call/${vapiCallId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    
    if (!res.ok) return null;
    const data = await res.json();

    const callStatus = data?.status;
    const endedReason = data?.endedReason;

    console.log(`[VapiService] Call ${vapiCallId} status=${callStatus} endedReason=${endedReason}`);

    if (callStatus === 'ended' && (
      endedReason === 'customer-did-not-answer' ||
      endedReason === 'customer-busy' ||
      endedReason === 'no-answer' ||
      endedReason === 'busy' ||
      endedReason === 'machine-detected'
    )) {
      console.log(`[VapiService] Call ${vapiCallId} did not connect: ${endedReason}`);
      return endedReason.includes('busy') ? 'busy' : 'recall_request';
    }

    if (callStatus === 'queued' || callStatus === 'ringing' || callStatus === 'in-progress') {
      return null;
    }
    
    const foundRaw = scanForIntent(data);
    if (foundRaw) {
      console.log(`[VapiService] Found intent: ${foundRaw}`);
      return ASSISTANT_INTENT_MAP[foundRaw];
    }

    const transcript = data?.artifact?.transcript || data?.transcript;
    if (transcript && typeof transcript === 'string' && transcript.trim().length > 20) {
      const transRaw = scanTranscript(transcript);
      if (transRaw) {
        console.log(`[VapiService] Found intent from transcript: ${transRaw}`);
        return ASSISTANT_INTENT_MAP[transRaw];
      }
    }

    return null;
  } catch (e) {
    console.error(`[VapiService] Error fetching call ${vapiCallId}:`, e.message);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   First message builder
   ───────────────────────────────────────────────────────────── */

function buildFirstMessage(customerName, storeName, orderId, totalPrice) {
  const lang = String(process.env.CALL_LANGUAGE ?? "hindi").toLowerCase().trim();

//   if (lang === "gujarati") {
//     return (
//       `नमस्ते ${customerName}, ` +
//       `हूं ${storeName} तरफथी बोली रह्यो छुं. ` +
//       `तमे ₹${totalPrice}नो ऑर्डर #${orderId} place कर्यो छे. ` +
//       `शुं तमे आ ऑर्डर confirm करो छो?`
//     );
//   }
if (lang === "gujarati") {
  return (
    `નમસ્તે ${customerName}, ` +
    `હું ${storeName} તરફથી બોલી રહ્યો છું. ` +
    `તમે ₹${totalPrice} નો ઓર્ડર #${orderId} કર્યો છે. ` +
    `શું તમે આ ઓર્ડર કન્ફર્મ કરો છો?`
  );
}
  return (
    `नमस्ते ${customerName}, ` +
    `मैं ${storeName} की तरफ से बोल रहा हूं। ` +
    `आपने ₹${totalPrice} का Order #${orderId} place किया है। ` +
    `क्या आप इस ऑर्डर की पुष्टि करते हैं?`
  );
}

/* ─────────────────────────────────────────────────────────────
   Call trigger
   ───────────────────────────────────────────────────────────── */

export async function triggerOrderConfirmationCall({
  callLogId,
  customerName,
  phoneNumber,
  storeName,
  orderId,
  totalPrice,
  overrideBaseUrl,
}) {
  const apiKey = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const assistantId = process.env.VAPI_ORDER_ASSISTANT_ID ?? process.env.VAPI_ASSISTANT_ID;

  const candidates = [
    overrideBaseUrl,
    process.env.VAPI_WEBHOOK_BASE_URL,
    process.env.SHOPIFY_APP_URL,
    process.env.APP_URL,
  ]
    .map((v) => String(v ?? "").trim().replace(/\/$/, ""))
    .filter(Boolean);

  const publicBaseUrl = candidates.find(
    (u) => u.startsWith("https://") && !u.includes("localhost") && !u.includes("127.0.0.1")
  );

  const orderWebhookUrl = publicBaseUrl ? `${publicBaseUrl}/api/order-vapi-webhook` : null;

  if (!apiKey || !phoneNumberId || !assistantId) {
    throw new VapiOrderError("Missing Vapi config.", { retryable: false });
  }

  if (!orderWebhookUrl) {
    throw new VapiOrderError("Missing public webhook URL.", { retryable: false });
  }

  const payload = {
    phoneNumberId,
    assistantId,
    customer: { name: customerName, number: phoneNumber },
    name: `COD-${String(orderId).slice(-10)}`,
    metadata: { callLogId, orderId, type: "order_confirmation" },
    assistantOverrides: {
      serverUrl: orderWebhookUrl,
      firstMessage: buildFirstMessage(customerName, storeName, orderId, totalPrice),
      variableValues: {
        customerName,
        storeName,
        orderId: String(orderId),
        totalPrice: String(totalPrice),
      },
    },
  };

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
    throw new VapiOrderError(`Vapi ${response.status}: ${data?.message || "Error"}`, {
      status: response.status,
      retryable: response.status === 429 || response.status >= 500
    });
  }

  return data;
}
