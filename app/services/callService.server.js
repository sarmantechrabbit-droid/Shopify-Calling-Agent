/**
 * Call Service — all Prisma operations for the CustomerCall model.
 *
 * STATUS LIFECYCLE
 * ────────────────
 *  pending   → Just uploaded / created, not yet dialled.
 *  calling   → Vapi API call has been fired; waiting for webhook.
 *  answered  → Vapi webhook reported a successful / completed call.
 *  retrying  → Call failed; scheduled for a cron retry (nextRetryAt set).
 *  failed    → Permanently failed (max retries exceeded OR permanent error).
 *
 * RETRY COUNTER SEMANTICS
 * ────────────────────────
 *  retryCount = number of *retry* Vapi calls made by the cron (not counting
 *  the initial attempt).  The cron increments it BEFORE dialling to prevent
 *  double-counting on server restart.
 */

import prisma from "../db.server.js";
import { GENERAL_CALL_STATUS, GENERAL_MAX_RETRIES } from "../constants.js";

const CALL_STATUS = GENERAL_CALL_STATUS;
const MAX_RETRIES = GENERAL_MAX_RETRIES;

export { CALL_STATUS, MAX_RETRIES };


/** How long to wait between retry attempts. */
export const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a single pending call record.
 */
export async function createCall({ customerName, phone }) {
  return prisma.customerCall.create({
    data: {
      customerName,
      phone,
      status: CALL_STATUS.PENDING,
    },
  });
}

/**
 * Batch-insert multiple customers as pending calls.
 * Uses createMany for a single DB round-trip.
 *
 * @param {Array<{ customerName: string, phone: string }>} customers
 * @returns {{ count: number }}
 */
export async function createCallsBatch(customers) {
  return prisma.customerCall.createMany({
    data: customers.map(({ customerName, phone }) => ({
      customerName,
      phone,
      status: CALL_STATUS.PENDING,
    })),
    // Allow duplicates — the merchant may intentionally re-add a number.
    skipDuplicates: false,
  });
}

// ─── Status transitions ───────────────────────────────────────────────────────

/**
 * Mark a call as "calling" — Vapi API call is in flight.
 * Stamps lastCallAt to the current time.
 */
export async function setCallCalling(id) {
  return prisma.customerCall.update({
    where: { id },
    data: {
      status: CALL_STATUS.CALLING,
      lastCallAt: new Date(),
      // Clear any stale failure info from a previous attempt
      failureReason: null,
    },
  });
}

/**
 * Mark a call as "retrying" — failed but eligible for another attempt.
 * Sets nextRetryAt so the cron knows when to fire.
 * Does NOT increment retryCount (the cron does that immediately before dialling).
 *
 * @param {string}  id            - Internal DB id
 * @param {string?} failureReason - Last error message from Vapi
 */
export async function setCallRetrying(id, failureReason = null) {
  return prisma.customerCall.update({
    where: { id },
    data: {
      status: CALL_STATUS.RETRYING,
      failureReason,
      nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
    },
  });
}

/**
 * Permanently mark a call as failed.
 *
 * @param {string}  id            - Internal DB id
 * @param {string?} failureReason - Reason for permanent failure
 */
export async function markCallFailed(id, failureReason = null) {
  return prisma.customerCall.update({
    where: { id },
    data: {
      status: CALL_STATUS.FAILED,
      ...(failureReason !== null ? { failureReason } : {}),
    },
  });
}

/**
 * Mark a call as answered (successful completion).
 */
export async function markCallAnswered(id) {
  return prisma.customerCall.update({
    where: { id },
    data: {
      status: CALL_STATUS.ANSWERED,
      failureReason: null,
      nextRetryAt: null,
    },
  });
}

/**
 * Generic status update — use specific helpers above where possible.
 */
export async function updateCallStatus(id, status) {
  return prisma.customerCall.update({
    where: { id },
    data: { status },
  });
}

// ─── Retry mechanics ──────────────────────────────────────────────────────────

/**
 * Called by the cron BEFORE making a retry Vapi call.
 * Increments retryCount and sets status to "calling".
 *
 * @param {string} id
 */
export async function startRetryAttempt(id) {
  return prisma.customerCall.update({
    where: { id },
    data: {
      status: CALL_STATUS.CALLING,
      retryCount: { increment: 1 },
      lastCallAt: new Date(),
      failureReason: null,
    },
  });
}

/**
 * Attach the Vapi call ID returned by the API so that incoming webhooks
 * can correlate the event back to our DB record.
 */
export async function updateCallWithVapiId(id, vapiCallId) {
  return prisma.customerCall.update({
    where: { id },
    data: { vapiCallId },
  });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all calls currently in "pending" status (awaiting initial dial).
 * Used by the /api/calls/start endpoint.
 */
export async function getAllPendingCalls() {
  return prisma.customerCall.findMany({
    where: { status: CALL_STATUS.PENDING },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Returns all "retrying" calls whose nextRetryAt has passed.
 * Used by the cron job every minute.
 */
export async function getPendingCallsForRetry() {
  return prisma.customerCall.findMany({
    where: {
      status: CALL_STATUS.RETRYING,
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: "asc" },
  });
}

/**
 * Returns dashboard stats in a single DB round-trip.
 */
export async function getStats() {
  const [total, pending, calling, answered, failed, retrying] =
    await Promise.all([
      prisma.customerCall.count(),
      prisma.customerCall.count({ where: { status: CALL_STATUS.PENDING } }),
      prisma.customerCall.count({ where: { status: CALL_STATUS.CALLING } }),
      prisma.customerCall.count({ where: { status: CALL_STATUS.ANSWERED } }),
      prisma.customerCall.count({ where: { status: CALL_STATUS.FAILED } }),
      prisma.customerCall.count({ where: { status: CALL_STATUS.RETRYING } }),
    ]);

  return { total, pending, calling, answered, failed, retrying };
}

/**
 * Returns the most recent `limit` calls for the dashboard table.
 */
export async function getRecentCalls(limit = 50) {
  return prisma.customerCall.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Fetch a single call record by its internal DB id.
 */
export async function getCallById(id) {
  return prisma.customerCall.findUnique({ where: { id } });
}
