// app/routes/api.order-vapi-webhook.jsx
import {
  CALL_INTENT,
  getCallLogById,
  getCallLogByVapiId,
  handleCallResult,
  setCallLogInProgress,
} from "../services/orderCallService.server.js";

import {
  ASSISTANT_INTENT_MAP,
  scanForIntent,
  scanTranscript,
  getVapiCallIntent,
} from "../services/vapiOrderService.server.js";

const TERMINAL_EVENTS = new Set([
  "end-of-call-report",
  "call.completed",
  "assistant.completed",
]);

const g = global;
g.__vapiPayloads = g.__vapiPayloads || [];

function pushPayload(type, vapiId, result) {
  g.__vapiPayloads.unshift({
    time: new Date().toLocaleTimeString(),
    type,
    vapiId,
    result,
  });
  if (g.__vapiPayloads.length > 20) g.__vapiPayloads.pop();
}

function extractEndedReason(body) {
  const reason =
    body?.message?.endedReason ??
    body?.endedReason ??
    body?.message?.call?.endedReason;
  if (!reason) return null;

  const r = String(reason).toLowerCase();
  if (r.includes("customer-did-not-answer") || r.includes("no-answer"))
    return "recall_request";
  if (r.includes("customer-busy") || r.includes("busy")) return "busy";
  if (r.includes("machine-detected")) return "recall_request";
  return null;
}

function extractTranscript(body) {
  return (
    body?.message?.artifact?.transcript ||
    body?.message?.transcript ||
    body?.transcript ||
    body?.message?.artifact?.messages
      ?.map((m) => m?.content || m?.text)
      .filter(Boolean)
      .join(" ") ||
    null
  );
}

const pollVapi = async (orderId, callLogId, vapiId) => {
  console.log(`[VapiPoll] 🛰️ Monitoring Call ${vapiId}...`);

  for (let i = 1; i <= 6; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    console.log(`[VapiPoll] Attempt ${i}/6 checking Vapi API for ${vapiId}...`);

    const intent = await getVapiCallIntent(vapiId);
    if (intent) {
      console.log(`[VapiPoll] ✅ Found intent: ${intent}`);
      pushPayload("POLL_MATCH", vapiId, intent);
      await handleCallResult(orderId, intent, {
        callLogId,
        vapiCallId: vapiId,
      });
      return;
    }
  }

  console.log(
    `[VapiPoll] 🛑 No intent found for ${vapiId}. Scheduling retry...`,
  );
  pushPayload("POLL_NO_ANSWER", vapiId, "recall_request");
  await handleCallResult(orderId, CALL_INTENT.RECALL_REQUEST, {
    callLogId,
    vapiCallId: vapiId,
    failureReason: "No answer or no clear intent detected after polling",
  });
};

export const action = async ({ request }) => {
  const logId = Math.random().toString(36).substring(7);
  console.log(`\n[VapiWebhook][${logId}] 📥 NEW WEBHOOK`);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ ok: true });
  }

  const type = body?.message?.type ?? body?.type;
  const call = body?.message?.call ?? body?.call ?? body?.message?.artifact;
  const vapiId = call?.id;

  if (!vapiId) return Response.json({ ok: true });

  console.log(`[VapiWebhook][${logId}] type=${type} vapiId=${vapiId}`);

  let ctx = null;
  const metadata = call?.metadata ?? body?.message?.metadata ?? body?.metadata;

  if (metadata?.callLogId) {
    const log = await getCallLogById(metadata.callLogId);
    if (log) ctx = { orderId: log.orderId, callLogId: log.id };
  }

  if (!ctx) {
    const log = await getCallLogByVapiId(vapiId);
    if (log) ctx = { orderId: log.orderId, callLogId: log.id };
  }

  if (!ctx) {
    console.warn(`[VapiWebhook][${logId}] 🔍 Context not found for ${vapiId}`);
    return Response.json({ ok: true });
  }

  const immediate = scanForIntent(body);
  if (immediate && ASSISTANT_INTENT_MAP[immediate]) {
    const intent = ASSISTANT_INTENT_MAP[immediate];
    console.log(`[VapiWebhook][${logId}] ⚡ Immediate match: ${intent}`);
    pushPayload("IMMEDIATE", vapiId, intent);
    await handleCallResult(ctx.orderId, intent, {
      callLogId: ctx.callLogId,
      vapiCallId: vapiId,
    });
    return Response.json({ ok: true });
  }

  if (TERMINAL_EVENTS.has(type)) {
    console.log(`[VapiWebhook][${logId}] 🏁 Terminal event: ${type}`);

    const endedIntent = extractEndedReason(body);
    if (endedIntent) {
      console.log(
        `[VapiWebhook][${logId}] 📵 Ended without connection: ${endedIntent}`,
      );
      pushPayload("ENDED_NO_CONNECT", vapiId, endedIntent);
      await handleCallResult(ctx.orderId, endedIntent, {
        callLogId: ctx.callLogId,
        vapiCallId: vapiId,
      });
      return Response.json({ ok: true });
    }

    const transcript = extractTranscript(body);
    if (transcript && transcript.trim().length > 20) {
      const transIntent = scanTranscript(transcript);
      if (transIntent && ASSISTANT_INTENT_MAP[transIntent]) {
        const intent = ASSISTANT_INTENT_MAP[transIntent];
        console.log(`[VapiWebhook][${logId}] 📝 Transcript match: ${intent}`);
        pushPayload("TRANSCRIPT", vapiId, intent);
        await handleCallResult(ctx.orderId, intent, {
          callLogId: ctx.callLogId,
          vapiCallId: vapiId,
        });
        return Response.json({ ok: true });
      }
    }

    const quickIntent = await getVapiCallIntent(vapiId);
    if (quickIntent) {
      console.log(`[VapiWebhook][${logId}] 🎯 Quick API check: ${quickIntent}`);
      pushPayload("QUICK_API", vapiId, quickIntent);
      await handleCallResult(ctx.orderId, quickIntent, {
        callLogId: ctx.callLogId,
        vapiCallId: vapiId,
      });
      return Response.json({ ok: true });
    }

    pollVapi(ctx.orderId, ctx.callLogId, vapiId).catch(console.error);
    return Response.json({ ok: true });
  }

  if (type === "call.started" || type === "status-update") {
    await setCallLogInProgress(ctx.callLogId, vapiId);
  }

  return Response.json({ ok: true });
};


