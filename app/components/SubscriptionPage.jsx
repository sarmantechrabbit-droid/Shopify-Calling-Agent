import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext.jsx";

/**
 * Subscription Page Component
 */
export default function SubscriptionPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen p-6 lg:p-10 ${isDark ? "bg-black text-white" : "bg-slate-50 text-slate-900"}`}>
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Section */}
        <section>
          <h1 className="text-4xl font-black tracking-tight mb-2">Subscription</h1>
          <p className={`text-sm font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Manage your plan and usage
          </p>
        </section>

        {/* Top Usage & Status Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Usage Card */}
          <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border-2 relative overflow-hidden flex flex-col justify-between min-h-[400px] ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-premium-light"
          }`}>
            <div className="flex justify-between items-start z-10">
              <div>
                <h3 className="text-2xl font-black mb-1">Current Usage</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Voice Minutes</p>
              </div>
              <span className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-violet-600/20">
                Professional Plan
              </span>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-12 py-8 z-10">
              {/* Circular Gauge */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className={isDark ? "text-slate-800" : "text-slate-100"}
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="url(#gradient-usage)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    fill="transparent"
                    initial={{ strokeDasharray: "0 553" }}
                    animate={{ strokeDasharray: `${(1247 / 2000) * 553} 553` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                  <defs>
                    <linearGradient id="gradient-usage" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#EC4899" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Waveform Inside */}
                <div className="absolute flex items-end gap-1.5 h-10">
                  {[0.4, 0.7, 1, 0.6, 0.8, 0.5, 0.9, 0.4].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: [`${h * 20}%`, `${h * 100}%`, `${h * 20}%`],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1 + i * 0.1,
                        ease: "easeInOut",
                      }}
                      className="w-1.5 bg-violet-500 rounded-full"
                    />
                  ))}
                </div>
              </div>

              {/* Stats Center */}
              <div className="flex-1 space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-violet-600">1,247</span>
                  <span className="text-xl font-bold text-slate-400">/ 2,000 min</span>
                </div>
                <div className={`h-3 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "62.35%" }}
                    className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full"
                  />
                </div>
                <p className="text-sm font-medium text-slate-500 italic">753 minutes remaining this month</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 z-10">
              <div className={`p-5 rounded-3xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
                    <PhoneIcon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Calls</p>
                </div>
                <p className="text-2xl font-black">892 calls</p>
              </div>
              <div className={`p-5 rounded-3xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <TrendIcon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Success Rate</p>
                </div>
                <p className="text-2xl font-black">72%</p>
              </div>
            </div>

            {/* Background elements */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20`} />
          </div>

          {/* Subscription Status Card */}
          <div className={`p-8 rounded-[2.5rem] border-2 flex flex-col ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-premium-light"
          }`}>
            <h3 className="text-2xl font-black mb-8">Subscription Status</h3>
            
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expires on</p>
                  <p className="text-lg font-black">February 15, 2025</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <ClockIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Days remaining</p>
                  <p className="text-lg font-black">-398 days</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <StatusIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <p className="text-lg font-black text-emerald-500">Active</p>
                </div>
              </div>
            </div>

            <button className="w-full mt-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 text-white font-black flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-transform">
              <RefreshIcon className="w-5 h-5" />
              Renew Early
            </button>
          </div>
        </div>

        {/* WhatsApp Credits Banner */}
        <div className={`p-8 rounded-[2.5rem] border-2 relative overflow-hidden ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-premium-light"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.25rem] bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <WhatsAppIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black">WhatsApp Credits</h3>
                <p className="text-sm font-medium text-slate-400">Charged directly by Meta</p>
              </div>
            </div>
            
            <a href="#" className="text-sm font-bold text-violet-600 flex items-center gap-2 hover:underline">
              Manage in Meta Business
              <ExternalLinkIcon className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Messages Sent</p>
              <p className="text-3xl font-black">1,284</p>
            </div>
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Conversations</p>
              <p className="text-3xl font-black">892</p>
            </div>
            <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Est. Cost (this month)</p>
              <p className="text-3xl font-black text-violet-600">$24.50</p>
            </div>
          </div>
        </div>

        {/* Available Plans Section */}
        <section className="space-y-10">
          <h2 className="text-3xl font-black">Available Plans</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PlanCard 
              name="Starter"
              price="29"
              minutes="500"
              features={[
                { name: "AI Voice Calls", active: true },
                { name: "WhatsApp Integration", active: true },
                { name: "Basic Analytics", active: true },
                { name: "Email Support", active: true },
                { name: "Custom Scripts", active: false },
                { name: "API Access", active: false },
              ]}
              buttonText="Upgrade"
              isDark={isDark}
            />
            <PlanCard 
              name="Professional"
              price="79"
              minutes="2,000"
              features={[
                { name: "AI Voice Calls", active: true },
                { name: "WhatsApp Integration", active: true },
                { name: "Advanced Analytics", active: true },
                { name: "Priority Support", active: true },
                { name: "Custom Scripts", active: true },
                { name: "API Access", active: false },
              ]}
              buttonText="Current Plan"
              isCurrent={true}
              popular={true}
              isDark={isDark}
            />
            <PlanCard 
              name="Enterprise"
              price="199"
              minutes="10,000"
              features={[
                { name: "AI Voice Calls", active: true },
                { name: "WhatsApp Integration", active: true },
                { name: "Advanced Analytics", active: true },
                { name: "Priority Support", active: true },
                { name: "Custom Scripts", active: true },
                { name: "API Access", active: true },
              ]}
              buttonText="Upgrade"
              isDark={isDark}
            />
          </div>
        </section>

      </div>
    </div>
  );
}

function PlanCard({ name, price, minutes, features, buttonText, isCurrent, popular, isDark }) {
  return (
    <div className={`relative p-8 rounded-[2.5rem] border-2 transition-all hover:scale-[1.02] flex flex-col h-full ${
      popular 
        ? "border-violet-500 shadow-2xl shadow-violet-500/20 bg-violet-500/5" 
        : (isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-premium-light")
    }`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-black shadow-lg">
          Most Popular
        </div>
      )}
      
      <div className="mb-8">
        <h4 className="text-xl font-black mb-4">{name}</h4>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black">${price}</span>
          <span className="text-slate-400 font-bold">/month</span>
        </div>
        <p className="text-sm font-bold text-slate-500 mt-2">{minutes} AI minutes included</p>
      </div>

      <div className="flex-1 space-y-4 mb-10">
        {features.map((f, i) => (
          <div key={i} className={`flex items-center gap-3 ${f.active ? "text-slate-900 dark:text-white" : "text-slate-400 opacity-50"}`}>
            <div className={`w-5 h-5 flex items-center justify-center rounded-full ${f.active ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-800"}`}>
              <CheckIcon className="w-3 h-3" />
            </div>
            <span className="text-sm font-bold">{f.name}</span>
          </div>
        ))}
      </div>

      <button 
        disabled={isCurrent}
        className={`w-full py-4 rounded-2xl font-black transition-all ${
          isCurrent 
            ? (isDark ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-slate-100 text-slate-400 cursor-not-allowed")
            : "bg-white border-2 border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
      >
        {buttonText}
      </button>
    </div>
  );
}

// Custom Icons
const PhoneIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const TrendIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const CalendarIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ClockIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const StatusIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const RefreshIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const WhatsAppIcon = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const ExternalLinkIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const CheckIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
