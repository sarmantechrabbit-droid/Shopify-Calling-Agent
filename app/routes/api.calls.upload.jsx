/**
 * POST /api/calls/upload
 *
 * Public API endpoint that accepts a JSON array of customers and bulk-inserts
 * them as pending call records.  The /api/calls/start endpoint (or the
 * dashboard "Start All Calls" button) is then used to fire the actual Vapi
 * calls.
 *
 * Request body (application/json):
 *   {
 *     "customers": [
 *       { "customerName": "Jane Doe", "phone": "+917041668245" },
 *       { "customerName": "John Smith", "phone": "+12125551234" }
 *     ]
 *   }
 *
 * Successful response:
 *   { "success": true, "created": 10, "skipped": 2, "errors": [...] }
 *
 * Security note:
 *   This endpoint is intentionally left without Shopify session auth so that
 *   external scripts / CRM integrations can push customers via API key or
 *   webhook.  For production, consider adding Bearer token validation using
 *   an API_SECRET env var checked here.
 */

import { createCallsBatch } from "../services/callService.server.js";
import {
  validatePhone,
  checkAllowedPrefix,
} from "../utils/validation.server.js";

// ─── Action (POST) ────────────────────────────────────────────────────────────

export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body. Send { customers: [...] }" },
      { status: 400 },
    );
  }

  const customers = body?.customers;

  if (!Array.isArray(customers) || customers.length === 0) {
    return Response.json(
      { error: "Body must contain a non-empty 'customers' array." },
      { status: 400 },
    );
  }

  if (customers.length > 500) {
    return Response.json(
      {
        error:
          "Maximum 500 customers per upload batch. Split your list and call again.",
      },
      { status: 400 },
    );
  }

  // ── Validate each row ─────────────────────────────────────────────────────
  const valid = [];
  const errors = [];

  for (let i = 0; i < customers.length; i++) {
    const row = customers[i] ?? {};
    const rawName = row.customerName ?? row.name ?? "";
    const rawPhone = row.phone ?? row.phoneNumber ?? "";

    // Validate name
    const customerName = String(rawName).trim();
    if (!customerName) {
      errors.push({ index: i, error: "Missing customerName" });
      continue;
    }

    // Validate phone (E.164)
    const phoneResult = validatePhone(rawPhone);
    if (phoneResult.error) {
      errors.push({ index: i, customerName, raw: rawPhone, error: phoneResult.error });
      continue;
    }

    // Validate allowed prefix
    const prefixError = checkAllowedPrefix(phoneResult.phone);
    if (prefixError) {
      errors.push({
        index: i,
        customerName,
        phone: phoneResult.phone,
        error: prefixError.error,
      });
      continue;
    }

    valid.push({ customerName, phone: phoneResult.phone });
  }

  if (valid.length === 0) {
    return Response.json(
      {
        error: "No valid customers found. See 'details' for per-row errors.",
        details: errors,
      },
      { status: 400 },
    );
  }

  // ── Batch insert ──────────────────────────────────────────────────────────
  try {
    const result = await createCallsBatch(valid);
    return Response.json({
      success: true,
      created: result.count,
      skipped: errors.length,
      // Only include errors array when there were validation failures
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("[Upload] DB batch insert failed:", err);
    return Response.json(
      { error: "Database error during batch insert. Try again." },
      { status: 500 },
    );
  }
}

// ─── Loader (GET) — health-check ─────────────────────────────────────────────

export async function loader() {
  return Response.json({
    status: "Calls upload endpoint active",
    usage: "POST /api/calls/upload with { customers: [{ customerName, phone }] }",
  });
}
