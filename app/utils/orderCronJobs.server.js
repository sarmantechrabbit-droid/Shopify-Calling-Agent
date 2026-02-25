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
        
        console.log(`[OrderCron] 🛰️ Checking Vapi for stale call ${callLog.vapiCallId}...`);
        
        // Fetch full data to check status and timing
        const apiKey = process.env.VAPI_API_KEY;
        const res = await fetch(`https://api.vapi.ai/call/${callLog.vapiCallId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` }
        }).catch(() => null);

        let intent = null;
        let callData = null;
        if (res?.ok) {
          callData = await res.json();
          const rawIntent = scanForIntent(callData);
          if (rawIntent) {
            intent = ASSISTANT_INTENT_MAP[rawIntent];
          }
        }
        
        // If no intent yet, but call just ended, wait up to 60s for analysis to finish
        if (!intent && callData?.status === 'ended') {
          const endedAt = callData.endedAt ? new Date(callData.endedAt).getTime() : Date.now();
          const now = Date.now();
          if (now - endedAt < 60000) { 
            console.log(`[OrderCron] Call ${callLog.vapiCallId} ended recently; waiting for analysis...`);
            continue; 
          }
        }
        
        const finalIntent = intent ? intent : CALL_INTENT.RECALL_REQUEST;
        const reason = intent ? `Recovered from API: ${intent}` : "Stale recovery fallback to retry";

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
