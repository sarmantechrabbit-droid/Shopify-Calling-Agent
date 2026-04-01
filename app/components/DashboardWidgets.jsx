import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext.jsx";

/**
 * Premium Welcome Banner with Waveform Animation
 * Now uses REAL stats from the database
 */
export function WelcomeBanner({ stats, realStats, isAiActive }) {
  const { isDark } = useTheme();

  const todayOrders = realStats?.todayOrders || 0;
  const confirmationRate = realStats?.confirmationRate || 0;
  const todayCalls = realStats?.todayCalls || 0;
  const todayWhatsApp = realStats?.todayWhatsApp || 0;

  return (
    <div
      className={`relative overflow-hidden rounded-[2.5rem] p-8 lg:p-12 mb-8 ${isDark ? "bg-indigo-900/40" : "bg-white shadow-xl shadow-slate-200/50"}`}
    >
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 ${
              isAiActive
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20"
            }`}>
              <div className={`w-2 h-2 rounded-full ${isAiActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {isAiActive ? "AI Active" : "AI Idle"}
            </span>
            <span
              className={`text-sm font-medium ${isDark ? "text-indigo-300" : "text-slate-400"}`}
            >
              System status: {isAiActive ? "Operational" : "Standby"}
            </span>
          </div>
          <h2
            className={`text-4xl lg:text-5xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}
          >
            Dashboard Overview
          </h2>
          <p
            className={`text-lg max-w-xl ${isDark ? "text-indigo-200/70" : "text-slate-500"}`}
          >
            {todayOrders > 0 ? (
              <>
                Your AI agent is actively handling
                <span className="text-violet-600 font-bold">{todayOrders} orders</span> today
                {confirmationRate > 0 && (
                  <>
                    with a
                    <span className="text-emerald-500 font-bold">
                      {confirmationRate}% confirmation rate
                    </span>
                  </>
                )}
                .
              </>
            ) : (
              <>No new orders today. Your AI agent is on standby and ready to handle incoming COD orders.</>
            )}
          </p>
          <div className="flex items-center gap-8 pt-2">
            <div>
              <p className="text-2xl font-black text-violet-600">{todayCalls}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Calls Today
              </p>
            </div>
            <div
              className={`w-px h-8 ${isDark ? "bg-indigo-800" : "bg-slate-100"}`}
            />
            <div>
              <p className="text-2xl font-black text-violet-600">{todayWhatsApp}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                WhatsApp Sent
              </p>
            </div>
            <div
              className={`w-px h-8 ${isDark ? "bg-indigo-800" : "bg-slate-100"}`}
            />
            <div>
              <p className="text-2xl font-black text-emerald-500">{confirmationRate}%</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Success Rate
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="w-32 h-32 lg:w-48 lg:h-48 rounded-full bg-violet-600 flex items-center justify-center shadow-2xl shadow-violet-600/40 relative z-10">
            <div className="flex items-end gap-1.5 h-12 lg:h-16">
              {[0.4, 0.7, 1, 0.6, 0.8, 0.5, 0.9, 0.4].map((h, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: isAiActive
                      ? [`${h * 20}%`, `${h * 100}%`, `${h * 20}%`]
                      : [`${h * 30}%`],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1 + i * 0.1,
                    ease: "easeInOut",
                  }}
                  className="w-1.5 lg:w-2 bg-white/90 rounded-full"
                />
              ))}
            </div>
          </div>
          {isAiActive && (
            <>
              <div className="absolute inset-0 -m-8 rounded-full border border-violet-600/10 animate-ping opacity-20" />
              <div className="absolute inset-0 -m-16 rounded-full border border-violet-600/5 animate-pulse opacity-10" />
            </>
          )}
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}

/**
 * 5-row Stats Cards with REAL data
 */
export function DashboardStatsCards({ stats, realStats }) {
  const { isDark } = useTheme();

  // Calculate real trends (percentage of total)
  const total = stats.total || 1;
  const confirmedPct = stats.total > 0 ? Math.round((stats.confirmed / total) * 100) : 0;
  const cancelledPct = stats.total > 0 ? Math.round((stats.cancelled / total) * 100) : 0;

  const items = [
    {
      label: "Total Orders",
      value: stats.total,
      color: "violet",
      trend: `${stats.total}`,
      trendLabel: "all time",
    },
    {
      label: "Confirmed",
      value: stats.confirmed,
      color: "emerald",
      trend: `${confirmedPct}%`,
      trendLabel: "rate",
      isPositive: true,
    },
    {
      label: "Cancelled",
      value: stats.cancelled,
      color: "rose",
      trend: `${cancelledPct}%`,
      trendLabel: "rate",
      isPositive: false,
    },
    {
      label: "On Hold",
      value: stats.retrying,
      color: "amber",
      trend: `${stats.retrying}`,
      trendLabel: "active",
      isPositive: null,
    },
    {
      label: "Pending",
      value: stats.pending,
      color: "indigo",
      trend: `${stats.pending}`,
      trendLabel: "waiting",
      isPositive: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {items.map((item, i) => (
        <div
          key={i}
          className={`p-6 rounded-[2rem] border-2 transition-all hover:scale-[1.02] cursor-default ${
            isDark
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-100 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className={`p-3 rounded-2xl bg-${item.color}-500/10 text-${item.color}-500`}
            >
              <Icon type={item.label} />
            </div>
            {item.isPositive !== undefined && item.isPositive !== null && (
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                  item.isPositive
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-rose-500/10 text-rose-500"
                }`}
              >
                {item.trend}
              </span>
            )}
          </div>
          <p className="text-3xl font-black mb-1">
            {item.value.toLocaleString()}
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Confirmation Rate Chart — Premium SVG Area/Line chart
 */
export function ConfirmationRateChart({ stats }) {
  const { isDark } = useTheme();
  const data = stats.last7Days || [0, 0, 0, 0, 0, 0, 0];
  const days = stats.dayLabels || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const overallRate = stats.confirmationRate || 0;
  const [hoveredIndex, setHoveredIndex] = React.useState(null);

  // Determine performance label
  let perfLabel = "No Data";
  let perfColor = "text-slate-400";
  if (overallRate >= 80) { perfLabel = "High Performance"; perfColor = "text-emerald-500"; }
  else if (overallRate >= 50) { perfLabel = "Good Performance"; perfColor = "text-amber-500"; }
  else if (overallRate > 0) { perfLabel = "Needs Improvement"; perfColor = "text-rose-500"; }

  // SVG chart dimensions
  const W = 500, H = 200, PAD_L = 36, PAD_R = 16, PAD_T = 24, PAD_B = 32;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxVal = Math.max(...data, 1);

  // Build points
  const points = data.map((v, i) => ({
    x: PAD_L + (i / (data.length - 1)) * chartW,
    y: PAD_T + chartH - (v / 100) * chartH,
    val: v,
  }));

  const linePoints = points.map(p => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${PAD_L},${PAD_T + chartH} ${linePoints} ${PAD_L + chartW},${PAD_T + chartH}`;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  return (
    <div
      className={`p-8 rounded-[2.5rem] border-2 h-full ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black mb-1">Confirmation Rate</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Last 7 Days Performance
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${perfColor}`}>{overallRate}%</p>
          <p className={`text-[10px] font-bold ${perfColor} opacity-60 uppercase`}>
            {perfLabel}
          </p>
        </div>
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Gradient fill under the line */}
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? "#8b5cf6" : "#7c3aed"} stopOpacity="0.35" />
            <stop offset="100%" stopColor={isDark ? "#8b5cf6" : "#7c3aed"} stopOpacity="0.02" />
          </linearGradient>
          {/* Glow for the line */}
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yLabels.map((label) => {
          const y = PAD_T + chartH - (label / 100) * chartH;
          return (
            <g key={label}>
              <line
                x1={PAD_L} y1={y} x2={PAD_L + chartW} y2={y}
                stroke={isDark ? "#1e293b" : "#f1f5f9"}
                strokeWidth="1"
              />
              <text
                x={PAD_L - 8} y={y + 4}
                textAnchor="end"
                className="text-[10px]"
                fill={isDark ? "#475569" : "#94a3b8"}
                fontWeight="700"
              >
                {label}%
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <motion.polygon
          points={areaPoints}
          fill="url(#areaGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />

        {/* Line */}
        <motion.polyline
          points={linePoints}
          fill="none"
          stroke={isDark ? "#a78bfa" : "#7c3aed"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lineGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* Data dots + labels */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Outer ring */}
            <motion.circle
              cx={p.x} cy={p.y} r="8"
              fill={isDark ? "#0f172a" : "#ffffff"}
              stroke={isDark ? "#a78bfa" : "#7c3aed"}
              strokeWidth="2"
              opacity="0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="hover:opacity-100 cursor-pointer"
            />
            {/* Inner dot */}
            <motion.circle
              cx={p.x} cy={p.y} r="4"
              fill={i === data.length - 1 ? (isDark ? "#c084fc" : "#7c3aed") : (isDark ? "#64748b" : "#cbd5e1")}
              stroke={isDark ? "#0f172a" : "#ffffff"}
              strokeWidth="2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.08, type: "spring" }}
            />

            {/* Hit area for hover */}
            <circle
              cx={p.x} cy={p.y} r="15"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />

            {/* Value label on hover (always show for each point) */}
            <motion.g
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: hoveredIndex === i ? 1 : 0, y: hoveredIndex === i ? 0 : 5 }}
              transition={{ duration: 0.2 }}
              pointerEvents="none"
            >
              <rect
                x={p.x - 14} y={p.y - 22} width="28" height="14" rx="4"
                fill={isDark ? "#7c3aed" : "#7c3aed"}
              />
              <text
                x={p.x} y={p.y - 12}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="8"
                fontWeight="800"
              >
                {p.val}%
              </text>
            </motion.g>

            {/* Day label */}
            <text
              x={p.x} y={H - 6}
              textAnchor="middle"
              fill={isDark ? "#475569" : "#94a3b8"}
              fontSize="10"
              fontWeight="700"
            >
              {days[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Channel Performance — uses REAL data
 */
export function ChannelPerformance({ stats }) {
  const { isDark } = useTheme();

  const channelData = stats.channelData || { voiceCalls: 0, whatsapp: 0, manualReview: 0 };
  const totalInteractions = stats.channelTotal || 1;

  const channels = [
    {
      name: "AI Voice Calls",
      progress: Math.round((channelData.voiceCalls / totalInteractions) * 100),
      color: "violet",
      count: channelData.voiceCalls,
    },
    {
      name: "WhatsApp Automation",
      progress: Math.round((channelData.whatsapp / totalInteractions) * 100),
      color: "emerald",
      count: channelData.whatsapp,
    },
    {
      name: "Manual Review",
      progress: Math.round((channelData.manualReview / totalInteractions) * 100),
      color: "slate",
      count: channelData.manualReview,
    },
  ];

  return (
    <div
      className={`p-8 rounded-[2.5rem] border-2 h-full ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
    >
      <h3 className="text-xl font-black mb-8">Channel Performance</h3>
      <div className="space-y-8">
        {channels.map((c, i) => (
          <div key={i} className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="font-bold">{c.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {c.count} interactions
                </p>
              </div>
              <p className={`font-black text-${c.color}-500`}>{c.progress}%</p>
            </div>
            <div
              className={`h-3 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${c.progress}%` }}
                className={`h-full rounded-full bg-gradient-to-r from-${c.color}-600 to-${c.color}-400 shadow-lg shadow-${c.color}-500/20`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Recent Activity — uses REAL order data
 */
export function RecentActivity({ orders }) {
  const { isDark } = useTheme();

  // Determine status display
  const getStatusInfo = (order) => {
    if (order.orderStatus === "CONFIRMED" || order.status === "answered") {
      return { label: "confirmed", color: "emerald", icon: "Confirmed" };
    }
    if (order.orderStatus === "CANCELLED" || order.status === "failed") {
      return { label: "cancelled", color: "rose", icon: "Cancelled" };
    }
    if (order.status === "calling") {
      return { label: "calling", color: "blue", icon: "On Hold" };
    }
    if (order.status === "retrying") {
      return { label: "on hold", color: "amber", icon: "On Hold" };
    }
    return { label: "pending", color: "indigo", icon: "Pending" };
  };

  return (
    <div
      className={`p-8 rounded-[2.5rem] border-2 mb-10 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black">Recent AI Activity</h3>
        <span className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {orders.length} total
        </span>
      </div>
      <div className="space-y-6">
        {orders.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No orders yet. Orders will appear here when COD orders arrive.</p>
        )}
        {orders.slice(0, 6).map((order, i) => {
          const statusInfo = getStatusInfo(order);
          return (
            <div key={order.id || i} className="flex items-center gap-6 group">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center relative ${isDark ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"}`}
              >
                <Icon
                  type={statusInfo.icon}
                  className="w-6 h-6"
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 ${isDark ? "border-slate-900" : "border-white"} bg-${statusInfo.color}-500`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold group-hover:text-violet-600 transition-colors truncate">
                  Order{" "}
                  <span className="text-slate-400 font-medium">
                    #{order.shopifyOrderId || order.id?.slice(-6) || "—"}
                  </span>{" "}
                  {statusInfo.label === "confirmed" && "was confirmed by AI"}
                  {statusInfo.label === "cancelled" && "was cancelled"}
                  {statusInfo.label === "calling" && "is being called"}
                  {statusInfo.label === "on hold" && "is awaiting retry"}
                  {statusInfo.label === "pending" && "is pending"}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                  {order.customerName || "Unknown"} • {order.createdAt}
                  {order.totalPrice && ` • ₹${order.totalPrice}`}
                </p>
              </div>
              <div className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold bg-${statusInfo.color}-500/10 text-${statusInfo.color}-500`}>
                {statusInfo.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Internal Icons
function Icon({ type, className = "w-5 h-5" }) {
  if (type === "Total Orders")
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    );
  if (type === "Confirmed")
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  if (type === "Cancelled")
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  if (type === "On Hold")
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const ChevronRightIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
