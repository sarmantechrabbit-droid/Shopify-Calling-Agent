import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext.jsx";

// ============================================================================
// PREMIUM LIGHT THEME DASHBOARD HEADER
// ============================================================================

export function DashboardHeader({
  onTestCall,
  onViewAnalytics,
  onSettings,
  lastCallTime,
  successRate,
  isAiActive = true,
  isLoading = false
}) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      {/* Main Header Card - Soft Gradient Background */}
      <div className={`
        relative overflow-hidden rounded-2xl border
        ${isDark
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700/50'
          : 'bg-gradient-to-br from-white via-slate-50/50 to-white border-slate-200/60'
        }
      `}
      style={!isDark ? {
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.06), 0 12px 40px -8px rgba(0,0,0,0.04)'
      } : {}}
      >
        {/* Soft Background Accent - Light Mode */}
        {!isDark && (
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/60 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
        )}

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-4">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center shadow-sm
              ${isAiActive
                ? isDark ? 'bg-gradient-to-br from-indigo-500 to-blue-500' : 'bg-indigo-600 shadow-indigo-200'
                : isDark ? 'bg-slate-700' : 'bg-slate-100'
              }
            `}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Voice AI Agent
                </h1>
                {isAiActive && (
                  <span className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                    ${isDark
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }
                  `}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                )}
              </div>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                AI-powered order confirmation calls
              </p>
            </div>
          </div>

          {/* Right: Stats + Actions */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Quick Stats */}
            <div className={`
              flex items-center gap-4 px-4 py-2.5 rounded-xl
              ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-slate-50 border border-slate-200'}
            `}>
              <div className="text-center">
                <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Last Call</p>
                <p className={`font-medium text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{lastCallTime || '—'}</p>
              </div>
              <div className={`w-px h-8 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <div className="text-center">
                <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Success</p>
                <p className={`font-medium text-sm ${
                  successRate >= 70 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') :
                  successRate >= 50 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-rose-400' : 'text-rose-600')
                }`}>
                  {successRate !== null ? `${successRate}%` : '—'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onTestCall}
                disabled={isLoading}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all
                  ${isDark
                    ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Test Call
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onViewAnalytics}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all
                  ${isDark
                    ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </motion.button>

              {/* Theme Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className={`
                  w-9 h-9 rounded-lg flex items-center justify-center transition-all
                  ${isDark
                    ? 'bg-slate-700 hover:bg-slate-600 text-amber-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }
                `}
                title={isDark ? 'Switch to Light' : 'Switch to Dark'}
              >
                {isDark ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// COMPACT STATS CARDS - With Icons
// ============================================================================

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
};

export function StatsCards({ stats }) {
  const { isDark } = useTheme();

  const cards = [
    { label: 'Total', value: stats.total || 0, color: 'indigo' },
    { label: 'Success Rate', value: `${stats.successRate || 0}%`, color: 'emerald' },
    { label: 'Avg Duration', value: stats.avgDuration || '0:00', color: 'blue' },
    { label: 'Retry Rate', value: `${stats.retryRate || 0}%`, color: 'amber' },
    { label: 'Revenue', value: `$${stats.revenue || '0'}`, color: 'violet' }
  ];

  const colorMap = {
    indigo: {
      bg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50',
      text: isDark ? 'text-indigo-400' : 'text-indigo-600',
      border: isDark ? 'border-indigo-500/20' : 'border-indigo-100',
      iconBg: isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'
    },
    emerald: {
      bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
      text: isDark ? 'text-emerald-400' : 'text-emerald-600',
      border: isDark ? 'border-emerald-500/20' : 'border-emerald-100',
      iconBg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
    },
    blue: {
      bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
      text: isDark ? 'text-blue-400' : 'text-blue-600',
      border: isDark ? 'border-blue-500/20' : 'border-blue-100',
      iconBg: isDark ? 'bg-blue-500/20' : 'bg-blue-100'
    },
    amber: {
      bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
      text: isDark ? 'text-amber-400' : 'text-amber-600',
      border: isDark ? 'border-amber-500/20' : 'border-amber-100',
      iconBg: isDark ? 'bg-amber-500/20' : 'bg-amber-100'
    },
    violet: {
      bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50',
      text: isDark ? 'text-violet-400' : 'text-violet-600',
      border: isDark ? 'border-violet-500/20' : 'border-violet-100',
      iconBg: isDark ? 'bg-violet-500/20' : 'bg-violet-100'
    }
  };

  const icons = {
    indigo: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    emerald: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    blue: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    amber: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    violet: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          custom={i}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className={`
            p-5 rounded-xl border transition-all hover:-translate-y-0.5
            ${isDark
              ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
              : 'bg-white border-slate-200/60 hover:shadow-md'
            }
          `}
          style={!isDark ? { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } : {}}
        >
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {card.label}
            </p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[card.color].iconBg}`}>
              <svg className={`w-4 h-4 ${colorMap[card.color].text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icons[card.color]} />
              </svg>
            </div>
          </div>
          <p className={`text-2xl font-bold ${colorMap[card.color].text}`}>
            {card.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// ELEGANT AI INSIGHTS PANEL - Premium Light Design
// ============================================================================

export function AIInsightsPanel({ insights }) {
  const { isDark } = useTheme();

  const defaultInsights = {
    topCancellationReason: 'No answer',
    bestCallTime: '10AM - 2PM',
    mostUsedLanguage: 'English (US)',
    recommendation: 'Consider adding WhatsApp follow-up for unanswered calls'
  };

  const data = { ...defaultInsights, ...insights };

  const insightsList = [
    { label: 'Top Cancellation Reason', value: data.topCancellationReason, color: 'red', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    { label: 'Best Call Time', value: data.bestCallTime, color: 'blue', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Most Used Language', value: data.mostUsedLanguage, color: 'purple', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' }
  ];

  const colorConfig = {
    red: {
      bg: isDark ? 'bg-rose-500/10' : 'bg-rose-50',
      border: isDark ? 'border-rose-500/20' : 'border-rose-100',
      text: isDark ? 'text-rose-400' : 'text-rose-600',
      iconBg: isDark ? 'bg-rose-500/20' : 'bg-rose-100'
    },
    blue: {
      bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
      border: isDark ? 'border-blue-500/20' : 'border-blue-100',
      text: isDark ? 'text-blue-400' : 'text-blue-600',
      iconBg: isDark ? 'bg-blue-500/20' : 'bg-blue-100'
    },
    purple: {
      bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50',
      border: isDark ? 'border-violet-500/20' : 'border-violet-100',
      text: isDark ? 'text-violet-400' : 'text-violet-600',
      iconBg: isDark ? 'bg-violet-500/20' : 'bg-violet-100'
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`
        rounded-xl border mb-6 overflow-hidden
        ${isDark
          ? 'bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700/50'
          : 'bg-white border-slate-200/60'
        }
      `}
      style={!isDark ? { boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.02)' } : {}}
    >
      <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>AI Insights</span>
          </div>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Updated just now</span>
        </div>
      </div>

      <div className="p-5">
        {/* Compact Insights Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {insightsList.map((item, i) => (
            <div
              key={item.label}
              className={`
                p-4 rounded-xl border
                ${isDark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-100'}
              `}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorConfig[item.color].iconBg}`}>
                  <svg className={`w-4 h-4 ${colorConfig[item.color].text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</p>
              </div>
              <p className={`font-semibold text-lg ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Recommendation Banner - Gradient Background */}
        <div className={`
          p-4 rounded-xl flex items-center gap-4
          ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100'}
        `}>
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}
          `}>
            <svg className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Recommendation</p>
            <p className={`text-sm ${isDark ? 'text-indigo-400/80' : 'text-indigo-700'}`}>
              {data.recommendation}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// ENHANCED DATA TABLE - Premium Light Design
// ============================================================================

export function DataTable({ calls, onRowClick, selectedId }) {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredCalls = calls.filter(call => {
    const matchesSearch = call.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || call.phone?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status) => {
    const configs = {
      answered: {
        label: 'Confirmed',
        class: isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      },
      pending: {
        label: 'Pending',
        class: isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
      },
      calling: {
        label: 'Calling',
        class: isDark ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'
      },
      retrying: {
        label: 'Retrying',
        class: isDark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200'
      },
      failed: {
        label: 'Failed',
        class: isDark ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200'
      }
    };
    return configs[status] || configs.pending;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`
        rounded-xl border overflow-hidden
        ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200'}
      `}
      style={!isDark ? { boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.02)' } : {}}
    >

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={isDark ? 'bg-slate-800/30' : 'bg-slate-50'}>
              {['Customer', 'Phone', 'Status', 'Retries', 'Duration', 'Created'].map((h) => (
                <th key={h} className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filteredCalls.map((call, i) => {
                const status = getStatusConfig(call.status);
                const isSelected = selectedId === call.id;

                return (
                  <motion.tr
                    key={call.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onRowClick?.(call)}
                    className={`
                      cursor-pointer border-b transition-colors
                      ${isDark ? 'border-slate-700/30 hover:bg-slate-700/20' : 'border-slate-100 hover:bg-slate-50'}
                      ${isSelected ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50') : ''}
                    `}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                          ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}
                        `}>
                          {call.customerName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-700'}`}>{call.customerName || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-4 font-mono text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{call.phone || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${status.class}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className={`px-5 py-4 ${call.retryCount > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                      {call.retryCount || 0}
                    </td>
                    <td className={`px-5 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{call.duration || '—'}</td>
                    <td className={`px-5 py-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{call.createdAt || '—'}</td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {filteredCalls.length === 0 && (
          <div className="py-12 text-center">
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>No calls found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// SLIDE-IN DRAWER
// ============================================================================

export function Drawer({ isOpen, onClose, call }) {
  const { isDark } = useTheme();

  const getStatusBadge = (status) => {
    const map = {
      answered: { label: "Confirmed", cls: "bg-emerald-500/10 text-emerald-500" },
      failed: { label: "Failed / Cancelled", cls: "bg-rose-500/10 text-rose-500" },
      calling: { label: "In Progress", cls: "bg-blue-500/10 text-blue-500" },
      retrying: { label: "Retrying / On Hold", cls: "bg-amber-500/10 text-amber-500" },
      pending: { label: "Pending", cls: "bg-indigo-500/10 text-indigo-500" },
    };
    const s = map[status] || map.pending;
    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.cls}`}>{s.label}</span>;
  };

  const rows = call ? [
    { label: "Customer", value: call.customerName || "—" },
    { label: "Phone", value: call.phone || "—" },
    { label: "Order ID", value: call.shopifyOrderId || call.id?.slice(-8) || "—" },
    { label: "Total Price", value: call.totalPrice ? `₹${call.totalPrice}` : "—" },
    { label: "Store", value: call.storeName || "—" },
    { label: "Order Status", value: call.orderStatus || "—" },
    { label: "Call Status", value: call.callStatus || "—" },
    { label: "Retry Count", value: String(call.retryCount ?? 0) },
    { label: "Last Intent", value: call.lastIntent || "—" },
    { label: "Failure Reason", value: call.failureReason || "None" },
    { label: "Vapi Call ID", value: call.vapiCallId || "—" },
    { label: "WhatsApp Sent", value: call.whatsappSent ? "✅ Yes" : "❌ No" },
    { label: "WhatsApp Replied", value: call.whatsappReplied ? "✅ Yes" : "❌ No" },
    { label: "Created", value: call.createdAt || "—" },
  ] : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`
              fixed top-0 right-0 h-full w-full max-w-md z-50 overflow-y-auto
              ${isDark ? 'bg-slate-900 border-l border-slate-700' : 'bg-white border-l border-slate-200'}
            `}
          >
            <div className={`
              sticky top-0 p-5 border-b flex items-center justify-between
              ${isDark ? 'border-slate-700 bg-slate-900/95 backdrop-blur-sm' : 'border-slate-200 bg-white/95 backdrop-blur-sm'}
            `}>
              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Order Details</h3>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {call ? (
              <div className="p-5 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${isDark ? "bg-violet-500/10 text-violet-400" : "bg-violet-50 text-violet-600"}`}>
                    {call.customerName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{call.customerName || "Unknown"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(call.status)}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className={`rounded-2xl border-2 divide-y ${isDark ? "border-slate-800 divide-slate-800" : "border-slate-100 divide-slate-100"}`}>
                  {rows.map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{row.label}</span>
                      <span className={`text-sm font-medium text-right max-w-[60%] truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Select an order to view details.</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// ACTIVE CALL OVERLAY
// ============================================================================

export function ActiveCallOverlay({ isActive, customerName }) {
  const { isDark } = useTheme();

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 py-3 rounded-xl border flex items-center gap-3
            ${isDark
              ? 'bg-slate-800 border-slate-700 shadow-lg shadow-black/20'
              : 'bg-white border-slate-200 shadow-lg'
            }
          `}
        >
          <div className="flex items-center gap-1">
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [8, 16, 10, 14, 8] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                className={`w-1 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`}
              />
            ))}
          </div>
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-700'}`}>
            Calling {customerName || 'customer'}...
          </span>
          <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'} animate-pulse`} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default {
  DashboardHeader,
  StatsCards,
  AIInsightsPanel,
  DataTable,
  Drawer,
  ActiveCallOverlay
};
