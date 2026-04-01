import { useState, useEffect } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server.js";
import {
  WelcomeBanner,
  DashboardStatsCards,
  ConfirmationRateChart,
  ChannelPerformance,
  RecentActivity,
} from "../components/DashboardWidgets.jsx";
import { DataTable, Drawer, ActiveCallOverlay } from "../components/DashboardComponents.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";

/* ═══════════════════════════════════════════════════════════════
   LOADER — all real data from Prisma
   ═══════════════════════════════════════════════════════════════ */
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Order stats ──────────────────────────────────────────────
  const [
    totalOrders,
    confirmedOrders,
    cancelledOrders,
    pendingOrders,
    pendingManualReview,
    invalidOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "CONFIRMED" } }),
    prisma.order.count({ where: { orderStatus: "CANCELLED" } }),
    prisma.order.count({ where: { orderStatus: "PENDING" } }),
    prisma.order.count({ where: { orderStatus: "PENDING_MANUAL_REVIEW" } }),
    prisma.order.count({ where: { orderStatus: "INVALID" } }),
  ]);

  // ── Call log stats ───────────────────────────────────────────
  const [
    totalCallLogs,
    completedCalls,
    failedCalls,
    retryCalls,
    inProgressCalls,
    queuedCalls,
    whatsappSentCalls,
  ] = await Promise.all([
    prisma.callLog.count(),
    prisma.callLog.count({ where: { status: "COMPLETED" } }),
    prisma.callLog.count({ where: { status: "FAILED" } }),
    prisma.callLog.count({ where: { status: "RETRY_SCHEDULED" } }),
    prisma.callLog.count({ where: { status: "IN_PROGRESS" } }),
    prisma.callLog.count({ where: { status: "QUEUED" } }),
    prisma.callLog.count({ where: { status: "WHATSAPP_SENT" } }),
  ]);

  // ── Today's stats ────────────────────────────────────────────
  const [todayOrders, todayCalls, todayWhatsApp] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.callLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.callLog.count({ where: { whatsappSentAt: { gte: todayStart } } }),
  ]);

  // ── Confirmation rate ────────────────────────────────────────
  const totalDecided = confirmedOrders + cancelledOrders;
  const confirmationRate = totalDecided > 0
    ? Math.round((confirmedOrders / totalDecided) * 100)
    : 0;

  // ── Last 7 days daily confirmation rates for chart ───────────
  const last7Days = [];
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const [dayConfirmed, dayTotal] = await Promise.all([
      prisma.order.count({
        where: { orderStatus: "CONFIRMED", updatedAt: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.order.count({
        where: {
          orderStatus: { in: ["CONFIRMED", "CANCELLED"] },
          updatedAt: { gte: dayStart, lte: dayEnd },
        },
      }),
    ]);

    const dayRate = dayTotal > 0 ? Math.round((dayConfirmed / dayTotal) * 100) : 0;
    last7Days.push(dayRate);
    dayLabels.push(dayStart.toLocaleDateString("en-US", { weekday: "short" }));
  }

  // ── Channel performance (real counts) ────────────────────────
  const channelData = {
    voiceCalls: completedCalls + failedCalls + inProgressCalls + retryCalls,
    whatsapp: whatsappSentCalls,
    manualReview: pendingManualReview,
  };
  const channelTotal = channelData.voiceCalls + channelData.whatsapp + channelData.manualReview || 1;

  // ── Recent orders with call logs ─────────────────────────────
  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      callLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const serializedOrders = recentOrders.map((order) => {
    const latestCall = order.callLogs[0];
    return {
      id: order.id,
      shopifyOrderId: order.shopifyOrderId,
      customerName: order.customerName,
      phone: order.phoneNumber,
      storeName: order.storeName,
      totalPrice: order.totalPrice,
      orderStatus: order.orderStatus,
      callStatus: latestCall?.status || "N/A",
      retryCount: latestCall?.retryCount || 0,
      lastIntent: latestCall?.lastIntent || null,
      failureReason: latestCall?.failureReason || null,
      vapiCallId: latestCall?.vapiCallId || null,
      whatsappSent: latestCall?.whatsappSentAt ? true : false,
      whatsappReplied: latestCall?.whatsappReplied || false,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  });

  // ── Also include general CustomerCall data ───────────────────
  const [generalTotal, generalAnswered, generalFailed, generalCalling] = await Promise.all([
    prisma.customerCall.count(),
    prisma.customerCall.count({ where: { status: "answered" } }),
    prisma.customerCall.count({ where: { status: "failed" } }),
    prisma.customerCall.count({ where: { status: "calling" } }),
  ]);

  const recentGeneralCalls = await prisma.customerCall.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const serializedGeneralCalls = recentGeneralCalls.map((call) => ({
    id: call.id,
    customerName: call.customerName,
    phone: call.phone,
    status: call.status,
    retryCount: call.retryCount,
    failureReason: call.failureReason,
    vapiCallId: call.vapiCallId,
    createdAt: call.createdAt.toISOString(),
  }));

  return {
    stats: {
      totalOrders,
      confirmedOrders,
      cancelledOrders,
      pendingOrders,
      pendingManualReview,
      invalidOrders,
      totalCallLogs,
      completedCalls,
      failedCalls,
      retryCalls,
      inProgressCalls,
      queuedCalls,
      whatsappSentCalls,
      todayOrders,
      todayCalls,
      todayWhatsApp,
      confirmationRate,
      last7Days,
      dayLabels,
      channelData,
      channelTotal,
      // General calls
      generalTotal,
      generalAnswered,
      generalFailed,
      generalCalling,
    },
    orders: serializedOrders,
    generalCalls: serializedGeneralCalls,
  };
};

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { stats, orders, generalCalls } = useLoaderData();
  const shopify = useAppBridge();
  const { revalidate } = useRevalidator();
  const { isDark, toggleTheme } = useTheme();
  const [selectedCall, setSelectedCall] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const id = setInterval(revalidate, 10000);
    return () => clearInterval(id);
  }, [revalidate]);

  // Combine orders into the table-ready format
  const tableCalls = orders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    phone: o.phone,
    status: mapOrderStatusToCallStatus(o.orderStatus, o.callStatus),
    retryCount: o.retryCount,
    duration: "—",
    createdAt: new Date(o.createdAt).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    shopifyOrderId: o.shopifyOrderId,
    orderStatus: o.orderStatus,
    callStatus: o.callStatus,
    totalPrice: o.totalPrice,
    storeName: o.storeName,
    lastIntent: o.lastIntent,
    failureReason: o.failureReason,
    vapiCallId: o.vapiCallId,
    whatsappSent: o.whatsappSent,
    whatsappReplied: o.whatsappReplied,
  }));

  // Filter by search term
  const filteredCalls = searchTerm.trim()
    ? tableCalls.filter((c) => {
        const q = searchTerm.toLowerCase();
        return (
          (c.customerName || "").toLowerCase().includes(q) ||
          (c.phone || "").includes(q) ||
          (c.shopifyOrderId || "").toLowerCase().includes(q)
        );
      })
    : tableCalls;

  // Widget-compatible stats object
  const widgetStats = {
    total: stats.totalOrders,
    confirmed: stats.confirmedOrders,
    cancelled: stats.cancelledOrders,
    retrying: stats.retryCalls + stats.pendingManualReview,
    pending: stats.pendingOrders + stats.queuedCalls,
    calling: stats.inProgressCalls + stats.generalCalling,
  };

  return (
    <div className={`min-h-screen p-6 lg:p-10 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">Dashboard</h1>
          <p className="text-sm font-medium text-slate-500">Real-time overview of your AI confirmation agent</p>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={toggleTheme} className={`p-3 rounded-2xl border-2 transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-amber-400' : 'bg-white border-slate-100 shadow-sm text-slate-400'}`}>
             {isDark ? <SunIcon /> : <MoonIcon />}
           </button>
        </div>
      </header>

      <WelcomeBanner stats={widgetStats} realStats={stats} isAiActive={stats.inProgressCalls > 0 || stats.generalCalling > 0 || stats.totalOrders > 0} />
      <DashboardStatsCards stats={widgetStats} realStats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <ConfirmationRateChart stats={stats} />
        <ChannelPerformance stats={stats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <RecentActivity orders={tableCalls} />
        </div>
        <div className="lg:col-span-8">
          <div className={`rounded-[2.5rem] border-2 shadow-sm overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="p-8 border-b-2 dark:border-slate-800 flex items-center justify-between">
               <h3 className="text-xl font-black">Recent Orders</h3>
               <div className="flex items-center gap-3">
                 <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border-2 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-50 bg-slate-50'}`}>
                   <SearchIcon className="w-4 h-4 text-slate-400" />
                   <input
                     placeholder="Search orders..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="bg-transparent border-none outline-none text-sm font-medium w-40"
                   />
                 </div>
               </div>
            </div>
            <DataTable 
              calls={filteredCalls} 
              onRowClick={(c) => { setSelectedCall(c); setIsDrawerOpen(true); }} 
              selectedId={selectedCall?.id} 
            />
          </div>
        </div>
      </div>

      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} call={selectedCall} />
      <ActiveCallOverlay isActive={widgetStats.calling > 0} customerName={tableCalls.find(c => c.callStatus === 'IN_PROGRESS')?.customerName} />
    </div>
  );
}

/** Map order + call status to the display status the DataTable expects */
function mapOrderStatusToCallStatus(orderStatus, callStatus) {
  if (orderStatus === "CONFIRMED") return "answered";
  if (orderStatus === "CANCELLED") return "failed";
  if (callStatus === "IN_PROGRESS") return "calling";
  if (callStatus === "RETRY_SCHEDULED") return "retrying";
  if (callStatus === "WHATSAPP_SENT") return "retrying";
  if (callStatus === "QUEUED") return "pending";
  if (orderStatus === "PENDING_MANUAL_REVIEW") return "retrying";
  if (orderStatus === "INVALID") return "failed";
  return "pending";
}

const SunIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>;
const MoonIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>;
const SearchIcon = ({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
