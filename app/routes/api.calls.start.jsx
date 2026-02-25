/**
 * POST /api/calls/start
 *
 * Finds every call in "pending" status and fires Vapi outbound calls for each
 * one in sequence.  Designed to be triggered by the "Start All Calls" button
 * on the dashboard or an external batch script.
 *
 * Response:
 *   {
 *     "success": true,
 *     "started": 8,       // Vapi calls successfully initiated
 *     "failed": 2,        // Calls that errored immediately
 *     "errors": [...]     // Per-call error details (if any)
 *   }
 *
 * Note on concurrency:
 *   Calls are processed sequentially (not Promise.all) to avoid hammering the
 *   Vapi API with a burst of requests which can trigger rate-limiting.
 *   If you have a Vapi plan with high concurrency limits, you can parallelise.
 */

import {
  getAllPendingCalls,
  setCallCalling,
  setCallRetrying,
  markCallFailed,
  updateCallWithVapiId,
  MAX_RETRIES,
} from "../services/callService.server.js";
import {
  initiateVapiCall,
  isPermanentVapiError,
} from "../services/vapiService.server.js";

// ─── Action (POST) ────────────────────────────────────────────────────────────

export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // ── Fetch pending calls ───────────────────────────────────────────────────
  let pending;
  try {
    pending = await getAllPendingCalls();
  } catch (err) {
    console.error("[Start] DB fetch error:", err.message);
    return Response.json(
      { error: "Database error while fetching pending calls." },
      { status: 500 },
    );
  }

  if (pending.length === 0) {
    return Response.json({
      success: true,
      message: "No pending calls to start.",
      started: 0,
      failed: 0,
    });
  }

  console.log(`[Start] Firing ${pending.length} pending call(s) …`);

  const results = { started: 0, failed: 0, errors: [] };

  // ── Process each pending call sequentially ────────────────────────────────
  for (const call of pending) {
    try {
      // 1. Transition to "calling" so the record isn't picked up by another
      //    process / request while the Vapi call is in flight.
      await setCallCalling(call.id);

      // 2. Fire the Vapi outbound call
      const vapiRes = await initiateVapiCall({
        customerName: call.customerName,
        phone: call.phone,
        callId: call.id,
      });

      if (!vapiRes?.id) {
        throw new Error("Vapi returned no call ID.");
      }

      // 3. Persist the Vapi call ID for webhook correlation
      await updateCallWithVapiId(call.id, vapiRes.id);

      results.started++;
      console.log(
        `[Start] ✓ "${call.customerName}" (${call.phone}) → vapiId=${vapiRes.id}`,
      );
    } catch (err) {
      results.failed++;
      results.errors.push({
        id: call.id,
        customerName: call.customerName,
        phone: call.phone,
        error: err.message,
      });
      console.error(
        `[Start] ✗ "${call.customerName}" (${call.phone}):`,
        err.message,
      );

      // ── Error recovery ─────────────────────────────────────────────────
      try {
        if (isPermanentVapiError(err)) {
          // E.g. 400 "number not in allowed region" — no point retrying
          await markCallFailed(call.id, err.message);
        } else {
          // Transient error (network, rate-limit) — schedule a cron retry
          // Only if we haven't exceeded MAX_RETRIES already (0 retries made
          // for a fresh pending call, so this is always true here, but be safe)
          if (call.retryCount < MAX_RETRIES) {
            await setCallRetrying(call.id, err.message);
          } else {
            await markCallFailed(call.id, err.message);
          }
        }
      } catch (recoveryErr) {
        console.error(
          `[Start] Recovery update failed for ${call.id}:`,
          recoveryErr.message,
        );
      }
    }
  }

  return Response.json({
    success: true,
    started: results.started,
    failed: results.failed,
    ...(results.errors.length > 0 ? { errors: results.errors } : {}),
  });
}

// ─── Loader (GET) — health-check ─────────────────────────────────────────────

export async function loader() {
  return Response.json({
    status: "Calls start endpoint active",
    usage: "POST /api/calls/start  (no body required)",
  });
}
