// app/routes/api.vapi-webhook.jsx
import prisma from "../db.server.js";
import {
  setCallRetrying,
  markCallFailed,
  markCallAnswered,
  MAX_RETRIES,
} from "../services/callService.server.js";

// ─── Status resolution ────────────────────────────────────────────────────────

const ANSWERED_REASONS = new Set([
  "customer-ended-call",
  "assistant-ended-call",
  "assistant-ended-call-with-hangup",
  "answered",
  "completed",
  "call-ended",
  "hangup",
]);

const FAILED_REASONS = new Set([
  "assistant-error",
  "pipeline-error",
  "server-error",
  "error",
  "failed",
  "cancelled",
]);

const PENDING_REASONS = new Set([
  "no-answer",
  "voicemail",
  "busy",
  "pending",
  "queued",
  "ringing",
  "in-progress",
  "in_progress",
]);

function resolveStatus(endedReason, callStatus, eventType) {
  const reason = String(endedReason ?? "").toLowerCase();
  const status = String(callStatus ?? "").toLowerCase();
  const type = String(eventType ?? "").toLowerCase();

  if (ANSWERED_REASONS.has(reason) || ANSWERED_REASONS.has(status))
    return "answered";
  if (FAILED_REASONS.has(reason) || FAILED_REASONS.has(status)) return "failed";
  if (PENDING_REASONS.has(reason) || PENDING_REASONS.has(status)) return null;

  if (type === "end-of-call-report" || type === "call.completed")
    return "answered";

  return null;
}

// ─── Core update logic ────────────────────────────────────────────────────────

async function handleCallEnd(vapiCallId, finalStatus, failureReason = null) {
  if (!vapiCallId) return;

  const record = await prisma.customerCall.findFirst({
    where: { vapiCallId },
    select: { id: true, status: true, retryCount: true },
  });

  if (!record) {
    console.warn(`[Webhook] No DB record for vapiCallId="${vapiCallId}"`);
    return;
  }

  if (record.status === "answered") return;

  if (finalStatus === "answered") {
    await markCallAnswered(record.id);
    console.log(
      `[Webhook] ✓ Call ${record.id} (vapiId=${vapiCallId}) → answered`,
    );
    return;
  }

  const reason = failureReason ?? "unknown";

  if (record.retryCount < MAX_RETRIES) {
    await setCallRetrying(record.id, reason);
    console.log(
      `[Webhook] ↩ Call ${record.id} → retrying ` +
        `(attempt ${record.retryCount + 1}/${MAX_RETRIES}). Reason: ${reason}`,
    );
  } else {
    await markCallFailed(record.id, reason);
    console.log(
      `[Webhook] ✗ Call ${record.id} → failed permanently after ` +
        `${record.retryCount} retries. Reason: ${reason}`,
    );
  }
}

async function handleEvent(type, call) {
  const vapiCallId = call?.id;
  const endedReason =
    call?.endedReason ??
    call?.ended_reason ??
    call?.analysis?.endedReason ??
    call?.analysis?.ended_reason;
  const callStatus = call?.status ?? call?.callStatus ?? call?.call_status;

  console.log(
    `[Webhook] type="${type}" vapiCallId="${vapiCallId}" ` +
      `reason="${endedReason}" status="${callStatus}"`,
  );

  switch (type) {
    case "end-of-call-report":
    case "call.completed": {
      const finalStatus = resolveStatus(endedReason, callStatus, type);
      if (finalStatus) {
        await handleCallEnd(vapiCallId, finalStatus, endedReason);
      } else {
        console.log(
          `[Webhook] Call ${vapiCallId} ended with ambiguous reason ` +
            `"${endedReason}" → no DB change`,
        );
      }
      break;
    }

    case "call.failed":
    case "call-failed":
      await handleCallEnd(vapiCallId, "failed", endedReason ?? "call-failed");
      break;

    case "call.no-answer":
    case "no-answer":
      await handleCallEnd(vapiCallId, "failed", "no-answer");
      break;

    case "status-update":
    case "transcript":
    case "hang":
    case "speech-update":
    case "function-call":
      break;

    default:
      console.log(`[Webhook] Unhandled event type: "${type}"`);
  }
}

export const action = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.message?.type ?? body.type;
  const call = body.message?.call ?? body.call;

  if (!type) {
    console.warn(
      "[Webhook] Missing event type:",
      JSON.stringify(body).slice(0, 200),
    );
    return Response.json({ error: "Missing event type" }, { status: 400 });
  }

  try {
    await handleEvent(type, call);
  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    return Response.json({ ok: true, warning: "Internal processing error" });
  }

  return Response.json({ ok: true });
};


