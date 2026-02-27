import { useEffect, useState } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  ORDER_STATUS,
  ORDER_CALL_STATUS,
  CALL_INTENT,
  ORDER_MAX_RETRIES,
} from "../constants.js";
import {
  getOrderStats,
  getRecentOrders,
  handleCallResult,
  createOrderWithCallLog,
  getCallLogById,
  setCallLogInProgress,
  updateCallLogVapiId,
} from "../services/orderCallService.server.js";

import {
  triggerOrderConfirmationCall,
  isPermanentOrderVapiError,
} from "../services/vapiOrderService.server.js";

const UI_MAX_RETRIES = ORDER_MAX_RETRIES;
const UI_ORDER_STATUS = ORDER_STATUS;
const UI_CALL_STATUS = ORDER_CALL_STATUS;


export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const [stats, orders] = await Promise.all([
    getOrderStats(),
    getRecentOrders(50),
  ]);
  return { stats, orders };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);


  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();


  if (intent === "create-order") {
    const customerName = String(formData.get("customerName") ?? "").trim();
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
    const totalPriceInput = String(formData.get("totalPrice") ?? "").trim();
    const storeName = String(formData.get("storeName") ?? "").trim() || "Manual";

    if (!customerName || !phoneNumber || !totalPriceInput) {
      return Response.json({ error: "Customer, phone, and amount are required." }, { status: 400 });
    }
    if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      return Response.json({ error: "Phone must be E.164 format, e.g. +917041668245." }, { status: 400 });
    }

    const totalNum = Number(totalPriceInput);
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      return Response.json({ error: "Amount must be greater than 0." }, { status: 400 });
    }

    const shopifyOrderId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    let order, callLog;
    try {
      ({ order, callLog } = await createOrderWithCallLog({
        shopifyOrderId,
        customerName,
        phoneNumber,
        storeName,
        totalPrice: totalNum.toFixed(2),
        orderPlacedDate: new Date(),
      }));
      console.log(
        `[OrdersAction] ACTION=CREATE_ORDER orderId=${order.id} callLogId=${callLog.id} ` +
          `Order Status=${order.orderStatus} Call Status=${callLog.status}`,
      );
    } catch (err) {
      return Response.json({ error: `Failed to create order: ${err.message}` }, { status: 500 });
    }

    const origin = new URL(request.url).origin;

    // Immediately trigger the call — same flow as the Shopify webhook handler.
    try {
      await setCallLogInProgress(callLog.id);

      const vapiRes = await triggerOrderConfirmationCall({
        callLogId: callLog.id,
        customerName,
        phoneNumber,
        storeName: storeName || order.storeName,
        orderId: shopifyOrderId,
        totalPrice: totalNum.toFixed(2),
        overrideBaseUrl: origin,
      });

      if (vapiRes?.id) await updateCallLogVapiId(callLog.id, vapiRes.id);
      console.log(
        `[OrdersAction] ACTION=START_CALL orderId=${order.id} callLogId=${callLog.id} ` +
          `providerStatus=${vapiRes?.status ?? "unknown"} vapiCallId=${vapiRes?.id ?? "n/a"}`,
      );

      return Response.json({
        success: true,
        message: `Order created — calling ${customerName} now.`,
      });
    } catch (err) {
      // Call failed: schedule a retry via handleCallResult so the cron picks it up.
      const reason = String(err?.message ?? "").toLowerCase();
      const mappedIntent =
        isPermanentOrderVapiError(err)
          ? reason.includes("wrong number") || reason.includes("invalid")
            ? CALL_INTENT.WRONG_NUMBER
            : CALL_INTENT.RECALL_REQUEST
          : CALL_INTENT.RECALL_REQUEST;

      await handleCallResult(order.id, mappedIntent, {
        callLogId: callLog.id,
        failureReason: err.message,
      }).catch(() => {});
      console.log(
        `[OrdersAction] ACTION=CREATE_ORDER_CALL_FAIL orderId=${order.id} callLogId=${callLog.id} ` +
          `mappedIntent=${mappedIntent} error=${err.message}`,
      );

      return Response.json({
        success: true,
        message: `Order created for ${customerName}. Call will be retried shortly.`,
      });
    }
  }

  if (intent === "recall-one") {
    const callLogId = String(formData.get("callLogId") ?? "").trim();
    if (!callLogId)
      return Response.json({ error: "Missing callLogId." }, { status: 400 });

    const callLog = await getCallLogById(callLogId);
    if (!callLog)
      return Response.json({ error: "Call log not found." }, { status: 404 });

    const order = callLog.order;
    if (!order)
      return Response.json({ error: "Order not found." }, { status: 404 });

    if (callLog.status === CALL_STATUS.IN_PROGRESS) {
      return Response.json({
        warning: true,
        message: "Call already in progress.",
      });
    }
    if (callLog.status === CALL_STATUS.COMPLETED) {
      return Response.json({
        warning: true,
        message: "Order already completed.",
      });
    }
    if (callLog.retryCount >= MAX_RETRIES) {
      return Response.json({ warning: true, message: "Max retries reached." });
    }

    try {
      const origin = new URL(request.url).origin;
      await setCallLogInProgress(callLogId);

      const vapiRes = await triggerOrderConfirmationCall({
        callLogId,
        customerName: order.customerName,
        phoneNumber: order.phoneNumber,
        storeName: order.storeName,
        orderId: order.shopifyOrderId,
        totalPrice: order.totalPrice,
        overrideBaseUrl: origin,
      });

      if (vapiRes?.id) await updateCallLogVapiId(callLogId, vapiRes.id);

      console.log(
        `[OrdersAction] ACTION=RECALL_START orderId=${order.id} callLogId=${callLogId} ` +
          `vapiCallId=${vapiRes?.id ?? "n/a"}`,
      );

      return Response.json({
        success: true,
        message: `Calling ${order.customerName} for order #${order.shopifyOrderId}`,
      });
    } catch (err) {
      if (isPermanentOrderVapiError(err)) {
        const reason = String(err?.message ?? "").toLowerCase();
        const mappedIntent =
          reason.includes("wrong number") || reason.includes("invalid")
            ? CALL_INTENT.WRONG_NUMBER
            : CALL_INTENT.RECALL_REQUEST;

        await handleCallResult(order.id, mappedIntent, {
          callLogId,
          failureReason: err.message,
        }).catch(() => {});

        return Response.json(
          { error: `Permanent error: ${err.message}` },
          { status: 422 },
        );
      }

      await handleCallResult(order.id, CALL_INTENT.RECALL_REQUEST, {
        callLogId,
        failureReason: err.message,
      }).catch(() => {});

      return Response.json(
        { error: `Retry scheduled: ${err.message}` },
        { status: 500 },
      );
    }
  }



  // New action handlers
  const actionType = formData.get("action");
  const orderId = formData.get("orderId");
  const callLogId = formData.get("callLogId");

  if (actionType === "retry") {
    await retryCallLog(callLogId);
    return { success: true };
  }

  if (actionType === "manual_confirm") {
    await handleCallResult(orderId, CALL_INTENT.CONFIRM, {
      callLogId,
      failureReason: "Manually confirmed from UI",
    });
    return { success: true };
  }

  if (actionType === "manual_cancel") {
    await handleCallResult(orderId, CALL_INTENT.CANCEL, {
      callLogId,
      failureReason: "Manually cancelled from UI",
    });
    return { success: true };
  }

  return Response.json({ error: "Unknown intent." }, { status: 400 });
};

const ORDER_STATUS_COLOR = {
  [UI_ORDER_STATUS.PENDING]: { bg: "#FFF3CD", text: "#856404" },
  [UI_ORDER_STATUS.CONFIRMED]: { bg: "#D4EDDA", text: "#155724" },
  [UI_ORDER_STATUS.CANCELLED]: { bg: "#F8D7DA", text: "#721C24" },
  [UI_ORDER_STATUS.PENDING_MANUAL_REVIEW]: { bg: "#FDE2E4", text: "#9B2226" },
  [UI_ORDER_STATUS.INVALID]: { bg: "#E2E3E5", text: "#383D41" },
};

const CALL_STATUS_COLOR = {
  [UI_CALL_STATUS.QUEUED]: { bg: "#E2E3E5", text: "#383D41" },
  [UI_CALL_STATUS.IN_PROGRESS]: { bg: "#CCE5FF", text: "#004085" },
  [UI_CALL_STATUS.COMPLETED]: { bg: "#D4EDDA", text: "#155724" },
  [UI_CALL_STATUS.RETRY_SCHEDULED]: { bg: "#FFF3CD", text: "#856404" },
  [UI_CALL_STATUS.FAILED]: { bg: "#F8D7DA", text: "#721C24" },
};

function getActionLabel(order, latestLog) {
  if (!latestLog) return "NO_LOG";
  if (latestLog.status === UI_CALL_STATUS.IN_PROGRESS) return "CALL_IN_PROGRESS";
  if (latestLog.status === UI_CALL_STATUS.COMPLETED) return "NO_ACTION";
  if (order.orderStatus !== UI_ORDER_STATUS.PENDING) return "NO_ACTION";
  if ((latestLog.retryCount ?? 0) >= UI_MAX_RETRIES) return "MAX_RETRIES_REACHED";
  return "RECALL_AVAILABLE";
}

function StatusBadge({ label, colors }) {
  const c = colors ?? { bg: "#E2E3E5", text: "#383D41" };
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, background: c.bg, color: c.text, whiteSpace: "nowrap" }}>{label}</span>;
}

function RecallButton({ order }) {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const latestLog = order.callLogs?.[0];

  useEffect(() => {
    if (!fetcher.data) return;
    console.log("[OrdersUI] recall API response", fetcher.data);
    if (fetcher.data.success) shopify.toast.show(fetcher.data.message, { duration: 3500 });
    if (fetcher.data.warning) shopify.toast.show(fetcher.data.message, { isError: true, duration: 5000 });
    if (fetcher.data.error) shopify.toast.show(fetcher.data.error, { isError: true, duration: 6000 });
  }, [fetcher.data, shopify]);

  if (!latestLog) return <span style={{ color: "#C9CCCF", fontSize: "12px" }}>—</span>;
  if (latestLog.status === UI_CALL_STATUS.IN_PROGRESS) return <span style={{ color: "#C9CCCF", fontSize: "12px" }}>In progress...</span>;
  if (latestLog.status === UI_CALL_STATUS.COMPLETED) return <span style={{ color: "#C9CCCF", fontSize: "12px" }}>—</span>;
  if (order.orderStatus !== UI_ORDER_STATUS.PENDING) return <span style={{ color: "#C9CCCF", fontSize: "12px" }}>—</span>;

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="recall-one" />
      <input type="hidden" name="callLogId" value={latestLog.id} />
      <button type="submit" disabled={fetcher.state !== "idle"} style={{ padding: "4px 14px", borderRadius: "20px", border: "none", background: fetcher.state !== "idle" ? "#E4E5E7" : "#008060", color: fetcher.state !== "idle" ? "#6D7175" : "#fff", fontSize: "13px", cursor: fetcher.state !== "idle" ? "not-allowed" : "pointer", fontWeight: 500 }}>
        {fetcher.state !== "idle" ? "Calling..." : "Recall"}
      </button>
    </fetcher.Form>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E4E5E7", borderRadius: "8px", padding: "20px 24px", minWidth: "130px", flex: 1 }}>
      <div style={{ fontSize: "28px", fontWeight: 700, color: color ?? "#202223" }}>{value}</div>
      <div style={{ fontSize: "13px", color: "#6D7175", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

export default function OrdersPage() {
  const { stats, orders } = useLoaderData();
  const { revalidate } = useRevalidator();
  const shopify = useAppBridge();
  const createFetcher = useFetcher();
  const [showCreateModal, setShowCreateModal] = useState(false);

 // ── Auto-refresh every 10 s ─────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(revalidate, 10_000);
    return () => clearInterval(id);
  }, [revalidate]);

  useEffect(() => {
    if (!createFetcher.data) return;
    console.log("[OrdersUI] create-order API response", createFetcher.data);
    if (createFetcher.data.success) {
      shopify.toast.show(createFetcher.data.message, { duration: 3500 });
      setShowCreateModal(false);
      revalidate();
    }
    if (createFetcher.data.error) {
      shopify.toast.show(createFetcher.data.error, { isError: true, duration: 5500 });
    }
  }, [createFetcher.data, shopify, revalidate]);

  useEffect(() => {
    if (!Array.isArray(orders)) return;
    const statusRows = orders.map((order) => {
      const latestLog = order.callLogs?.[0];
      return {
        orderId: order.id,
        shopifyOrderId: order.shopifyOrderId,
        orderStatus: order.orderStatus,
        callStatus: latestLog?.status ?? "—",
        action: getActionLabel(order, latestLog),
      };
    });
    console.table(statusRows);
  }, [orders]);

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#202223" }}>Order Confirmation Calls</h1>
          <button type="button" onClick={() => setShowCreateModal(true)} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#008060", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>+ Create Order</button>
        </div>
        <p style={{ margin: "6px 0 0", color: "#6D7175", fontSize: "14px" }}>Auto-refreshes every 10 seconds</p>
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
        <StatCard label="Total Orders" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} color="#856404" />
        <StatCard label="Confirmed" value={stats.confirmed} color="#155724" />
        <StatCard label="Cancelled" value={stats.cancelled} color="#721C24" />
        <StatCard label="Manual Review" value={stats.pendingManualReview} color="#9B2226" />
        <StatCard label="Invalid" value={stats.invalid} color="#383D41" />
        <StatCard label="Retry Scheduled" value={stats.retryScheduled} color="#004085" />
      </div>

      <div style={{ background: "#fff", border: "1px solid #E4E5E7", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E4E5E7" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#202223" }}>Recent Orders ({orders.length})</h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#F6F6F7" }}>
                {["Order #", "Customer", "Phone", "Total", "Order Status", "Call Status", "Retries", "Created", "Action"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#6D7175", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#6D7175" }}>No orders yet.</td></tr>
              ) : (
                orders.map((order) => {
                  const latestLog = order.callLogs?.[0];
                  const callStatus = latestLog?.status ?? "—";
                  const retries = latestLog?.retryCount ?? 0;
                  const orderColors = ORDER_STATUS_COLOR[order.orderStatus] ?? ORDER_STATUS_COLOR[UI_ORDER_STATUS.PENDING];
                  const callColors = CALL_STATUS_COLOR[callStatus] ?? CALL_STATUS_COLOR[UI_CALL_STATUS.QUEUED];
                  return (
                    <tr key={order.id} style={{ borderTop: "1px solid #F1F2F3" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>#{order.shopifyOrderId.slice(-8)}</td>
                      <td style={{ padding: "12px 16px" }}>{order.customerName}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{order.phoneNumber}</td>
                      <td style={{ padding: "12px 16px" }}>₹{order.totalPrice}</td>
                      <td style={{ padding: "12px 16px" }}><StatusBadge label={order.orderStatus.replaceAll("_", " ")} colors={orderColors} /></td>
                      <td style={{ padding: "12px 16px" }}>{latestLog ? <StatusBadge label={callStatus} colors={callColors} /> : <span style={{ color: "#6D7175" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: retries > 0 ? "#856404" : "#6D7175" }}>{retries}</td>
                      <td style={{ padding: "12px 16px", color: "#6D7175", fontSize: "12px" }}>{new Date(order.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "12px 16px" }}><RecallButton order={order} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }} onClick={() => setShowCreateModal(false)}>
          <div style={{ width: "100%", maxWidth: "520px", background: "#fff", borderRadius: "10px", border: "1px solid #E4E5E7", boxShadow: "0 12px 30px rgba(0,0,0,0.2)", padding: "18px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: "18px", color: "#202223" }}>Create Order</h3>
            <createFetcher.Form method="post" style={{ display: "grid", gap: "10px" }}>
              <input type="hidden" name="intent" value="create-order" />
              <label style={{ fontSize: "13px", color: "#6D7175" }}>Customer Name
                <input name="customerName" required placeholder="e.g. Dharmik" style={{ width: "100%", marginTop: "4px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #C9CCCF" }} />
              </label>
              <label style={{ fontSize: "13px", color: "#6D7175" }}>Phone Number (E.164)
                <input name="phoneNumber" required placeholder="+917041668245" style={{ width: "100%", marginTop: "4px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #C9CCCF" }} />
              </label>
              <label style={{ fontSize: "13px", color: "#6D7175" }}>Total Amount
                <input name="totalPrice" required placeholder="499.00" inputMode="decimal" style={{ width: "100%", marginTop: "4px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #C9CCCF" }} />
              </label>
              <label style={{ fontSize: "13px", color: "#6D7175" }}>Store Name (optional)
                <input name="storeName" placeholder="fullstack-developer-2" style={{ width: "100%", marginTop: "4px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #C9CCCF" }} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #C9CCCF", background: "#fff", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={createFetcher.state !== "idle"} style={{ padding: "8px 12px", borderRadius: "8px", border: "none", background: createFetcher.state !== "idle" ? "#AFC7BD" : "#008060", color: "#fff", cursor: createFetcher.state !== "idle" ? "not-allowed" : "pointer", fontWeight: 600 }}>
                  {createFetcher.state !== "idle" ? "Creating..." : "Create"}
                </button>
              </div>
            </createFetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <div style={{ padding: "24px", color: "#721C24" }}>
      <h2>Orders dashboard error</h2>
      <p>Check server logs for details.</p>
    </div>
  );
}
