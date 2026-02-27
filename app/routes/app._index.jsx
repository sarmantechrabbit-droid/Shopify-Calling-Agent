/**
 * Dashboard — AI Call Manager
 *
 * Loader  → returns { stats, calls } (Shopify-authenticated)
 * Action  → handles single "start-call" form submission
 *
 * Additional features via separate route fetchers:
 *   POST /api/calls/upload  ← batch CSV upload
 *   POST /api/calls/start   ← fire all pending calls
 *
 * UI auto-refreshes every 10 seconds via useRevalidator.
 */

// app/routes/app._index.jsx

import { GENERAL_CALL_STATUS, GENERAL_MAX_RETRIES } from "../constants.js";
import { authenticate } from "../shopify.server";
import {
  getStats,
  getRecentCalls,
  createCall,
  getCallById,
  setCallCalling,
  setCallRetrying,
  updateCallWithVapiId,
  markCallFailed,
} from "../services/callService.server.js";

import {
  initiateVapiCall,
  isPermanentVapiError,
} from "../services/vapiService.server.js";
import {
  validatePhone,
  checkAllowedPrefix,
} from "../utils/validation.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const [stats, calls] = await Promise.all([getStats(), getRecentCalls(50)]);
  return { stats, calls };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");


  // ── Intent: call-one — dial a specific existing record ──────────────────
  if (intent === "call-one") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      return Response.json({ error: "Missing call ID." }, { status: 400 });
    }

    const call = await getCallById(id);
    if (!call) {
      return Response.json({ error: "Call record not found." }, { status: 404 });
    }
    if (call.status === "answered") {
      return Response.json(
        { error: "This call is already answered." },
        { status: 400 },
      );
    }
    if (call.status === "calling") {
      return Response.json(
        { error: "This call is already in progress." },
        { status: 400 },
      );
    }

    try {
      await setCallCalling(id);
      const vapiRes = await initiateVapiCall({
        customerName: call.customerName,
        phone: call.phone,
        callId: id,
      });
      if (!vapiRes?.id) throw new Error("Vapi returned no call ID.");
      await updateCallWithVapiId(id, vapiRes.id);
      return Response.json({
        success: true,
        message: `Call started for ${call.customerName} (${call.phone}).`,
      });
    } catch (vapiErr) {
      const permanent = isPermanentVapiError(vapiErr);
      if (permanent) {
        await markCallFailed(id, vapiErr.message);
      } else {
        await setCallRetrying(id, vapiErr.message);
      }
      return Response.json({
        warning: true,
        message: permanent
          ? `Failed permanently: ${vapiErr.message}`
          : `Vapi rejected: ${vapiErr.message}. Cron will retry in 5 min.`,
      });
    }
  }

  // ── Intent: create — add a new customer and dial immediately ────────────
  const customerName = String(formData.get("customerName") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();

  if (!customerName || !rawPhone) {
    return Response.json(
      { error: "Customer name and phone number are required." },
      { status: 400 },
    );
  }

  const phoneResult = validatePhone(rawPhone);
  if (phoneResult.error) {
    return Response.json({ error: phoneResult.error }, { status: 400 });
  }

  const prefixError = checkAllowedPrefix(phoneResult.phone);
  if (prefixError) {
    return Response.json({ error: prefixError.error }, { status: 400 });
  }

  const phone = phoneResult.phone;

  let call;
  try {
    call = await createCall({ customerName, phone });
  } catch (err) {
    console.error("[action] DB createCall failed:", err);
    return Response.json(
      { error: "Database error. Please try again." },
      { status: 500 },
    );
  }

  try {
    const vapiRes = await initiateVapiCall({ customerName, phone, callId: call.id });
    if (!vapiRes?.id) throw new Error("Vapi returned no call ID.");
    await updateCallWithVapiId(call.id, vapiRes.id);
    return Response.json({
      success: true,
      message: `Call initiated for ${customerName}. Status: ${vapiRes.status ?? "queued"}.`,
    });
  } catch (vapiErr) {
    const permanent = isPermanentVapiError(vapiErr);
    if (permanent) {
      await markCallFailed(call.id, vapiErr.message);
    } else {
      await setCallRetrying(call.id, vapiErr.message);
    }
    return Response.json({
      warning: true,
      message: permanent
        ? `Call saved but failed permanently: ${vapiErr.message}. Will NOT retry automatically.`
        : `Call saved. Vapi rejected: ${vapiErr.message}. Cron will retry in 5 min.`,
    });
  }
};

// ─── UI Helpers ───────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  pending: { bg: "#E9ECEF", text: "#495057", border: "#DEE2E6" },
  calling: { bg: "#CCE5FF", text: "#004085", border: "#B8D4F9" },
  answered: { bg: "#D1E7DD", text: "#0A3622", border: "#A3CFBB" },
  retrying: { bg: "#FFF3CD", text: "#664D03", border: "#FFE69C" },
  failed: { bg: "#F8D7DA", text: "#58151C", border: "#F1AEB5" },
};

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] ?? {
    bg: "#F8F9FA",
    text: "#495057",
    border: "#DEE2E6",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "600",
        letterSpacing: "0.3px",
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/**
 * Per-row "Call Now" button.
 * Uses its own fetcher so each row is independent.
 * Visible for: pending, failed, retrying.
 * Hidden for: calling (already in progress), answered (done).
 */
function CallButton({ call }) {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.success) {
      shopify.toast.show(fetcher.data.message, { duration: 4000 });
    }
    if (fetcher.data.warning) {
      shopify.toast.show(fetcher.data.message, { isError: true, duration: 7000 });
    }
    if (fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true, duration: 5000 });
    }
  }, [fetcher.data, shopify]);

  // Don't show button for terminal/in-progress statuses
  if (call.status === "answered" || call.status === "calling") {
    return (
      <span style={{ color: "#C9CCCF", fontSize: "12px" }}>
        {call.status === "calling" ? "In call…" : "—"}
      </span>
    );
  }

  const isLoading = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="call-one" />
      <input type="hidden" name="id" value={call.id} />
      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: "4px 14px",
          fontSize: "12px",
          fontWeight: "600",
          color: isLoading ? "#8C9196" : "#008060",
          background: isLoading ? "#F1F2F3" : "#F0FFF8",
          border: `1px solid ${isLoading ? "#C9CCCF" : "#95C9B4"}`,
          borderRadius: "20px",
          cursor: isLoading ? "default" : "pointer",
          whiteSpace: "nowrap",
          transition: "background .15s, color .15s",
        }}
      >
        {isLoading ? "Calling…" : "📞 Call"}
      </button>
    </fetcher.Form>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        background: "#FFFFFF",
        border: "1px solid #E4E5E7",
        borderRadius: "8px",
        padding: "16px 20px",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
      }}
    >
      <div
        style={{
          fontSize: "30px",
          fontWeight: "700",
          color: accent ?? "#202223",
          lineHeight: 1.1,
        }}
      >
        {value ?? 0}
      </div>
      <div
        style={{
          marginTop: "4px",
          fontSize: "12px",
          color: "#6D7175",
          fontWeight: "500",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #C9CCCF",
  borderRadius: "6px",
  fontSize: "14px",
  color: "#202223",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .15s",
};

const textareaStyle = {
  ...inputStyle,
  fontFamily: "monospace",
  fontSize: "13px",
  resize: "vertical",
  minHeight: "120px",
};

// ─── CSV parsing helper ────────────────────────────────────────────────────────

function parseCSV(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, i) => {
      const [rawName, rawPhone] = line.split(",").map((s) => s.trim());
      return { index: i, customerName: rawName ?? "", phone: rawPhone ?? "" };
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { stats, calls } = useLoaderData();
  const fetcher = useFetcher();        // single call form
  const uploadFetcher = useFetcher();  // batch upload
  const startFetcher = useFetcher();   // start all pending
  const shopify = useAppBridge();
  const { revalidate, state: revalState } = useRevalidator();

  const [form, setForm] = useState({ customerName: "", phone: "" });
  const [csvText, setCsvText] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Auto-refresh every 10 s ─────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      revalidate();
      setLastRefresh(new Date());
    }, 10_000);
    return () => clearInterval(id);
  }, [revalidate]);

  // ── Toast: single call form ──────────────────────────────────────────────
  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.success) {
      shopify.toast.show(fetcher.data.message, { duration: 5000 });
      setForm({ customerName: "", phone: "" });
      revalidate();
    }
    if (fetcher.data.warning) {
      shopify.toast.show(fetcher.data.message, { isError: true, duration: 8000 });
      setForm({ customerName: "", phone: "" });
      revalidate();
    }
    if (fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true, duration: 5000 });
    }
  }, [fetcher.data, shopify, revalidate]);

  // ── Toast: batch upload ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uploadFetcher.data) return;
    if (uploadFetcher.data.success) {
      const { created, skipped } = uploadFetcher.data;
      shopify.toast.show(
        `Uploaded ${created} call(s) as pending.${skipped > 0 ? ` ${skipped} row(s) skipped.` : ""}`,
        { duration: 5000 },
      );
      setCsvText("");
      revalidate();
    }
    if (uploadFetcher.data.error) {
      shopify.toast.show(uploadFetcher.data.error, { isError: true, duration: 7000 });
    }
  }, [uploadFetcher.data, shopify, revalidate]);

  // ── Toast: start all calls ───────────────────────────────────────────────
  useEffect(() => {
    if (!startFetcher.data) return;
    if (startFetcher.data.success) {
      const { started, failed } = startFetcher.data;
      const msg =
        started === 0
          ? "No pending calls to start."
          : `Started ${started} call(s).${failed > 0 ? ` ${failed} failed — will retry via cron.` : ""}`;
      shopify.toast.show(msg, { duration: 6000 });
      revalidate();
    }
    if (startFetcher.data?.error) {
      shopify.toast.show(startFetcher.data.error, { isError: true, duration: 5000 });
    }
  }, [startFetcher.data, shopify, revalidate]);

  // ── Upload CSV handler ───────────────────────────────────────────────────
  const handleUpload = useCallback(() => {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      shopify.toast.show("No rows found. Use format: Name, +91XXXXXXXXXX", {
        isError: true,
        duration: 5000,
      });
      return;
    }
    uploadFetcher.submit(
      JSON.stringify({ customers: rows }),
      {
        method: "POST",
        action: "/api/calls/upload",
        encType: "application/json",
      },
    );
  }, [csvText, uploadFetcher, shopify]);

  // ── Start all pending calls ───────────────────────────────────────────────
  const handleStartAll = useCallback(() => {
    startFetcher.submit(
      JSON.stringify({}),
      {
        method: "POST",
        action: "/api/calls/start",
        encType: "application/json",
      },
    );
  }, [startFetcher]);

  const isSingleSubmitting = fetcher.state !== "idle";
  const isUploading = uploadFetcher.state !== "idle";
  const isStarting = startFetcher.state !== "idle";
  const isRefreshing = revalState === "loading";

  return (
    <s-page heading="AI Call Dashboard">

      {/* ── Stats overview ──────────────────────────────────────────────── */}
      <s-section heading="Overview">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} accent="#495057" />
          <StatCard label="Calling" value={stats.calling} accent="#004085" />
          <StatCard label="Answered" value={stats.answered} accent="#0A3622" />
          <StatCard label="Retrying" value={stats.retrying} accent="#664D03" />
          <StatCard label="Failed" value={stats.failed} accent="#58151C" />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#6D7175" }}>
            {isRefreshing
              ? "Refreshing…"
              : `Last updated: ${formatDate(lastRefresh)} · Auto-refreshes every 10 s`}
          </p>
          <s-button
            variant="primary"
            onClick={handleStartAll}
            {...(isStarting ? { loading: true } : {})}
            {...(stats.pending === 0 ? { disabled: true } : {})}
          >
            {isStarting ? "Starting…" : `Start All ${stats.pending > 0 ? `(${stats.pending})` : ""} Pending`}
          </s-button>
        </div>
      </s-section>

      {/* ── Batch Upload ─────────────────────────────────────────────────── */}
      <s-section heading="Batch Upload">
        <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#6D7175" }}>
          Paste one customer per line in the format{" "}
          <code style={{ background: "#F1F2F3", padding: "1px 5px", borderRadius: "3px" }}>
            Customer Name, +CountryCodeNumber
          </code>
          . Lines starting with <code>#</code> are ignored. After uploading,
          click <strong>Start All Pending</strong> above to dial.
        </p>
        <textarea
          placeholder={
            "# Example:\nJane Doe, +917041668245\nJohn Smith, +12125551234\nAlice Kumar, +919876543210"
          }
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={textareaStyle}
        />
        <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
          <s-button
            variant="primary"
            onClick={handleUpload}
            {...(isUploading ? { loading: true } : {})}
            {...(!csvText.trim() ? { disabled: true } : {})}
          >
            {isUploading ? "Uploading…" : "Upload & Queue"}
          </s-button>
          {csvText.trim() && (
            <span style={{ fontSize: "12px", color: "#6D7175" }}>
              {parseCSV(csvText).length} row(s) detected
            </span>
          )}
        </div>
        {uploadFetcher.data?.errors?.length > 0 && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px 14px",
              background: "#FFF3CD",
              border: "1px solid #FFE69C",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#664D03",
            }}
          >
            <strong>Skipped rows:</strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              {uploadFetcher.data.errors.map((e, i) => (
                <li key={i}>
                  Row {e.index + 1}
                  {e.customerName ? ` (${e.customerName})` : ""}: {e.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </s-section>

      {/* ── Single call form ─────────────────────────────────────────────── */}
      <s-section heading="Start Single AI Call">
        <fetcher.Form method="post" style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: "1 1 200px" }}>
              <label
                htmlFor="customerName"
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#202223",
                }}
              >
                Customer Name
              </label>
              <input
                id="customerName"
                name="customerName"
                type="text"
                placeholder="e.g. Jane Smith"
                value={form.customerName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, customerName: e.target.value }))
                }
                required
                autoComplete="off"
                style={inputStyle}
              />
            </div>

            <div style={{ flex: "1 1 200px" }}>
              <label
                htmlFor="phone"
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#202223",
                }}
              >
                Phone Number (E.164)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+917041668245"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                required
                autoComplete="tel"
                style={inputStyle}
              />
            </div>

            <div style={{ flex: "0 0 auto" }}>
              <s-button
                type="submit"
                variant="primary"
                {...(isSingleSubmitting ? { loading: true } : {})}
              >
                {isSingleSubmitting ? "Starting…" : "Start AI Call"}
              </s-button>
            </div>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#6D7175" }}>
            Retries automatically every 5 min on no-answer (max {3} retries).
            Phone must include country code, e.g. +917041668245.
          </p>
        </fetcher.Form>
      </s-section>

      {/* ── Calls table ──────────────────────────────────────────────────── */}
      <s-section heading={`Recent Calls (${calls.length})`}>
        {calls.length === 0 ? (
          <s-paragraph>
            No calls yet — upload a batch or start a single call above.
          </s-paragraph>
        ) : (
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #E4E5E7",
              borderRadius: "8px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
                background: "#FFFFFF",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#F6F6F7",
                    borderBottom: "1px solid #E4E5E7",
                  }}
                >
                  {[
                    "Customer",
                    "Phone",
                    "Status",
                    "Retries",
                    "Failure Reason",
                    "Next Retry",
                    "Created",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#202223",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.map((call, i) => (
                  <tr
                    key={call.id}
                    style={{
                      borderBottom:
                        i < calls.length - 1 ? "1px solid #E4E5E7" : "none",
                      background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFB",
                    }}
                  >
                    {/* Customer */}
                    <td
                      style={{
                        padding: "9px 14px",
                        fontWeight: "500",
                        color: "#202223",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {call.customerName}
                    </td>

                    {/* Phone */}
                    <td
                      style={{
                        padding: "9px 14px",
                        color: "#6D7175",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {call.phone}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "9px 14px" }}>
                      <StatusBadge status={call.status} />
                    </td>

                    {/* Retry count */}
                    <td
                      style={{
                        padding: "9px 14px",
                        textAlign: "center",
                        color: call.retryCount > 0 ? "#664D03" : "#6D7175",
                        fontWeight: call.retryCount > 0 ? "600" : "400",
                      }}
                    >
                      {call.retryCount}
                    </td>

                    {/* Failure reason */}
                    <td
                      style={{
                        padding: "9px 14px",
                        color: "#58151C",
                        fontSize: "12px",
                        maxWidth: "220px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={call.failureReason ?? ""}
                    >
                      {call.failureReason ?? "—"}
                    </td>

                    {/* Next retry */}
                    <td
                      style={{
                        padding: "9px 14px",
                        color: "#664D03",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {call.status === "retrying" && call.nextRetryAt
                        ? formatDate(call.nextRetryAt)
                        : "—"}
                    </td>

                    {/* Created */}
                    <td
                      style={{
                        padding: "9px 14px",
                        color: "#6D7175",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(call.createdAt)}
                    </td>

                    {/* Action — per-row Call button */}
                    <td style={{ padding: "9px 14px" }}>
                      <CallButton call={call} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
