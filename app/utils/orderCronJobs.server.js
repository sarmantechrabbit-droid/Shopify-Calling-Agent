import {
  CALL_INTENT,
  MAX_RETRIES,
  claimDueRetryCallLogs,
  claimStaleInProgressCallLogs,
  claimStaleQueuedCallLogs,
  handleCallResult,
  updateCallLogVapiId,
} from "../services/orderCallService.server.js";
import {
  triggerOrderConfirmationCall,
  getVapiCallIntent,
  scanForIntent,
  ASSISTANT_INTENT_MAP
} from "../services/vapiOrderService.server.js";
import prisma from "../db.server.js";

// eslint-disable-next-line no-undef
const g = global;

/**
 * Robust interval-based cron job.
 * Handles hot-reloads by clearing the previous interval if it exists.
 */
export function startOrderCronJobs() {
  if (g.__aiAgentOrderCronIntervalId) {
    clearInterval(g.__aiAgentOrderCronIntervalId);
  }

  console.log("[OrderCron] Started (Fast Poll: 30s)");

  const runJobs = async () => {
    try {
      // 1) Recover stuck IN_PROGRESS rows (Fallback when webhooks fail)
      const stale = await claimStaleInProgressCallLogs(25);
      for (const callLog of stale) {
        if (!callLog.order) continue;
        
        console.log(`[OrderCron] 🛰️ Checking stale call ${callLog.vapiCallId}...`);
        
        // Use getVapiCallIntent — it checks endedReason (no-answer, busy)
        // AND scans structuredData/Outputs for confirm/cancel
        let intent = null;
        if (callLog.vapiCallId) {
          intent = await getVapiCallIntent(callLog.vapiCallId);
        }
        
        // If intent is still null, it might be too early (Vapi still processing)
        // Release the lock and let the next cycle try again
        if (!intent) {
          // Check how old this stale row is — if it's been stale for > 90s, force a retry
          const staleSince = callLog.updatedAt ? new Date(callLog.updatedAt).getTime() : 0;
          const staleAge = Date.now() - staleSince;
          
          if (staleAge < 90_000) {
            // Less than 90s — release lock, try again next cycle
            console.log(`[OrderCron] Call ${callLog.vapiCallId} stale for ${Math.round(staleAge/1000)}s, waiting...`);
            await prisma.callLog.update({ 
              where: { id: callLog.id }, 
              data: { lockedAt: null } 
            }).catch(() => {});
            continue;
          }
          
          console.log(`[OrderCron] Call ${callLog.vapiCallId} stale for ${Math.round(staleAge/1000)}s — forcing retry`);
        }
        
        const finalIntent = intent || CALL_INTENT.RECALL_REQUEST;
        const reason = intent ? `Cron recovered: ${intent}` : "No intent after timeout — retry";

        console.log(`[OrderCron] ➡️ Applying intent=${finalIntent} to order=${callLog.order.id}`);
        await handleCallResult(callLog.order.id, finalIntent, {
          callLogId: callLog.id,
          failureReason: reason,
        }).catch(e => console.error("[OrderCron] Error updating result", e));
      }

      // 2) Handle Queued calls
      const staleQueued = await claimStaleQueuedCallLogs(25);
      for (const callLog of staleQueued) {
         if (!callLog.order) continue;
         try {
           const vres = await triggerOrderConfirmationCall({
              callLogId: callLog.id,
              customerName: callLog.order.customerName,
              phoneNumber: callLog.order.phoneNumber,
              storeName: callLog.order.storeName,
              orderId: callLog.order.shopifyOrderId,
              totalPrice: callLog.order.totalPrice,
           });
           if (vres?.id) await updateCallLogVapiId(callLog.id, vres.id);
         } catch(e) {
            console.error("[OrderCron] Error triggering queued call", e.message);
         }
      }

      // 3) Handle Due retries
      const due = await claimDueRetryCallLogs(25);
      for (const callLog of due) {
        const order = callLog.order;
        if (!order) continue;
        try {
          const vapiRes = await triggerOrderConfirmationCall({
            callLogId: callLog.id,
            customerName: order.customerName,
            phoneNumber: order.phoneNumber,
            storeName: order.storeName,
            orderId: order.shopifyOrderId,
            totalPrice: order.totalPrice,
          });
          if (vapiRes?.id) await updateCallLogVapiId(callLog.id, vapiRes.id);
        } catch (err) {
          await handleCallResult(order.id, CALL_INTENT.RECALL_REQUEST, {
            callLogId: callLog.id,
            failureReason: `Retry trigger failed: ${err.message}`,
          });
        }
      }
    } catch (err) {
      console.error("[OrderCron] Global Cron failure", err);
    }
  };

  runJobs();
  g.__aiAgentOrderCronIntervalId = setInterval(runJobs, 30_000); // 30 seconds
}
