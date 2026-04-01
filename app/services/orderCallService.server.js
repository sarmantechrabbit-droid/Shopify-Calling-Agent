import prisma from "../db.server.js";
import { sendWhatsAppFallback } from "../utils/whatsappFallback.server.js";
import {
  ORDER_STATUS,
  ORDER_CALL_STATUS,
  CALL_INTENT,
  ORDER_MAX_RETRIES,
} from "../constants.js";

const CALL_STATUS = ORDER_CALL_STATUS;
const MAX_RETRIES = ORDER_MAX_RETRIES;

export { ORDER_STATUS, CALL_INTENT, CALL_STATUS, MAX_RETRIES };

// Retry delay settings (can also be moved to DB in future)
export const RETRY_DELAY_BUSY_MS = 5 * 60 * 1000;
export const RETRY_DELAY_RECALL_MS = 5 * 60 * 1000;
export const RETRY_DELAY_NO_RESPONSE_MS = 5 * 60 * 1000;
export const IN_PROGRESS_STALE_MS = 40 * 1000; // 40 seconds — fast fallback when webhook doesn't fire

function nowPlus(ms) {
  return new Date(Date.now() + ms);
}

function toIntent(intent) {
  return String(intent ?? "").trim().toUpperCase();
}

function logStatus(event, payload) {
  console.log(`[OrderStatus] ${event} ${JSON.stringify(payload)}`);
}

export async function logCommunicationEvent(orderId, event, tx = prisma) {
  try {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const logs = Array.isArray(order.communicationLog) ? [...order.communicationLog] : [];
    logs.push({
      timestamp: new Date().toISOString(),
      event,
    });
    await tx.order.update({
      where: { id: orderId },
      data: { communicationLog: logs },
    });
  } catch (err) {
    console.error(`[logCommunicationEvent] Failed for orderId=${orderId}:`, err.message);
  }
}

export async function createOrderWithCallLog({
  shopifyOrderId,
  customerName,
  phoneNumber,
  storeName,
  totalPrice,
  orderPlacedDate,
  address,
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        shopifyOrderId,
        customerName,
        phoneNumber,
        storeName,
        totalPrice,
        orderPlacedDate,
        address,
        orderStatus: ORDER_STATUS.PENDING,
        confirmationStatus: "pending",
        communicationLog: [
          {
            timestamp: new Date().toISOString(),
            event: "Order created",
          },
        ],
      },
    });

    const callLog = await tx.callLog.create({
      data: {
        orderId: order.id,
        status: CALL_STATUS.QUEUED,
        retryCount: 0,
        nextRetryAt: null,
        lockedAt: null,
      },
    });

    logStatus("ORDER_CREATED", {
      orderId: order.id,
      callLogId: callLog.id,
      orderStatus: order.orderStatus,
      callStatus: callLog.status,
    });

    return { order, callLog };
  });
}

export async function setCallLogInProgress(id, vapiCallId = null) {
  const res = await prisma.callLog.updateMany({
    where: {
      id,
      status: { in: [CALL_STATUS.QUEUED, CALL_STATUS.RETRY_SCHEDULED, CALL_STATUS.IN_PROGRESS, CALL_STATUS.WHATSAPP_SENT] },
    },
    data: {
      status: CALL_STATUS.IN_PROGRESS,
      lockedAt: null,
      failureReason: null,
      ...(vapiCallId ? { vapiCallId } : {}),
    },
  });
  return res.count === 1;
}

// Backward-compatible alias used by existing routes.
export const setCallLogCalling = setCallLogInProgress;

export async function updateCallLogVapiId(id, vapiCallId) {
  return prisma.callLog.update({
    where: { id },
    data: { vapiCallId, lockedAt: null },
  });
}

export async function markCallLogFailed(id, failureReason = null) {
  return prisma.callLog.update({
    where: { id },
    data: {
      status: CALL_STATUS.FAILED,
      nextRetryAt: null,
      lockedAt: null,
      ...(failureReason ? { failureReason } : {}),
    },
  });
}

export async function getCallLogByVapiId(vapiCallId) {
  return prisma.callLog.findFirst({ where: { vapiCallId }, include: { order: true } });
}

export async function getCallLogById(id) {
  return prisma.callLog.findUnique({ where: { id }, include: { order: true } });
}

export async function getOrderByShopifyId(shopifyOrderId) {
  return prisma.order.findUnique({ where: { shopifyOrderId } });
}

export async function getLatestCallLogByOrderId(orderId) {
  return prisma.callLog.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    include: { order: true },
  });
}

export async function getLatestOpenCallLogByPhone(phoneNumber) {
  return prisma.callLog.findFirst({
    where: {
      status: { in: [CALL_STATUS.QUEUED, CALL_STATUS.IN_PROGRESS, CALL_STATUS.RETRY_SCHEDULED, CALL_STATUS.FAILED, CALL_STATUS.WHATSAPP_SENT] },
      order: {
        phoneNumber,
        orderStatus: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PENDING_MANUAL_REVIEW] },
      },
    },
    orderBy: { createdAt: "desc" },
    include: { order: true },
  });
}

export async function handleCallResult(orderId, intent, opts = {}) {
  const normalizedIntent = toIntent(intent);

  return prisma.$transaction(async (tx) => {
    const [callLog, config] = await Promise.all([
      (opts.callLogId
        ? tx.callLog.findUnique({ where: { id: opts.callLogId }, include: { order: true } })
        : null) ||
      (opts.vapiCallId
        ? tx.callLog.findFirst({ where: { vapiCallId: opts.vapiCallId }, include: { order: true } })
        : null) ||
      tx.callLog.findFirst({
        where: { orderId },
        orderBy: { createdAt: "desc" },
        include: { order: true },
      }),
      tx.appConfig.findFirst({ where: { shop: "default" } }),
    ]);

    const waAutoConfirm = config?.waAutoConfirm ?? true; // Default to true if not set

    if (!callLog) {
      throw new Error(`CallLog not found for orderId=${orderId}`);
    }

    const vId = opts.vapiCallId || callLog.vapiCallId;

    // Skip processing if WhatsApp was already sent and this is not a WhatsApp reply
    // WhatsApp replies come in via the whatsapp-webhook route with a failureReason marker
    if (callLog.status === CALL_STATUS.WHATSAPP_SENT && !opts.fromWhatsApp) {
      logStatus("IGNORED_WHATSAPP_PENDING", {
        orderId,
        callLogId: callLog.id,
        intent: normalizedIntent,
        status: callLog.status,
      });
      return {
        ignored: true,
        orderStatus: callLog.order?.orderStatus,
        callStatus: callLog.status,
        retryCount: callLog.retryCount,
      };
    }

    if (callLog.status === CALL_STATUS.COMPLETED || callLog.status === CALL_STATUS.FAILED) {
      // Allow late definitive intents to correct terminal rows when webhook ordering is delayed.
      if (normalizedIntent === CALL_INTENT.CONFIRM || normalizedIntent === CALL_INTENT.CANCEL) {
        const [order, call] = await Promise.all([
          tx.order.update({
            where: { id: orderId },
            data: {
              orderStatus:
                normalizedIntent === CALL_INTENT.CONFIRM
                  ? ORDER_STATUS.CONFIRMED
                  : ORDER_STATUS.CANCELLED,
              confirmationStatus:
                normalizedIntent === CALL_INTENT.CONFIRM ? "confirmed" : "cancelled",
            },
          }),
          tx.callLog.update({
            where: { id: callLog.id },
            data: {
              lastIntent: normalizedIntent,
              lockedAt: null,
              failureReason: null,
              status: CALL_STATUS.COMPLETED,
              nextRetryAt: null,
            },
          }),
        ]);

        await logCommunicationEvent(
          orderId,
          `Order ${normalizedIntent.toLowerCase()} via late intent (${
            opts.fromWhatsApp ? "WhatsApp" : "Call"
          })`,
          tx,
        );

        logStatus("TERMINAL_CORRECTED_FROM_LATE_INTENT", {
          orderId,
          callLogId: call.id,
          intent: normalizedIntent,
          previousCallStatus: callLog.status,
          orderStatus: order.orderStatus,
          callStatus: call.status,
          retryCount: call.retryCount,
        });

        return {
          corrected: true,
          orderStatus: order.orderStatus,
          callStatus: call.status,
          retryCount: call.retryCount,
        };
      }

      logStatus("IGNORED_ALREADY_TERMINAL", {
        orderId,
        callLogId: callLog.id,
        intent: normalizedIntent,
        status: callLog.status,
      });
      return {
        ignored: true,
        orderStatus: callLog.order?.orderStatus,
        callStatus: callLog.status,
        retryCount: callLog.retryCount,
      };
    }

    const baseCallUpdate = {
      lastIntent: normalizedIntent,
      lockedAt: null,
      failureReason: opts.failureReason ?? null,
    };

    if (normalizedIntent === CALL_INTENT.CONFIRM) {
      const [order, call] = await Promise.all([
        tx.order.update({
          where: { id: orderId },
          data: { orderStatus: ORDER_STATUS.CONFIRMED, confirmationStatus: "confirmed" },
        }),
        tx.callLog.update({
          where: { id: callLog.id },
          data: { ...baseCallUpdate, status: CALL_STATUS.COMPLETED, nextRetryAt: null },
        }),
      ]);
      await logCommunicationEvent(
        orderId,
        `Order confirmed via ${opts.fromWhatsApp ? "WhatsApp" : "Call"}`,
        tx,
      );
      logStatus("RESULT_APPLIED", {
        orderId,
        callLogId: call.id,
        intent: normalizedIntent,
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
      });
      return {
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
      };
    }

    if (normalizedIntent === CALL_INTENT.CANCEL) {
      const [order, call] = await Promise.all([
        tx.order.update({
          where: { id: orderId },
          data: { orderStatus: ORDER_STATUS.CANCELLED, confirmationStatus: "cancelled" },
        }),
        tx.callLog.update({
          where: { id: callLog.id },
          data: { ...baseCallUpdate, status: CALL_STATUS.COMPLETED, nextRetryAt: null },
        }),
      ]);
      await logCommunicationEvent(
        orderId,
        `Order cancelled via ${opts.fromWhatsApp ? "WhatsApp" : "Call"}`,
        tx,
      );
      logStatus("RESULT_APPLIED", {
        orderId,
        callLogId: call.id,
        intent: normalizedIntent,
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
      });
      return {
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
      };
    }

    if (normalizedIntent === CALL_INTENT.WRONG_NUMBER) {
      const [order, call] = await Promise.all([
        tx.order.update({ where: { id: orderId }, data: { orderStatus: ORDER_STATUS.INVALID } }),
        tx.callLog.update({
          where: { id: callLog.id },
          data: { ...baseCallUpdate, status: CALL_STATUS.FAILED, nextRetryAt: null },
        }),
      ]);
      logStatus("RESULT_APPLIED", {
        orderId,
        callLogId: call.id,
        intent: normalizedIntent,
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
      });
      return {
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
      };
    }

    const isRetryIntent = [
      CALL_INTENT.BUSY,
      CALL_INTENT.RECALL_REQUEST,
      CALL_INTENT.NO_RESPONSE,
    ].includes(normalizedIntent);

    if (!isRetryIntent) {
      throw new Error(`Unsupported intent=${normalizedIntent}`);
    }
    const userMaxRetries = config?.maxRetries ?? 3;
    const nextRetryCount = callLog.retryCount + 1;

    // ── WhatsApp fallback or Escalation ──
    // This block triggers when we reach the user-defined max retries.
    if (nextRetryCount >= userMaxRetries) {
      const now = new Date();

      if (waAutoConfirm) {
        // Option A: Send WhatsApp and wait for reply
        const [order, call] = await Promise.all([
          tx.order.update({
            where: { id: orderId },
            data: { orderStatus: ORDER_STATUS.PENDING },
          }),
          tx.callLog.update({
            where: { id: callLog.id },
            data: {
              ...baseCallUpdate,
              status: CALL_STATUS.WHATSAPP_SENT,
              retryCount: nextRetryCount,
              nextRetryAt: null,
              whatsappSentAt: now,
              whatsappReplied: false,
              secondReminderSent: false,
            },
          }),
        ]);

        logStatus("MAX_RETRIES_SWITCH_TO_WHATSAPP", {
          orderId,
          callLogId: call.id,
          nextRetryCount,
          maxRetries: userMaxRetries,
        });

        // Send WhatsApp message outside the transaction
        const fullCallLog = { ...call, order };
        sendWhatsAppFallback(fullCallLog).catch((err) => {
          console.error(`[WhatsApp] Failed to send fallback for callLogId=${call.id}:`, err.message);
        });

        return {
          orderStatus: order.orderStatus,
          callStatus: call.status,
          retryCount: call.retryCount,
          whatsappSent: true,
        };
      } else {
        // Option B: No WhatsApp, just escalate to manual review
        const [order, call] = await Promise.all([
          tx.order.update({
            where: { id: orderId },
            data: { orderStatus: ORDER_STATUS.PENDING_MANUAL_REVIEW },
          }),
          tx.callLog.update({
            where: { id: callLog.id },
            data: {
              ...baseCallUpdate,
              status: CALL_STATUS.FAILED,
              retryCount: nextRetryCount,
              nextRetryAt: null,
            },
          }),
        ]);

        logStatus("MAX_RETRIES_ESCALATED", {
          orderId,
          callLogId: call.id,
          nextRetryCount,
          maxRetries: userMaxRetries,
        });

        return {
          orderStatus: order.orderStatus,
          callStatus: call.status,
          retryCount: call.retryCount,
        };
      }
    }

    // ── If not at max retries yet, schedule next call ──
    const delayMs =
      normalizedIntent === CALL_INTENT.NO_RESPONSE
        ? RETRY_DELAY_NO_RESPONSE_MS
        : normalizedIntent === CALL_INTENT.BUSY
          ? RETRY_DELAY_BUSY_MS
          : RETRY_DELAY_RECALL_MS;

    const [order, call] = await Promise.all([
      tx.order.update({ where: { id: orderId }, data: { orderStatus: ORDER_STATUS.PENDING } }),
      tx.callLog.update({
        where: { id: callLog.id },
        data: {
          ...baseCallUpdate,
          status: CALL_STATUS.RETRY_SCHEDULED,
          retryCount: nextRetryCount,
          nextRetryAt: nowPlus(delayMs),
        },
      }),
    ]);

    logStatus("RESULT_APPLIED", {
      orderId,
      callLogId: call.id,
      intent: normalizedIntent,
      orderStatus: order.orderStatus,
      callStatus: call.status,
      retryCount: call.retryCount,
      nextRetryAt: call.nextRetryAt,
    });

    return {
      orderStatus: order.orderStatus,
      callStatus: call.status,
      retryCount: call.retryCount,
      nextRetryAt: call.nextRetryAt,
    };
  });
}

export async function claimDueRetryCallLogs(limit = 25) {
  const dueRows = await prisma.callLog.findMany({
    where: {
      status: CALL_STATUS.RETRY_SCHEDULED,
      nextRetryAt: { lte: new Date() },
      retryCount: { lt: MAX_RETRIES },
      lockedAt: null,
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
    include: { order: true },
  });

  const claimed = [];
  for (const row of dueRows) {
    const lock = await prisma.callLog.updateMany({
      where: {
        id: row.id,
        status: CALL_STATUS.RETRY_SCHEDULED,
        nextRetryAt: { lte: new Date() },
        lockedAt: null,
      },
      data: {
        lockedAt: new Date(),
        status: CALL_STATUS.IN_PROGRESS,
      },
    });

    if (lock.count === 1) {
      claimed.push(row);
      logStatus("RETRY_CLAIMED", { callLogId: row.id, orderId: row.orderId });
    }
  }

  return claimed;
}

export async function claimStaleInProgressCallLogs(limit = 25) {
  const cutoff = new Date(Date.now() - IN_PROGRESS_STALE_MS);

  const staleRows = await prisma.callLog.findMany({
    where: {
      status: CALL_STATUS.IN_PROGRESS,
      updatedAt: { lte: cutoff },
      retryCount: { lt: MAX_RETRIES },
      OR: [{ lockedAt: null }, { lockedAt: { lte: cutoff } }],
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    include: { order: true },
  });

  const claimed = [];
  for (const row of staleRows) {
    const lock = await prisma.callLog.updateMany({
      where: {
        id: row.id,
        status: CALL_STATUS.IN_PROGRESS,
        updatedAt: { lte: cutoff },
        OR: [{ lockedAt: null }, { lockedAt: { lte: cutoff } }],
      },
      data: { lockedAt: new Date() },
    });

    if (lock.count === 1) {
      claimed.push(row);
      logStatus("STALE_IN_PROGRESS_CLAIMED", { callLogId: row.id, orderId: row.orderId });
    }
  }

  return claimed;
}

export async function claimTimedOutWhatsAppLogs(timeoutSeconds = 300, limit = 25) {
  const cutoff = new Date(Date.now() - timeoutSeconds * 1000);

  const rows = await prisma.callLog.findMany({
    where: {
      status: CALL_STATUS.WHATSAPP_SENT,
      whatsappSentAt: { lte: cutoff },
      whatsappReplied: false,
      lockedAt: null,
    },
    orderBy: { whatsappSentAt: "asc" },
    take: limit,
    include: { order: true },
  });

  const claimed = [];
  for (const row of rows) {
    const lock = await prisma.callLog.updateMany({
      where: {
        id: row.id,
        status: CALL_STATUS.WHATSAPP_SENT,
        whatsappSentAt: { lte: cutoff },
        lockedAt: null,
      },
      data: {
        lockedAt: new Date(),
      },
    });

    if (lock.count === 1) {
      claimed.push(row);
      await logCommunicationEvent(row.orderId, "Fallback to AI Call due to WhatsApp timeout");
      
      // Update order status to indicate fallback
      await prisma.order.update({
        where: { id: row.orderId },
        data: { confirmationStatus: "no_response" }
      });

      logStatus("WHATSAPP_TIMEOUT_CLAIMED", { callLogId: row.id, orderId: row.orderId });
    }
  }

  return claimed;
}

// Safety-net: claim QUEUED rows that were never dialled (e.g. server crashed
// between createOrderWithCallLog and triggerOrderConfirmationCall, or a manual
// order was created without an immediate call attempt).
const QUEUED_STALE_MS = 5 * 60 * 1000; // 5 minutes

export async function claimStaleQueuedCallLogs(limit = 25) {
  const cutoff = new Date(Date.now() - QUEUED_STALE_MS);

  const rows = await prisma.callLog.findMany({
    where: {
      status: CALL_STATUS.QUEUED,
      createdAt: { lte: cutoff },
      retryCount: { lt: MAX_RETRIES },
      lockedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { order: true },
  });

  const claimed = [];
  for (const row of rows) {
    const lock = await prisma.callLog.updateMany({
      where: {
        id: row.id,
        status: CALL_STATUS.QUEUED,
        createdAt: { lte: cutoff },
        lockedAt: null,
      },
      data: {
        lockedAt: new Date(),
        status: CALL_STATUS.IN_PROGRESS,
      },
    });

    if (lock.count === 1) {
      claimed.push(row);
      logStatus("QUEUED_STALE_CLAIMED", { callLogId: row.id, orderId: row.orderId });
    }
  }

  return claimed;
}

// Backward-compatible alias expected by existing cron imports.
export const getOrderCallsForRetry = claimDueRetryCallLogs;

export async function getOrderStats() {
  const [total, pending, confirmed, cancelled, manualReview, invalid, retryScheduled] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { orderStatus: ORDER_STATUS.PENDING } }),
      prisma.order.count({ where: { orderStatus: ORDER_STATUS.CONFIRMED } }),
      prisma.order.count({ where: { orderStatus: ORDER_STATUS.CANCELLED } }),
      prisma.order.count({ where: { orderStatus: ORDER_STATUS.PENDING_MANUAL_REVIEW } }),
      prisma.order.count({ where: { orderStatus: ORDER_STATUS.INVALID } }),
      prisma.callLog.count({ where: { status: CALL_STATUS.RETRY_SCHEDULED } }),
    ]);

  return {
    total,
    pending,
    confirmed,
    cancelled,
    pendingManualReview: manualReview,
    invalid,
    retryScheduled,
  };
}

export async function getRecentOrders(limit = 50) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      callLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}
