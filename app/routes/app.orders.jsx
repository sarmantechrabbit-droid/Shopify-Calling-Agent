/**
 * Premium Order Confirmation Calls Page
 *
 * Redesigned to look like a premium AI SaaS product
 * Features: Dark hero, glassmorphism, animations, insights, enhanced table
 */

// app/routes/app.orders.jsx

import { useEffect, useState, useCallback } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import prisma from "../db.server.js";
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

// Premium Order Components
import {
  OrderPageHeader,
  OrderStatsCards,
  OrderAIInsightsPanel,
  OrderDataTable,
  OrderDrawer,
  CreateOrderModal,
  TestCallModal,
  ActiveCallIndicator,
} from "../components/OrderComponents.jsx";

import { useTheme } from "../contexts/ThemeContext.jsx";

const UI_MAX_RETRIES = ORDER_MAX_RETRIES;
const UI_ORDER_STATUS = ORDER_STATUS;
const UI_CALL_STATUS = ORDER_CALL_STATUS;

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const [stats, orders] = await Promise.all([
    getOrderStats(),
    getRecentOrders(50),
  ]);

  // Transform orders for the UI
  const transformedOrders = orders.map((order) => ({
    ...order,
    createdAt: order.createdAt
      ? new Date(order.createdAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
  }));

  return { stats, orders: transformedOrders };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  if (intent === "create-order") {
    const customerName = String(formData.get("customerName") ?? "").trim();
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
    const totalPriceInput = String(formData.get("totalPrice") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const storeName =
      String(formData.get("storeName") ?? "").trim() || "Manual";

    if (!customerName || !phoneNumber || !totalPriceInput) {
      console.log("[OrdersAction] ❌ Validation failed:", { customerName, phoneNumber, totalPriceInput, address });
      return Response.json(
        { error: "Customer, phone, and amount are required." },
        { status: 400 },
      );
    }
    if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      return Response.json(
        { error: "Phone must be E.164 format, e.g. +917041668245." },
        { status: 400 },
      );
    }

    const totalNum = Number(totalPriceInput);
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      return Response.json(
        { error: "Amount must be greater than 0." },
        { status: 400 },
      );
    }

    const shopifyOrderId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    let order, callLog;
    console.log(`[OrdersAction] ✍️ Creating order with address="${address}"`);
    try {
      ({ order, callLog } = await createOrderWithCallLog({
        shopifyOrderId,
        customerName,
        phoneNumber,
        storeName,
        totalPrice: totalNum.toFixed(2),
        orderPlacedDate: new Date(),
        address,
      }));
      console.log(
        `[OrdersAction] ACTION=CREATE_ORDER orderId=${order.id} callLogId=${callLog.id} ` +
          `Order Status=${order.orderStatus} Call Status=${callLog.status}`,
      );
    } catch (err) {
      return Response.json(
        { error: `Failed to create order: ${err.message}` },
        { status: 500 },
      );
    }

    const config = await prisma.appConfig.findFirst({
      where: { OR: [{ shop: "default" }, { id: "default" }] },
    });
    const whatsappEnabled = config?.whatsappEnabled ?? true;

    if (whatsappEnabled) {
      try {
        await prisma.callLog.update({
          where: { id: callLog.id },
          data: { status: "WHATSAPP_SENT", whatsappSentAt: new Date() },
        });

        const { sendWhatsAppFallback } = await import("../utils/whatsappFallback.server.js");
        await sendWhatsAppFallback({ ...callLog, order });

        return Response.json({
          success: true,
          message: `Order created — WhatsApp confirmation sent to ${customerName}.`,
        });
      } catch (err) {
        console.error("[OrdersAction] WhatsApp fail, falling back", err);
        // Fall through to call logic
      }
    }

    const origin = new URL(request.url).origin;

    // Immediately trigger the call
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
      const reason = String(err?.message ?? "").toLowerCase();
      const mappedIntent = isPermanentOrderVapiError(err)
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

    if (callLog.status === UI_CALL_STATUS.IN_PROGRESS) {
      return Response.json({
        warning: true,
        message: "Call already in progress.",
      });
    }
    if (callLog.status === UI_CALL_STATUS.COMPLETED) {
      return Response.json({
        warning: true,
        message: "Order already completed.",
      });
    }
    if (callLog.retryCount >= UI_MAX_RETRIES) {
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

  if (intent === "test-call") {
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
    if (!phoneNumber) {
      return Response.json(
        { error: "Phone number is required." },
        { status: 400 },
      );
    }

    // Check E.164 format
    if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      return Response.json(
        { error: "Phone must be E.164 format, e.g. +917041668245." },
        { status: 400 },
      );
    }

    try {
      const origin = new URL(request.url).origin;
      const vapiRes = await triggerOrderConfirmationCall({
        callLogId: "TEST_CALL_" + Date.now(),
        customerName: "Dharmik Guest",
        phoneNumber,
        storeName: "Antigravity AI Store",
        orderId: "TEST-1234",
        totalPrice: "999.00",
        overrideBaseUrl: origin,
      });

      console.log(
        `[OrdersAction] ACTION=TEST_CALL phone=${phoneNumber} vapiCallId=${vapiRes?.id ?? "n/a"}`,
      );

      return Response.json({
        success: true,
        message:
          "Test call triggered! You should receive a call in a few seconds.",
      });
    } catch (err) {
      console.error("[OrdersAction] Test call failed:", err.message);
      return Response.json(
        { error: `Test call failed: ${err.message}` },
        { status: 500 },
      );
    }
  }

  return Response.json({ error: "Unknown intent." }, { status: 400 });
};

export default function PremiumOrdersPage() {
  const { stats, orders } = useLoaderData();
  const { revalidate } = useRevalidator();
  const shopify = useAppBridge();
  const createFetcher = useFetcher();
  const recallFetcher = useFetcher();
  const testCallFetcher = useFetcher(); // Added testCallFetcher
  const { isDark } = useTheme();

  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Find order by ID helper
  const findOrderById = (id) => orders.find((o) => o.id === id);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(revalidate, 10_000);
    return () => clearInterval(id);
  }, [revalidate]);

  // Toast: create order
  useEffect(() => {
    if (!createFetcher.data) return;
    console.log("[OrdersUI] create-order API response", createFetcher.data);
    if (createFetcher.data.success) {
      shopify.toast.show(createFetcher.data.message, { duration: 3500 });
      setShowCreateModal(false);
      revalidate();
    }
    if (createFetcher.data.error) {
      shopify.toast.show(createFetcher.data.error, {
        isError: true,
        duration: 5500,
      });
    }
  }, [createFetcher.data, shopify, revalidate]);

  // Toast: recall
  useEffect(() => {
    if (!recallFetcher.data) return;
    console.log("[OrdersUI] recall API response", recallFetcher.data);
    if (recallFetcher.data.success)
      shopify.toast.show(recallFetcher.data.message, { duration: 3500 });
    if (recallFetcher.data.warning)
      shopify.toast.show(recallFetcher.data.message, {
        isError: true,
        duration: 5000,
      });
    if (recallFetcher.data.error)
      shopify.toast.show(recallFetcher.data.error, {
        isError: true,
        duration: 6000,
      });
  }, [recallFetcher.data, shopify]);

  // Toast: test-call
  useEffect(() => {
    if (!testCallFetcher.data) return;
    if (testCallFetcher.data.success) {
      shopify.toast.show(testCallFetcher.data.message, { duration: 4000 });
      setShowTestModal(false);
    }
    if (testCallFetcher.data.error) {
      shopify.toast.show(testCallFetcher.data.error, {
        isError: true,
        duration: 5000,
      });
    }
  }, [testCallFetcher.data, shopify]);

  // Handlers
  const handleTestCall = useCallback(() => {
    setShowTestModal(true);
  }, []);

  const handleAnalytics = useCallback(() => {
    shopify.toast.show("Analytics dashboard - coming soon!", {
      duration: 3000,
    });
  }, [shopify]);

  const handleSettings = useCallback(() => {
    shopify.toast.show("Settings - coming soon!", { duration: 3000 });
  }, [shopify]);

  const handleRowClick = useCallback((order) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
  }, []);

  const handleRecall = useCallback(
    (order) => {
      const latestLog = order.callLogs?.[0];
      if (!latestLog) return;

      recallFetcher.submit(
        {
          intent: "recall-one",
          callLogId: latestLog.id,
        },
        { method: "POST" },
      );
    },
    [recallFetcher],
  );

  const handleCreateOrder = useCallback(
    (formData) => {
      createFetcher.submit(
        {
          intent: "create-order",
          customerName: formData.customerName,
          phoneNumber: formData.phoneNumber,
          totalPrice: formData.totalPrice,
          storeName: formData.storeName,
          address: formData.address,
        },
        { method: "POST" },
      );
    },
    [createFetcher],
  );

  const onSubmitTestCall = useCallback(
    (phoneNumber) => {
      testCallFetcher.submit(
        {
          intent: "test-call",
          phoneNumber,
        },
        { method: "POST" },
      );
    },
    [testCallFetcher],
  );

  // Check if there's an active call
  const hasActiveCall = orders.some((order) => {
    const latestLog = order.callLogs?.[0];
    return latestLog?.status === "IN_PROGRESS";
  });

  const activeCallOrder = orders.find((order) => {
    const latestLog = order.callLogs?.[0];
    return latestLog?.status === "IN_PROGRESS";
  });

  return (
    <div
      className={`min-h-screen p-6 lg:p-8 ${isDark ? "bg-dark-950" : "bg-light-50"}`}
    >
      {/* Premium Header */}
      <OrderPageHeader
        onTestCall={handleTestCall}
        onAnalytics={handleAnalytics}
        onSettings={handleSettings}
        totalOrders={stats.total}
        isAiActive={true}
      />

      {/* Stats Cards */}
      <OrderStatsCards stats={stats} />

      {/* AI Insights Panel */}
      <OrderAIInsightsPanel insights={{}} />

      {/* Quick Actions Bar */}
      <div className="solid-card p-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-dark-400 text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Auto-refreshing every 10 seconds
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-premium btn-primary flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Order
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <OrderDataTable
        orders={orders}
        onRowClick={handleRowClick}
        selectedId={selectedOrder?.id}
        onRecall={handleRecall}
      />

      {/* Order Detail Drawer */}
      <OrderDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        order={selectedOrder}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateOrder}
        isLoading={createFetcher.state !== "idle"}
      />

      {/* Test Call Modal */}
      <TestCallModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        onSubmit={onSubmitTestCall}
        isLoading={testCallFetcher.state !== "idle"}
      />

      {/* Active Call Overlay */}
      <ActiveCallIndicator
        isActive={hasActiveCall}
        customerName={activeCallOrder?.customerName}
        onEndCall={() => {}}
      />
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen p-8 flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-3xl p-10 max-w-md text-center shadow-premium-lg">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-rose-500/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Dashboard Unavailable</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          The orders dashboard encountered an error. This usually happens after a schema update or database change.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full btn-premium bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reload Dashboard
        </button>
      </div>
    </div>
  );
}
