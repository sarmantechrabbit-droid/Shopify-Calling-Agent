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




export const MAX_NO_RESPONSE_RETRIES = 3; // After 3 NO_RESPONSE retries → WhatsApp fallback
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

export async function createOrderWithCallLog({
  shopifyOrderId,
  customerName,
  phoneNumber,
  storeName,
  totalPrice,
  orderPlacedDate,
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
        orderStatus: ORDER_STATUS.PENDING,
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
      status: { in: [CALL_STATUS.QUEUED, CALL_STATUS.RETRY_SCHEDULED, CALL_STATUS.IN_PROGRESS] },
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
    const callLog =
      (opts.callLogId
        ? await tx.callLog.findUnique({ where: { id: opts.callLogId }, include: { order: true } })
        : null) ||
      (opts.vapiCallId
        ? await tx.callLog.findFirst({ where: { vapiCallId: opts.vapiCallId }, include: { order: true } })
        : null) ||
      (await tx.callLog.findFirst({
        where: { orderId },
        orderBy: { createdAt: "desc" },
        include: { order: true },
      }));

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
        tx.order.update({ where: { id: orderId }, data: { orderStatus: ORDER_STATUS.CONFIRMED } }),
        tx.callLog.update({
          where: { id: callLog.id },
          data: { ...baseCallUpdate, status: CALL_STATUS.COMPLETED, nextRetryAt: null },
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

    if (normalizedIntent === CALL_INTENT.CANCEL) {
      const [order, call] = await Promise.all([
        tx.order.update({ where: { id: orderId }, data: { orderStatus: ORDER_STATUS.CANCELLED } }),
        tx.callLog.update({
          where: { id: callLog.id },
          data: { ...baseCallUpdate, status: CALL_STATUS.COMPLETED, nextRetryAt: null },
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

    const nextRetryCount = callLog.retryCount + 1;

    // ── WhatsApp fallback: after MAX_NO_RESPONSE_RETRIES failed attempts ──
    // Triggers on ALL retry intents (NO_RESPONSE, RECALL_REQUEST, BUSY)
    // because Vapi reports unanswered calls as recall_request/busy, not NO_RESPONSE
    if (nextRetryCount >= MAX_NO_RESPONSE_RETRIES) {
      const now = new Date();
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

      logStatus("WHATSAPP_FALLBACK_TRIGGERED", {
        orderId,
        callLogId: call.id,
        intent: normalizedIntent,
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
      });

      // Send WhatsApp message outside the transaction (fire-and-forget with logging)
      // We need the full callLog with order for the message builder
      const fullCallLog = { ...call, order };
      sendWhatsAppFallback(fullCallLog).catch((err) => {
        console.error(
          `[WhatsApp] Failed to send fallback for callLogId=${call.id}:`,
          err.message,
        );
      });

      return {
        orderStatus: order.orderStatus,
        callStatus: call.status,
        retryCount: call.retryCount,
        whatsappSent: true,
      };
    }

    if (nextRetryCount >= MAX_RETRIES) {
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
