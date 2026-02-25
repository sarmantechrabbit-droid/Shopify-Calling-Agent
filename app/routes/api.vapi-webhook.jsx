/**
 * POST /api/vapi-webhook
 * Public route — no Shopify authentication required.
 *
 * Vapi sends a POST for every call lifecycle event.  We care about two:
 *
 *   end-of-call-report / call.completed
 *     → resolveStatus() maps endedReason → "answered" | "failed" | null
 *     → handleCallEnd() updates DB and schedules a retry if appropriate
 *
 *   call.failed / call.no-answer
 *     → always treated as "failed"; retry scheduled if under MAX_RETRIES
 *
 * RETRY SCHEDULING (done here, executed by cron)
 * ───────────────────────────────────────────────
 *   When a call fails and retryCount < MAX_RETRIES:
 *     - status   → "retrying"
 *     - nextRetryAt → now + RETRY_DELAY_MS (5 min)
 *   The cron picks this up, increments retryCount, and fires a new Vapi call.
 *
 *   When retryCount >= MAX_RETRIES the call is permanently marked "failed".
 */

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

/**
 * Map Vapi event fields to one of: "answered" | "failed" | null
 * null = call is still in-flight (cron handles no-answer retries)
 */
function resolveStatus(endedReason, callStatus, eventType) {
  const reason = String(endedReason ?? "").toLowerCase();
  const status = String(callStatus ?? "").toLowerCase();
  const type = String(eventType ?? "").toLowerCase();

  if (ANSWERED_REASONS.has(reason) || ANSWERED_REASONS.has(status))
    return "answered";
  if (FAILED_REASONS.has(reason) || FAILED_REASONS.has(status)) return "failed";
  if (PENDING_REASONS.has(reason) || PENDING_REASONS.has(status)) return null;

  // Fallback: end event with unknown reason → treat as answered so real
  // completed calls don't get stuck in "calling".
  if (type === "end-of-call-report" || type === "call.completed")
    return "answered";

  return null;
}

// ─── Core update logic ────────────────────────────────────────────────────────

/**
 * Look up a call by Vapi's call ID and apply the final status.
 *
 * - "answered" → markCallAnswered (clears failureReason + nextRetryAt)
 * - "failed"   → schedule retry OR mark permanently failed
 *
 * Idempotent: already-answered calls are never downgraded.
 *
 * @param {string} vapiCallId
 * @param {"answered"|"failed"} finalStatus
 * @param {string|null} failureReason
 */
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

  // Idempotency guard — never downgrade an already-answered call
  if (record.status === "answered") return;

  if (finalStatus === "answered") {
    await markCallAnswered(record.id);
    console.log(`[Webhook] ✓ Call ${record.id} (vapiId=${vapiCallId}) → answered`);
    return;
  }

  // ── Failed — decide: retry or permanent failure ───────────────────────────
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

// ─── Event dispatcher ─────────────────────────────────────────────────────────

async function handleEvent(type, call) {
  const vapiCallId = call?.id;
  const endedReason =
    call?.endedReason ??
    call?.ended_reason ??
    call?.analysis?.endedReason ??
    call?.analysis?.ended_reason;
  const callStatus =
    call?.status ?? call?.callStatus ?? call?.call_status;

  console.log(
    `[Webhook] type="${type}" vapiCallId="${vapiCallId}" ` +
      `reason="${endedReason}" status="${callStatus}"`,
  );

  switch (type) {
    // ── End-of-call (primary event) ─────────────────────────────────────────
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

    // ── Explicit failure events ──────────────────────────────────────────────
    case "call.failed":
    case "call-failed":
      await handleCallEnd(vapiCallId, "failed", endedReason ?? "call-failed");
      break;

    // ── No-answer — treat as failure so retry is scheduled ──────────────────
    case "call.no-answer":
    case "no-answer":
      await handleCallEnd(vapiCallId, "failed", "no-answer");
      break;

    // ── In-progress events — no DB update needed ─────────────────────────────
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

// ─── Route exports ────────────────────────────────────────────────────────────

export async function action({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Vapi sends events in two possible shapes:
  //   { message: { type, call } }   ← older SDK
  //   { type, call }                ← newer SDK
  const type = body.message?.type ?? body.type;
  const call = body.message?.call ?? body.call;

  if (!type) {
    console.warn("[Webhook] Missing event type:", JSON.stringify(body).slice(0, 200));
    return Response.json({ error: "Missing event type" }, { status: 400 });
  }

  try {
    await handleEvent(type, call);
  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    // Always return 200 so Vapi does not retry delivery endlessly.
    return Response.json({ ok: true, warning: "Internal processing error" });
  }

  return Response.json({ ok: true });
}

export async function loader() {
  return Response.json({ status: "Vapi webhook active" });
}
