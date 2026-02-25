/**
 * Cron Retry Job
 *
 * Runs every minute and retries calls that are in "retrying" status and whose
 * nextRetryAt timestamp has passed.
 *
 * RETRY FLOW
 * ──────────
 * 1.  Webhook marks a failed call as "retrying" + sets nextRetryAt = now+5min.
 * 2.  Cron fires every minute, finds retrying calls past their nextRetryAt.
 * 3.  For each eligible call:
 *       a) Check retryCount < MAX_RETRIES (safety guard).
 *       b) Call startRetryAttempt() → increments retryCount + sets "calling".
 *       c) Fire initiateVapiCall().
 *       d) On success: updateCallWithVapiId() (webhook will set final status).
 *       e) On transient error: setCallRetrying() to reschedule.
 *       f) On permanent error: markCallFailed().
 *
 * SINGLETON GUARD
 * ───────────────
 * Uses a process-level global flag so the scheduler is only registered once,
 * even under Vite HMR restarts which re-evaluate this module multiple times.
 */

import cron from "node-cron";
import {
  getPendingCallsForRetry,
  startRetryAttempt,
  setCallRetrying,
  markCallFailed,
  updateCallWithVapiId,
  MAX_RETRIES,
} from "../services/callService.server.js";
import {
  initiateVapiCall,
  isPermanentVapiError,
} from "../services/vapiService.server.js";

// eslint-disable-next-line no-undef
const g = global;

export function startCronJobs() {
  // Singleton guard — prevents duplicate schedulers under Vite HMR and in
  // multi-process setups that share process memory.
  if (g.__aiAgentCronStarted) return;
  g.__aiAgentCronStarted = true;

  console.log("[Cron] Auto-retry scheduler started — runs every 1 min.");

  cron.schedule("* * * * *", async () => {
    console.log("[Cron] Tick — checking for calls to retry …");

    // ── Fetch retrying calls whose nextRetryAt has passed ─────────────────
    let calls;
    try {
      calls = await getPendingCallsForRetry();
    } catch (err) {
      console.error("[Cron] DB error fetching retrying calls:", err.message);
      return;
    }

    if (calls.length === 0) {
      console.log("[Cron] No calls due for retry.");
      return;
    }

    console.log(`[Cron] ${calls.length} call(s) eligible for retry.`);

    for (const call of calls) {
      // ── Safety guard: never exceed MAX_RETRIES ──────────────────────────
      if (call.retryCount >= MAX_RETRIES) {
        // This call was scheduled for a retry but somehow wasn't permanently
        // failed by the webhook.  Clean it up now.
        await markCallFailed(call.id, "Max retries exceeded").catch((e) =>
          console.error(`[Cron] markCallFailed(${call.id}) err:`, e.message),
        );
        console.log(`[Cron] Call ${call.id} hit max retries → failed`);
        continue;
      }

      try {
        // ── a) Increment retryCount + set status="calling" ──────────────
        await startRetryAttempt(call.id);

        // ── b) Fire the Vapi call ───────────────────────────────────────
        const vapiRes = await initiateVapiCall({
          customerName: call.customerName,
          phone: call.phone,
          callId: call.id,
        });

        // ── c) Persist the new Vapi call ID for webhook correlation ─────
        if (vapiRes?.id) {
          await updateCallWithVapiId(call.id, vapiRes.id);
        }

        // Webhook will update status to answered/retrying/failed.
        console.log(
          `[Cron] ✓ Retry ${call.retryCount + 1}/${MAX_RETRIES} for ` +
            `"${call.customerName}" (${call.phone}) → vapiId=${vapiRes?.id}`,
        );
      } catch (err) {
        console.error(
          `[Cron] ✗ Retry failed for "${call.customerName}" (${call.id}):`,
          err.message,
        );

        if (isPermanentVapiError(err)) {
          // Unrecoverable (e.g. 400 invalid number) — no further retries
          await markCallFailed(call.id, err.message).catch(() => {});
        } else {
          // Transient error — reschedule if still under limit
          const nextRetryCount = call.retryCount + 1; // startRetryAttempt already incremented
          if (nextRetryCount < MAX_RETRIES) {
            await setCallRetrying(call.id, err.message).catch(() => {});
          } else {
            await markCallFailed(call.id, err.message).catch(() => {});
          }
        }
      }
    }
  });
}
