import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext.jsx";

// ============================================================================
// ORDER PAGE HEADER - Premium Light Theme
// ============================================================================

export function OrderPageHeader({
  onTestCall,
  onSettings,
  onAnalytics,
  totalOrders,
  isAiActive = true,
}) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      {/* Main Header Card - Soft Gradient Background */}
      <div
        className={`
        relative overflow-hidden rounded-2xl border
        ${
          isDark
            ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700/50"
            : "bg-gradient-to-br from-white via-slate-50/50 to-white border-slate-200/60"
        }
      `}
        style={
          !isDark
            ? {
                boxShadow:
                  "0 4px 24px -4px rgba(0,0,0,0.06), 0 12px 40px -8px rgba(0,0,0,0.04)",
              }
            : {}
        }
      >
        {/* Soft Background Accent - Light Mode */}
        {!isDark && (
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/60 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
        )}

        <div className="relative px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Title & Description */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {isAiActive && !isDark && (
                  <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-xl" />
                )}
                <div
                  className={`
                  relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm
                  ${
                    isAiActive
                      ? isDark
                        ? "bg-gradient-to-br from-indigo-500 to-blue-500"
                        : "bg-indigo-600 shadow-indigo-200"
                      : isDark
                        ? "bg-slate-700"
                        : "bg-slate-100"
                  }
                `}
                >
                  <svg
                    className={`w-7 h-7 ${isAiActive ? "text-white" : isDark ? "text-white" : "text-indigo-600"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1
                    className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Order Confirmation Calls
                  </h1>
                  {isAiActive && (
                    <span
                      className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${
                        isDark
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }
                    `}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      AI Active
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  AI-powered order confirmation system
                </p>
              </div>
            </div>

            {/* Right: Stats & Actions */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Order Count Badge */}
              <div
                className={`
                px-5 py-3 rounded-xl border
                ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-50 border border-slate-200"}
              `}
              >
                <p
                  className={`text-xs uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Total Orders
                </p>
                <p
                  className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {totalOrders || 0}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onTestCall}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all active:scale-95
                    ${
                      isDark
                        ? "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm"
                    }
                  `}
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
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  Test Call
                </button>

                {/* <button
                  onClick={onAnalytics}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all active:scale-95
                    ${
                      isDark
                        ? "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm"
                    }
                  `}
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Analytics
                </button> */}

                <button
                  onClick={onSettings}
                  className={`
                    p-2 rounded-lg transition-all active:scale-95
                    ${
                      isDark
                        ? "bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
                        : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm"
                    }
                  `}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>

                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className={`
                    w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-95
                    ${
                      isDark
                        ? "bg-slate-700 hover:bg-slate-600 text-amber-400"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }
                  `}
                  title={isDark ? "Switch to Light" : "Switch to Dark"}
                >
                  {isDark ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// ORDER STATS CARDS - Premium Light Design with Icons
// ============================================================================

const orderCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

export function OrderStatsCards({ stats }) {
  const { isDark } = useTheme();

  const cards = [
    {
      label: "Total Orders",
      value: stats.total || 0,
      icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
      color: "blue",
    },
    {
      label: "Pending",
      value: stats.pending || 0,
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "amber",
    },
    {
      label: "Confirmed",
      value: stats.confirmed || 0,
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "emerald",
    },
    {
      label: "Cancelled",
      value: stats.cancelled || 0,
      icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "rose",
    },
    {
      label: "Manual Review",
      value: stats.pendingManualReview || 0,
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
      color: "violet",
    },
    {
      label: "Invalid",
      value: stats.invalid || 0,
      icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
      color: "slate",
    },
  ];

  const colorMap = {
    blue: {
      bg: isDark ? "bg-blue-500/10" : "bg-blue-50",
      text: isDark ? "text-blue-400" : "text-blue-600",
      border: isDark ? "border-blue-500/20" : "border-blue-100",
      iconBg: isDark ? "bg-blue-500/20" : "bg-blue-100",
    },
    amber: {
      bg: isDark ? "bg-amber-500/10" : "bg-amber-50",
      text: isDark ? "text-amber-400" : "text-amber-600",
      border: isDark ? "border-amber-500/20" : "border-amber-100",
      iconBg: isDark ? "bg-amber-500/20" : "bg-amber-100",
    },
    emerald: {
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      text: isDark ? "text-emerald-400" : "text-emerald-600",
      border: isDark ? "border-emerald-500/20" : "border-emerald-100",
      iconBg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
    },
    rose: {
      bg: isDark ? "bg-rose-500/10" : "bg-rose-50",
      text: isDark ? "text-rose-400" : "text-rose-600",
      border: isDark ? "border-rose-500/20" : "border-rose-100",
      iconBg: isDark ? "bg-rose-500/20" : "bg-rose-100",
    },
    violet: {
      bg: isDark ? "bg-violet-500/10" : "bg-violet-50",
      text: isDark ? "text-violet-400" : "text-violet-600",
      border: isDark ? "border-violet-500/20" : "border-violet-100",
      iconBg: isDark ? "bg-violet-500/20" : "bg-violet-100",
    },
    slate: {
      bg: isDark ? "bg-slate-500/10" : "bg-slate-50",
      text: isDark ? "text-slate-400" : "text-slate-600",
      border: isDark ? "border-slate-500/20" : "border-slate-100",
      iconBg: isDark ? "bg-slate-500/20" : "bg-slate-100",
    },
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          custom={i}
          variants={orderCardVariants}
          initial="hidden"
          animate="visible"
          className={`
            group p-4 rounded-xl border transition-all hover:-translate-y-0.5
            ${
              isDark
                ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
                : "bg-white border-slate-200/60 hover:shadow-md"
            }
          `}
          style={!isDark ? { boxShadow: "0 1px 3px rgba(0,0,0,0.04)" } : {}}
        >
          <div
            className={`
            w-9 h-9 rounded-lg flex items-center justify-center mb-3
            ${colorMap[card.color].iconBg} ${colorMap[card.color].text}
          `}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={card.icon}
              />
            </svg>
          </div>
          <motion.span
            className={`text-2xl font-bold ${colorMap[card.color].text}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            {card.value}
          </motion.span>
          <p
            className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            {card.label}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// ORDER AI INSIGHTS PANEL - Premium Light Design
// ============================================================================

export function OrderAIInsightsPanel({ insights }) {
  const { isDark } = useTheme();

  const defaultInsights = {
    topCancellationReason: "Customer not answering",
    bestCallTime: "10:00 AM - 2:00 PM",
    mostUsedLanguage: "English (US)",
    recommendation: "Consider adding WhatsApp follow-up for unanswered calls",
  };

  const data = { ...defaultInsights, ...insights };

  const insightsList = [
    {
      label: "Top Cancellation Reason",
      value: data.topCancellationReason,
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
      color: "rose",
    },
    {
      label: "Best Call Time",
      value: data.bestCallTime,
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "blue",
    },
    {
      label: "Most Used Language",
      value: data.mostUsedLanguage,
      icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
      color: "violet",
    },
  ];

  const colorConfig = {
    rose: {
      text: isDark ? "text-rose-400" : "text-rose-600",
      iconBg: isDark ? "bg-rose-500/20" : "bg-rose-100",
    },
    blue: {
      text: isDark ? "text-blue-400" : "text-blue-600",
      iconBg: isDark ? "bg-blue-500/20" : "bg-blue-100",
    },
    violet: {
      text: isDark ? "text-violet-400" : "text-violet-600",
      iconBg: isDark ? "bg-violet-500/20" : "bg-violet-100",
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`
        rounded-xl border mb-8 overflow-hidden
        ${
          isDark
            ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700/50"
            : "bg-white border-slate-200/60"
        }
      `}
      style={
        !isDark
          ? {
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.02)",
            }
          : {}
      }
    >
      {/* Header */}
      <div
        className={`
        px-5 py-4 border-b
        ${isDark ? "border-slate-700/50" : "border-slate-100"}
      `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${isDark ? "bg-gradient-to-br from-violet-500 to-blue-500" : "bg-indigo-600"}
            `}
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h3
                className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                AI Insights
              </h3>
              <p
                className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Smart recommendations for better conversions
              </p>
            </div>
          </div>

          <div
            className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full
            ${isDark ? "bg-violet-500/10 border border-violet-500/20" : "bg-violet-50 border border-violet-100"}
          `}
          >
            <div className="flex items-center gap-1">
              <div className="w-1 h-2 bg-violet-500 rounded-full animate-pulse" />
              <div
                className="w-1 h-3 bg-violet-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="w-1 h-2 bg-violet-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
            <span
              className={`text-xs font-medium ${isDark ? "text-violet-400" : "text-violet-600"}`}
            >
              Analyzing
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {insightsList.map((insight, i) => (
            <motion.div
              key={insight.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`
                p-4 rounded-xl border
                ${
                  isDark
                    ? "bg-slate-800/30 border-slate-700/50"
                    : "bg-slate-50 border-slate-100"
                }
              `}
            >
              <div
                className={`
                w-8 h-8 rounded-lg flex items-center justify-center mb-2
                ${colorConfig[insight.color].iconBg} ${colorConfig[insight.color].text}
              `}
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
                    d={insight.icon}
                  />
                </svg>
              </div>
              <p
                className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"} mb-1`}
              >
                {insight.label}
              </p>
              <p
                className={`font-medium ${isDark ? "text-white" : "text-slate-700"}`}
              >
                {insight.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Recommendation Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`
            p-4 rounded-xl flex items-center gap-4
            ${
              isDark
                ? "bg-indigo-500/10 border border-indigo-500/20"
                : "bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100"
            }
          `}
        >
          <div
            className={`
            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}
          `}
          >
            <svg
              className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <p
              className={`text-xs font-medium ${isDark ? "text-indigo-300" : "text-indigo-800"}`}
            >
              AI Recommendation
            </p>
            <p
              className={`text-sm ${isDark ? "text-indigo-400/80" : "text-indigo-700"}`}
            >
              {data.recommendation}
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// ORDER TABLE STATUS CONFIG - Light Theme
// ============================================================================

const ORDER_STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    class: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  CONFIRMED: {
    label: "Confirmed",
    class: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  CANCELLED: {
    label: "Cancelled",
    class: "bg-rose-50 text-rose-700 border border-rose-200",
  },
  PENDING_MANUAL_REVIEW: {
    label: "Manual Review",
    class: "bg-violet-50 text-violet-700 border border-violet-200",
  },
  INVALID: {
    label: "Invalid",
    class: "bg-slate-50 text-slate-600 border border-slate-200",
  },
};

const CALL_STATUS_CONFIG = {
  QUEUED: {
    label: "Queued",
    class: "bg-slate-50 text-slate-600 border border-slate-200",
  },
  IN_PROGRESS: {
    label: "In Progress",
    class: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  COMPLETED: {
    label: "Completed",
    class: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  RETRY_SCHEDULED: {
    label: "Retry",
    class: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  FAILED: {
    label: "Failed",
    class: "bg-rose-50 text-rose-700 border border-rose-200",
  },
  WHATSAPP_SENT: {
    label: "WhatsApp Sent",
    class: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  },
};

// Dark mode variants
const ORDER_STATUS_CONFIG_DARK = {
  PENDING: {
    label: "Pending",
    class: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  },
  CONFIRMED: {
    label: "Confirmed",
    class: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    class: "bg-rose-500/15 text-rose-400 border border-rose-500/20",
  },
  PENDING_MANUAL_REVIEW: {
    label: "Manual Review",
    class: "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  },
  INVALID: {
    label: "Invalid",
    class: "bg-slate-500/15 text-slate-400 border border-slate-500/20",
  },
};

const CALL_STATUS_CONFIG_DARK = {
  QUEUED: {
    label: "Queued",
    class: "bg-slate-500/15 text-slate-400 border border-slate-500/20",
  },
  IN_PROGRESS: {
    label: "In Progress",
    class: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  },
  COMPLETED: {
    label: "Completed",
    class: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  },
  RETRY_SCHEDULED: {
    label: "Retry",
    class: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  },
  FAILED: {
    label: "Failed",
    class: "bg-rose-500/15 text-rose-400 border border-rose-500/20",
  },
  WHATSAPP_SENT: {
    label: "WhatsApp Sent",
    class: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20",
  },
};

// ============================================================================
// ORDER DATA TABLE - Premium Light Design
// ============================================================================

export function OrderDataTable({ orders, onRowClick, selectedId, onRecall }) {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [callStatusFilter, setCallStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredOrders = orders.filter((order) => {
    const latestLog = order.callLogs?.[0];
    const callStatus = latestLog?.status || "NONE";

    const matchesSearch =
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phoneNumber?.includes(searchTerm) ||
      order.shopifyOrderId?.includes(searchTerm);

    const matchesOrderStatus =
      orderStatusFilter === "all" || order.orderStatus === orderStatusFilter;
    const matchesCallStatus =
      callStatusFilter === "all" || callStatus === callStatusFilter;

    return matchesSearch && matchesOrderStatus && matchesCallStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, orderStatusFilter, callStatusFilter]);

  const getStatusConfig = (status, isOrder = true) => {
    if (isDark) {
      return isOrder
        ? ORDER_STATUS_CONFIG_DARK[status] || ORDER_STATUS_CONFIG_DARK.PENDING
        : CALL_STATUS_CONFIG_DARK[status] || CALL_STATUS_CONFIG_DARK.QUEUED;
    }
    return isOrder
      ? ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.PENDING
      : CALL_STATUS_CONFIG[status] || CALL_STATUS_CONFIG.QUEUED;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`
        rounded-xl border overflow-hidden
        ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-slate-200"}
      `}
      style={
        !isDark
          ? {
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.02)",
            }
          : {}
      }
    >
      {/* Table Header / Filters */}
      <div
        className={`
        p-5 border-b
        ${isDark ? "border-slate-700/50" : "border-slate-100"}
      `}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3
              className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Recent Orders
            </h3>
            <span
              className={`
              px-2.5 py-0.5 rounded-full text-xs font-medium
              ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}
            `}
            >
              {filteredOrders.length} orders
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <svg
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-slate-400" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`
                  pl-10 pr-3 py-2 rounded-lg text-sm w-48
                  ${
                    isDark
                      ? "bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50"
                      : "bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
                  }
                `}
              />
            </div>

            {/* Order Status Filter */}
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className={`
                px-3 py-2 rounded-lg text-sm
                ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white"
                    : "bg-white border border-slate-200 text-slate-700"
                }
              `}
            >
              <option value="all">All Orders</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PENDING_MANUAL_REVIEW">Manual Review</option>
              <option value="INVALID">Invalid</option>
            </select>

            {/* Call Status Filter */}
            <select
              value={callStatusFilter}
              onChange={(e) => setCallStatusFilter(e.target.value)}
              className={`
                px-3 py-2 rounded-lg text-sm
                ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white"
                    : "bg-white border border-slate-200 text-slate-700"
                }
              `}
            >
              <option value="all">All Calls</option>
              <option value="QUEUED">Queued</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="RETRY_SCHEDULED">Retry</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={isDark ? "bg-slate-800/30" : "bg-slate-50"}>
              {[
                "Order #",
                "Customer",
                "Phone",
                "Total",
                "Order Status",
                "Call Status",
                "Retries",
                "Created",
                "Actions",
              ].map((header) => (
                <th
                  key={header}
                  className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {paginatedOrders.map((order, i) => {
                const latestLog = order.callLogs?.[0];
                const callStatus = latestLog?.status || "NONE";
                const retries = latestLog?.retryCount || 0;

                const orderStatus = getStatusConfig(order.orderStatus, true);
                const callStatusConfig = getStatusConfig(callStatus, false);

                const isSelected = selectedId === order.id;
                const canRecall =
                  order.orderStatus === "PENDING" &&
                  callStatus !== "IN_PROGRESS" &&
                  callStatus !== "COMPLETED" &&
                  retries < 3;

                return (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => onRowClick?.(order)}
                    className={`
                      cursor-pointer border-b transition-colors
                      ${isDark ? "border-slate-700/30 hover:bg-slate-700/20" : "border-slate-100 hover:bg-slate-50"}
                      ${isSelected ? (isDark ? "bg-indigo-500/10" : "bg-indigo-50") : ""}
                    `}
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`font-mono text-sm font-medium ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
                      >
                        #{String(order.shopifyOrderId).slice(-8)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                          ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}
                        `}
                        >
                          {order.customerName?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span
                          className={`font-medium ${isDark ? "text-white" : "text-slate-700"}`}
                        >
                          {order.customerName || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`font-mono text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        {order.phoneNumber || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`font-semibold ${isDark ? "text-white" : "text-slate-700"}`}
                      >
                        ₹{order.totalPrice || "0"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${orderStatus.class}`}
                      >
                        {orderStatus.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {latestLog ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${callStatusConfig.class}`}
                        >
                          {callStatusConfig.label}
                        </span>
                      ) : (
                        <span
                          className={
                            isDark ? "text-slate-500" : "text-slate-400"
                          }
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          retries > 0
                            ? isDark
                              ? "text-amber-400"
                              : "text-amber-600"
                            : isDark
                              ? "text-slate-400"
                              : "text-slate-500"
                        }
                      >
                        {retries}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        {order.createdAt || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {/* Transcript Button */}
                        {callStatus === "COMPLETED" && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className={`
                              p-2 rounded-lg transition-colors
                              ${
                                isDark
                                  ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                              }
                            `}
                            title="View Transcript"
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
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </motion.button>
                        )}

                        {/* Recall Button */}
                        {canRecall && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRecall?.(order);
                            }}
                            className={`
                              px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors
                              ${
                                isDark
                                  ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              }
                            `}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            Call
                          </motion.button>
                        )}

                        {/* In Progress Indicator */}
                        {callStatus === "IN_PROGRESS" && (
                          <span
                            className={`text-sm flex items-center gap-1 ${isDark ? "text-blue-400" : "text-blue-600"}`}
                          >
                            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                            Calling
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="py-16 text-center">
            <div
              className={`
              w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center
              ${isDark ? "bg-slate-700" : "bg-slate-100"}
            `}
            >
              <svg
                className={`w-8 h-8 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <p className={isDark ? "text-slate-400" : "text-slate-500"}>
              No orders found
            </p>
            <p
              className={`text-sm mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              Try adjusting your filters
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div
            className={`
            px-5 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4
            ${isDark ? "border-slate-700/50 bg-slate-800/30" : "border-slate-100 bg-slate-50/50"}
          `}
          >
            <p
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Showing {startIndex + 1} to{" "}
              {Math.min(startIndex + itemsPerPage, filteredOrders.length)} of{" "}
              {filteredOrders.length} orders
            </p>
            <div className="flex items-center gap-2">
              {/* Previous Button */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`
                  p-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    isDark
                      ? "bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                      : "bg-white hover:bg-slate-100 text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed border border-slate-200"
                  }
                  ${currentPage === 1 ? "opacity-50" : ""}
                `}
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Page Numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`
                    min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${
                      currentPage === page
                        ? isDark
                          ? "bg-indigo-600 text-white"
                          : "bg-indigo-600 text-white"
                        : isDark
                          ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                          : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                    }
                  `}
                  >
                    {page}
                  </button>
                ),
              )}

              {/* Next Button */}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className={`
                  p-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    isDark
                      ? "bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                      : "bg-white hover:bg-slate-100 text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed border border-slate-200"
                  }
                  ${currentPage === totalPages ? "opacity-50" : ""}
                `}
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// ORDER DRAWER - Premium Light Design
// ============================================================================

export function OrderDrawer({ isOpen, onClose, order, children }) {
  const { isDark } = useTheme();
  const latestLog = order?.callLogs?.[0];

  const getStatusConfig = (status, isOrder = true) => {
    if (isDark) {
      return isOrder
        ? ORDER_STATUS_CONFIG_DARK[status] || ORDER_STATUS_CONFIG_DARK.PENDING
        : CALL_STATUS_CONFIG_DARK[status] || CALL_STATUS_CONFIG_DARK.QUEUED;
    }
    return isOrder
      ? ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.PENDING
      : CALL_STATUS_CONFIG[status] || CALL_STATUS_CONFIG.QUEUED;
  };

  const orderStatus = getStatusConfig(order?.orderStatus, true);
  const callStatus = getStatusConfig(latestLog?.status, false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`
              fixed top-0 right-0 h-full w-full max-w-lg z-50 overflow-y-auto
              ${isDark ? "bg-slate-900 border-l border-slate-700" : "bg-white border-l border-slate-200"}
            `}
          >
            {/* Drawer Header */}
            <div
              className={`
              sticky top-0 p-5 border-b flex items-center justify-between backdrop-blur-sm
              ${isDark ? "border-slate-700 bg-slate-900/95" : "border-slate-200 bg-white/95"}
            `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`
                  w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold
                  ${isDark ? "bg-gradient-to-br from-blue-500 to-violet-500" : "bg-indigo-600"}
                `}
                >
                  {order?.customerName?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <h3
                    className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    {order?.customerName || "Order Details"}
                  </h3>
                  <p
                    className={`text-sm font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    #{String(order?.shopifyOrderId || "").slice(-8)}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className={`
                  p-2 rounded-lg transition-colors
                  ${
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-400"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                  }
                `}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </motion.button>
            </div>

            {/* Drawer Content */}
            <div className="p-5">
              {children || (
                <>
                  {/* Status Section */}
                  <div className="mb-6">
                    <h4
                      className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Status
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${orderStatus.class}`}
                      >
                        Order: {orderStatus.label}
                      </span>
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
                          order?.confirmationStatus === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : order?.confirmationStatus === "cancelled"
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : order?.confirmationStatus === "no_response"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        }`}
                      >
                        Flow: {order?.confirmationStatus?.replace("_", " ") || "Pending"}
                      </span>
                      {latestLog && (
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${callStatus.class}`}
                        >
                          Call: {callStatus.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-6">
                    <h4
                      className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Customer Info
                    </h4>
                    <div className="space-y-3">
                      <div
                        className={`
                        flex justify-between items-center p-3 rounded-lg
                        ${isDark ? "bg-slate-800/50" : "bg-slate-50"}
                      `}
                      >
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Phone
                        </span>
                        <span
                          className={`font-mono ${isDark ? "text-white" : "text-slate-700"}`}
                        >
                          {order?.phoneNumber || "—"}
                        </span>
                      </div>
                      <div
                        className={`
                        flex justify-between items-center p-3 rounded-lg
                        ${isDark ? "bg-slate-800/50" : "bg-slate-50"}
                      `}
                      >
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Total Amount
                        </span>
                        <span
                          className={`font-semibold ${isDark ? "text-white" : "text-slate-700"}`}
                        >
                          ₹{order?.totalPrice || "0"}
                        </span>
                      </div>
                      <div
                        className={`
                        flex justify-between items-center p-3 rounded-lg
                        ${isDark ? "bg-slate-800/50" : "bg-slate-50"}
                      `}
                      >
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Store
                        </span>
                        <span
                          className={isDark ? "text-white" : "text-slate-700"}
                        >
                          {order?.storeName || "—"}
                        </span>
                      </div>
                      <div
                        className={`
                        flex flex-col gap-2 p-3 rounded-lg
                        ${isDark ? "bg-slate-800/50" : "bg-slate-50"}
                      `}
                      >
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Delivery Address
                        </span>
                        <span
                          className={`text-sm ${isDark ? "text-white" : "text-slate-700"}`}
                        >
                          {order?.address || "—"}
                        </span>
                      </div>
                      <div
                        className={`
                        flex justify-between items-center p-3 rounded-lg
                        ${isDark ? "bg-slate-800/50" : "bg-slate-50"}
                      `}
                      >
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Retries
                        </span>
                        <span
                          className={
                            latestLog?.retryCount > 0
                              ? isDark
                                ? "text-amber-400"
                                : "text-amber-600"
                              : isDark
                                ? "text-white"
                                : "text-slate-700"
                          }
                        >
                          {latestLog?.retryCount || 0}
                        </span>
                      </div>
                      <div
                        className={`
                        flex justify-between items-center p-3 rounded-lg
                        ${isDark ? "bg-slate-800/50" : "bg-slate-50"}
                      `}
                      >
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Created
                        </span>
                        <span
                          className={isDark ? "text-white" : "text-slate-700"}
                        >
                          {order?.createdAt || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Communication Log */}
                  {order?.communicationLog && Array.isArray(order.communicationLog) && (
                    <div className="mb-6">
                      <h4
                        className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Communication Timeline
                      </h4>
                      <div className="space-y-4 pl-2">
                        {order.communicationLog.map((log, idx) => (
                          <div key={idx} className="relative flex gap-4">
                            {idx !== order.communicationLog.length - 1 && (
                              <div
                                className={`absolute left-[11px] top-6 bottom-[-16px] w-[2px] ${isDark ? "bg-slate-700" : "bg-slate-100"}`}
                              />
                            )}
                            <div
                              className={`
                                relative z-10 w-6 h-6 rounded-full border-4 flex items-center justify-center
                                ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-50"}
                              `}
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${isDark ? "bg-indigo-500" : "bg-indigo-600"}`}
                              />
                            </div>
                            <div>
                              <p
                                className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-700"}`}
                              >
                                {log.event}
                              </p>
                              <p
                                className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}
                              >
                                {new Date(log.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transcript Section */}
                  {latestLog?.transcript && (
                    <div className="mb-6">
                      <h4
                        className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Call Transcript
                      </h4>
                      <div
                        className={`
                        p-4 rounded-lg max-h-48 overflow-y-auto
                        ${isDark ? "bg-slate-800/50 border border-slate-700/50" : "bg-slate-50 border border-slate-100"}
                      `}
                      >
                        <p
                          className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}
                        >
                          {latestLog.transcript}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Decision Section */}
                  {latestLog?.intent && (
                    <div>
                      <h4
                        className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        AI Decision
                      </h4>
                      <div
                        className={`
                        p-4 rounded-lg
                        ${
                          isDark
                            ? "bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20"
                            : "bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100"
                        }
                      `}
                      >
                        <p
                          className={`font-medium ${isDark ? "text-white" : "text-slate-700"}`}
                        >
                          {latestLog.intent}
                        </p>
                        {latestLog.failureReason && (
                          <p
                            className={`text-sm mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {latestLog.failureReason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// CREATE ORDER MODAL - Premium Light Design
// ============================================================================

export function CreateOrderModal({ isOpen, onClose, onSubmit, isLoading }) {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    customerName: "",
    phoneNumber: "",
    totalPrice: "",
    storeName: "",
    address: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`
            w-full max-w-md rounded-xl border p-6
            ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}
          `}
          onClick={(e) => e.stopPropagation()}     
          style={
            !isDark
              ? {
                  boxShadow:
                    "0 4px 24px -4px rgba(0,0,0,0.1), 0 12px 40px -8px rgba(0,0,0,0.08)",
                }
              : {}
          }
        >
          <div className="flex items-center justify-between mb-6">
            <h3
              className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Create Order
            </h3>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={`
                p-2 rounded-lg transition-colors
                ${isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-500"}
              `}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </motion.button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Customer Name
              </label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) =>
                  setFormData({ ...formData, customerName: e.target.value })
                }
                placeholder="e.g. Dharmik"
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm
                  ${
                    isDark
                      ? "bg-slate-800 border border-slate-600 text-white placeholder-slate-400"
                      : "bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400"
                  }
                `}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Phone Number (E.164)
              </label>
              <input
                type="tel"
                required
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="+917041668245"
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm font-mono
                  ${
                    isDark
                      ? "bg-slate-800 border border-slate-600 text-white placeholder-slate-400"
                      : "bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400"
                  }
                `}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Total Amount
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.totalPrice}
                onChange={(e) =>
                  setFormData({ ...formData, totalPrice: e.target.value })
                }
                placeholder="499.00"
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm
                  ${
                    isDark
                      ? "bg-slate-800 border border-slate-600 text-white placeholder-slate-400"
                      : "bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400"
                  }
                `}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Delivery Address
              </label>
              <textarea
                required
                rows={3}
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Full delivery address..."
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm
                  ${
                    isDark
                      ? "bg-slate-800 border border-slate-600 text-white placeholder-slate-400"
                      : "bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400"
                  }
                `}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                Store Name (optional)
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) =>
                  setFormData({ ...formData, storeName: e.target.value })
                }
                placeholder="fullstack-developer-2"
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm
                  ${
                    isDark
                      ? "bg-slate-800 border border-slate-600 text-white placeholder-slate-400"
                      : "bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400"
                  }
                `}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm transition-colors
                  ${
                    isDark
                      ? "bg-slate-700 hover:bg-slate-600 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }
                `}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors
                  ${
                    isDark
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }
                  ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Order"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// ACTIVE CALL INDICATOR - Premium Light Design
// ============================================================================

export function ActiveCallIndicator({ isActive, customerName, onEndCall }) {
  const { isDark } = useTheme();

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30"
        >
          <div
            className={`
            px-6 py-4 rounded-xl border flex items-center gap-4
            ${
              isDark
                ? "bg-slate-800 border-slate-700 shadow-lg shadow-black/20"
                : "bg-white border-slate-200 shadow-lg"
            }
          `}
          >
            {/* Waveform */}
            <div className="flex items-center gap-1 h-8">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: [8, 24, 12, 20, 16, 28, 10],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.1,
                  }}
                  className={`w-1.5 rounded-full ${isDark ? "bg-indigo-400" : "bg-indigo-500"}`}
                />
              ))}
            </div>

            {/* Call Info */}
            <div>
              <p
                className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                AI Speaking with
              </p>
              <p
                className={`font-medium ${isDark ? "text-white" : "text-slate-700"}`}
              >
                {customerName || "Customer"}
              </p>
            </div>

            {/* Status */}
            <div
              className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full
              ${isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}
            `}
            >
              <div
                className={`w-2 h-2 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-500"} animate-pulse`}
              />
              <span
                className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
              >
                Live
              </span>
            </div>

            {/* End Call */}
            {/* <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEndCall}
              className={`
                p-2 rounded-full transition-colors
                ${isDark
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200'
                }
              `}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </motion.button> */}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// TEST CALL MODAL - Premium Modal Design
// ============================================================================

export function TestCallModal({ isOpen, onClose, onSubmit, isLoading }) {
  const { isDark } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(phoneNumber);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`
            w-full max-w-sm rounded-[2rem] border p-8
            ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200 shadow-2xl"}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h3
              className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Test AI Call
            </h3>
            <p
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Enter your number to receive a demo order confirmation call from
              your AI agent.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                className={`text-xs font-bold uppercase tracking-widest pl-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                Your Phone Number
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91..."
                className={`
                  w-full h-14 px-5 rounded-2xl font-mono text-lg font-bold outline-none transition-all
                  ${
                    isDark
                      ? "bg-slate-800 border-2 border-slate-700 text-white focus:border-indigo-500"
                      : "bg-slate-50 border-2 border-slate-100 text-slate-900 focus:border-indigo-600 focus:bg-white"
                  }
                `}
              />
              <p className="text-[10px] text-slate-400 pl-1 mt-1">
                E.164 format (e.g., +919876543210)
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isLoading || !phoneNumber}
                className={`
                  w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-95
                  ${
                    isLoading || !phoneNumber
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20"
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Send Test Call
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`
                  w-full h-12 rounded-2xl font-bold text-sm transition-colors
                  ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}
                `}
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default {
  OrderPageHeader,
  OrderStatsCards,
  OrderAIInsightsPanel,
  OrderDataTable,
  OrderDrawer,
  CreateOrderModal,
  TestCallModal,
  ActiveCallIndicator,
};
