import { useState, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { authenticate } from "../shopify.server";
import prisma from "../db.server.js";

/* ═══════════════════════════════════════════════════════════════
   LOADER — fetch config + scripts from DB
   ═══════════════════════════════════════════════════════════════ */
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Upsert — ensure a config row always exists
  let config = await prisma.appConfig.findFirst({ where: { shop: "default" } });
  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        id: "default",
        shop: "default",
        vapiApiKey: process.env.VAPI_API_KEY || "",
        vapiPhoneId: process.env.VAPI_PHONE_NUMBER_ID || "",
        vapiAssistantId:
          process.env.VAPI_ORDER_ASSISTANT_ID ||
          process.env.VAPI_ASSISTANT_ID ||
          "",
        callLanguage: process.env.CALL_LANGUAGE || "hindi",
        twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
        twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
        twilioWaFrom: process.env.TWILIO_WHATSAPP_FROM || "",
        whatsappEnabled: true,
      },
    });
  }

  // Seed default scripts if none exist
  const scriptCount = await prisma.script.count({ where: { shop: "default" } });
  if (scriptCount === 0) {
    await prisma.script.createMany({
      data: [
        {
          shop: "default",
          name: "Standard Confirmation",
          body: "Hi {{CUSTOMER_NAME}}, this is a confirmation call for your Order #{{ORDER_ID}} worth ₹{{TOTAL}}.\n\nYour items: {{PRODUCT_LIST}}\nDelivery to: {{ADDRESS}}\n\nPlease confirm by saying YES or CANCEL to cancel this order.",
          isActive: true,
        },
        {
          shop: "default",
          name: "High Value Order",
          body: "Hello {{CUSTOMER_NAME}}, we are calling regarding your premium order #{{ORDER_ID}} worth ₹{{TOTAL}}.\n\nWe want to personally confirm this order with you. Your items will be delivered to {{ADDRESS}} by {{DELIVERY_DATE}}.\n\nShall we proceed with this order?",
          isActive: false,
        },
        {
          shop: "default",
          name: "Hindi Script",
          body: "नमस्ते {{CUSTOMER_NAME}}, मैं {{STORE_NAME}} की तरफ से बोल रहा हूं।\n\nआपने ₹{{TOTAL}} का Order #{{ORDER_ID}} place किया है।\n\nक्या आप इस ऑर्डर की पुष्टि करते हैं?",
          isActive: false,
        },
        {
          shop: "default",
          name: "Abandoned Cart",
          body: "Hi {{CUSTOMER_NAME}}, we noticed you left some items in your cart!\n\nYour cart total was ₹{{TOTAL}}. Would you like to complete your purchase? We can help you with that right now.",
          isActive: false,
        },
      ],
    });
  }

  const scripts = await prisma.script.findMany({
    where: { shop: "default" },
    orderBy: { createdAt: "asc" },
  });

  // Serialize dates
  const serializedConfig = {
    ...config,
    createdAt: config.createdAt?.toISOString(),
    updatedAt: config.updatedAt?.toISOString(),
  };

  const serializedScripts = scripts.map((s) => ({
    ...s,
    createdAt: s.createdAt?.toISOString(),
    updatedAt: s.updatedAt?.toISOString(),
  }));

  return { config: serializedConfig, scripts: serializedScripts };
};

/* ═══════════════════════════════════════════════════════════════
   ACTION — handle form submissions
   ═══════════════════════════════════════════════════════════════ */
export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  /* ── Save WhatsApp settings ───────────────────────────── */
  if (intent === "save-whatsapp") {
    await prisma.appConfig.update({
      where: { id: "default" },
      data: {
        waAutoConfirm: formData.get("waAutoConfirm") === "true",
        waUpdateNotify: formData.get("waUpdateNotify") === "true",
        waAutoReplies: formData.get("waAutoReplies") === "true",
        waTimeoutMinutes:
          parseInt(String(formData.get("waTimeoutMinutes") || "5"), 10) || 5,
        initialDelay: formData.get("initialDelay") || "immediate",
        retryInterval: formData.get("retryInterval") || "2hours",
        twilioSid: formData.get("twilioSid") || "",
        twilioToken: formData.get("twilioToken") || "",
        twilioWaFrom: formData.get("twilioWaFrom") || "",
        whatsappEnabled: formData.get("whatsappEnabled") === "true",
      },
    });
    return { success: true, message: "WhatsApp settings saved" };
  }

  /* ── Save voice selection ─────────────────────────────── */
  if (intent === "save-voice") {
    await prisma.appConfig.update({
      where: { id: "default" },
      data: {
        selectedVoice: formData.get("selectedVoice") || "Sarah",
        vapiApiKey: formData.get("vapiApiKey") || "",
        vapiPhoneId: formData.get("vapiPhoneId") || "",
        vapiAssistantId: formData.get("vapiAssistantId") || "",
        callLanguage: formData.get("callLanguage") || "hindi",
        maxRetries: parseInt(formData.get("maxRetries") || "3", 10),
      },
    });
    return { success: true, message: "AI Voice settings saved" };
  }

  /* ── Save / update a script ───────────────────────────── */
  if (intent === "save-script") {
    const scriptId = formData.get("scriptId");
    const name = formData.get("scriptName");
    const body = formData.get("scriptBody");

    if (scriptId) {
      await prisma.script.update({
        where: { id: scriptId },
        data: { name, body },
      });
    }

    return { success: true, message: "Script saved" };
  }

  /* ── Set active script ────────────────────────────────── */
  if (intent === "set-active-script") {
    const scriptId = formData.get("scriptId");

    // Deactivate all
    await prisma.script.updateMany({
      where: { shop: "default" },
      data: { isActive: false },
    });

    // Activate selected
    await prisma.script.update({
      where: { id: scriptId },
      data: { isActive: true },
    });

    await prisma.appConfig.update({
      where: { id: "default" },
      data: { activeScriptId: scriptId },
    });

    return { success: true, message: "Active script updated" };
  }

  /* ── Create new script ────────────────────────────────── */
  if (intent === "create-script") {
    const newScript = await prisma.script.create({
      data: {
        shop: "default",
        name: formData.get("scriptName") || "New Script",
        body:
          formData.get("scriptBody") ||
          "Hi {{CUSTOMER_NAME}}, confirming your order #{{ORDER_ID}}.",
        isActive: false,
      },
    });
    return { success: true, message: "Script created", scriptId: newScript.id };
  }

  /* ── Delete a script ──────────────────────────────────── */
  if (intent === "delete-script") {
    const scriptId = formData.get("scriptId");
    await prisma.script.delete({ where: { id: scriptId } });
    return { success: true, message: "Script deleted" };
  }

  return { success: false, message: "Unknown action" };
};

/* ═══════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function ConfigurationPage() {
  const { config, scripts } = useLoaderData();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("whatsapp");

  const tabs = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <WhatsAppIcon className="w-full h-full" />,
    },
    {
      id: "voices",
      label: "AI Voices",
      icon: <VoiceIcon className="w-full h-full" />,
    },
    {
      id: "scripts",
      label: "Scripts",
      icon: <ScriptIcon className="w-full h-full" />,
    },
  ];

  return (
    <div
      className={`min-h-screen ${isDark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"} p-4 lg:p-10`}
    >
      <div className="max-w-[1440px] mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Configuration</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage your WhatsApp automation, AI voices, and confirmation scripts
          </p>
        </header>

        <nav className="flex items-center gap-2 mb-10 p-1.5 rounded-2xl bg-slate-200 dark:bg-slate-800/60 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-all ${
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-md"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <span className="w-5 h-5 inline-flex items-center justify-center">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "whatsapp" && <WhatsAppTab config={config} />}
            {activeTab === "voices" && <VoicesTab config={config} />}
            {activeTab === "scripts" && <ScriptsTab scripts={scripts} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WHATSAPP TAB — Fully Working with Real Data
   ═══════════════════════════════════════════════════════════════ */
function WhatsAppTab({ config }) {
  const { isDark } = useTheme();
  const fetcher = useFetcher();
  const isSaving = fetcher.state !== "idle";

  // Automation toggles
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    config.whatsappEnabled ?? true,
  );
  const [waAutoConfirm, setWaAutoConfirm] = useState(config.waAutoConfirm);
  const [waUpdateNotify, setWaUpdateNotify] = useState(config.waUpdateNotify);
  const [waAutoReplies, setWaAutoReplies] = useState(config.waAutoReplies);
  const [waTimeoutMinutes, setWaTimeoutMinutes] = useState(
    config.waTimeoutMinutes || 5,
  );

  // Timing
  const [initialDelay, setInitialDelay] = useState(config.initialDelay);
  const [retryInterval, setRetryInterval] = useState(config.retryInterval);

  // Twilio credentials
  const [twilioSid, setTwilioSid] = useState(config.twilioSid);
  const [twilioToken, setTwilioToken] = useState(config.twilioToken);
  const [twilioWaFrom, setTwilioWaFrom] = useState(config.twilioWaFrom);

  // UI states
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("success"); // success | error
  const [connectionStatus, setConnectionStatus] = useState("unknown"); // unknown | checking | connected | failed
  const [connectionError, setConnectionError] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testNumber, setTestNumber] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [waStats, setWaStats] = useState({
    sent: 0,
    replied: 0,
    pending: 0,
    failed: 0,
  });

  // Fetch WhatsApp stats on mount
  useEffect(() => {
    fetch("/api/whatsapp-stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setWaStats(data.stats);
      })
      .catch(() => {});
  }, []);

  // Auto-check connection on mount if credentials exist
  useEffect(() => {
    if (twilioSid && twilioToken) {
      checkConnection();
    }
  }, []);

  // Toast on save
  useEffect(() => {
    if (fetcher.data?.success) {
      showToastMsg("WhatsApp settings saved successfully", "success");
    } else if (fetcher.data && !fetcher.data.success) {
      showToastMsg("✗ Failed to save settings", "error");
    }
  }, [fetcher.data]);

  const showToastMsg = (msg, type = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  // ── Test Twilio connection ───────────────────────────────────
  const checkConnection = async () => {
    if (!twilioSid || !twilioToken) {
      setConnectionStatus("failed");
      setConnectionError("Missing Account SID or Auth Token");
      return;
    }

    setConnectionStatus("checking");
    setConnectionError("");

    try {
      const res = await fetch("/api/whatsapp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "check-connection",
          twilioSid,
          twilioToken,
          twilioWaFrom,
        }),
      });
      const data = await res.json();

      if (data.connected) {
        setConnectionStatus("connected");
        setConnectionError("");
        showToastMsg(" Twilio connection verified", "success");
      } else {
        setConnectionStatus("failed");
        setConnectionError(data.error || "Connection failed");
        showToastMsg("✗ " + (data.error || "Connection failed"), "error");
      }
    } catch (err) {
      setConnectionStatus("failed");
      setConnectionError(err.message);
      showToastMsg("✗ Connection check failed", "error");
    }
  };

  // ── Send test WhatsApp message ───────────────────────────────
  const sendTestMessage = async () => {
    if (!testNumber) {
      showToastMsg("✗ Please enter a phone number", "error");
      return;
    }

    setIsTesting(true);
    try {
      const res = await fetch("/api/whatsapp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "send-test",
          twilioSid,
          twilioToken,
          twilioWaFrom,
          testNumber,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToastMsg(`✓ Test message sent to ${testNumber}`, "success");
        setShowTestModal(false);
        setTestNumber("");
      } else {
        showToastMsg("✗ " + (data.error || "Failed to send"), "error");
      }
    } catch (err) {
      showToastMsg("✗ " + err.message, "error");
    }
    setIsTesting(false);
  };

  // ── Save all settings ────────────────────────────────────────
  const handleSave = () => {
    fetcher.submit(
      {
        intent: "save-whatsapp",
        waAutoConfirm: String(waAutoConfirm),
        waUpdateNotify: String(waUpdateNotify),
        waAutoReplies: String(waAutoReplies),
        waTimeoutMinutes: String(waTimeoutMinutes),
        initialDelay,
        retryInterval,
        twilioSid,
        twilioToken,
        twilioWaFrom,
        whatsappEnabled: String(whatsappEnabled),
      },
      { method: "post" },
    );
  };

  // Webhook URL for Twilio setup
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/whatsapp-webhook`
      : "/api/whatsapp-webhook";

  return (
    <div className="max-w-4xl space-y-10">
      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl font-bold shadow-xl flex items-center gap-2 ${
              toastType === "success"
                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                : "bg-rose-500 text-white shadow-rose-500/30"
            }`}
          >
            {toastType === "success" ? <CheckIcon className="w-5 h-5" /> : "⚠"}{" "}
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ CONNECTION STATUS CARD ═══════ */}
      <div
        className={`p-8 rounded-[2rem] border-2 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                connectionStatus === "connected"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : connectionStatus === "failed"
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-amber-500/10 text-amber-500"
              }`}
            >
              <WhatsAppIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">
                WhatsApp Business{" "}
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "failed"
                    ? "Disconnected"
                    : twilioSid
                      ? "Not Verified"
                      : "Not Configured"}
              </h3>
              <p className="text-slate-500 font-medium text-sm">
                {twilioWaFrom || "No number configured"}
                {connectionError && (
                  <span className="text-rose-400 ml-2">
                    — {connectionError}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={checkConnection}
              disabled={connectionStatus === "checking"}
              className={`px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all ${
                connectionStatus === "checking"
                  ? "opacity-60 cursor-not-allowed bg-slate-200 dark:bg-slate-800"
                  : isDark
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {connectionStatus === "checking" ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin" /> Checking...
                </>
              ) : (
                <>
                  <SpinnerIcon className="w-4 h-4" /> Test Connection
                </>
              )}
            </button>
            <div
              className={`flex items-center gap-2 font-bold px-4 py-2.5 rounded-full border text-sm ${
                connectionStatus === "connected"
                  ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  : connectionStatus === "failed"
                    ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                    : "text-amber-500 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : connectionStatus === "failed"
                      ? "bg-rose-500"
                      : connectionStatus === "checking"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-amber-500"
                }`}
              ></div>
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "failed"
                  ? "Disconnected"
                  : connectionStatus === "checking"
                    ? "Checking..."
                    : "Unknown"}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ WHATSAPP STATS ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Messages Sent",
            value: waStats.sent,
            color: "violet",
            icon: "📤",
          },
          {
            label: "Replies Received",
            value: waStats.replied,
            color: "emerald",
            icon: "✅",
          },
          {
            label: "Pending",
            value: waStats.pending,
            color: "amber",
            icon: "⏳",
          },
          {
            label: "Failed / Timed Out",
            value: waStats.failed,
            color: "rose",
            icon: "❌",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-5 rounded-2xl border-2 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
          >
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className="text-2xl font-black">{stat.value}</p>
            <p className="text-xs text-slate-400 font-bold mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ═══════ AUTOMATION SETTINGS ═══════ */}
      <div
        className={`p-8 rounded-[2rem] border-2 space-y-6 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <h4 className="text-lg font-bold flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-500 text-sm">
            ⚙
          </span>
          Automation Settings
        </h4>
        <div className="space-y-5">
          <Toggle
            title="Enable WhatsApp Order Confirmation"
            subtitle="Automatically send order confirmation message via WhatsApp before initiating AI call."
            value={whatsappEnabled}
            onChange={setWhatsappEnabled}
          />
          <Toggle
            title="Auto-send order confirmations (Fallback)"
            subtitle="Automatically send WhatsApp message to customers when AI calls fail after max retries"
            value={waAutoConfirm}
            onChange={setWaAutoConfirm}
          />
          <Toggle
            title="Delivery update notifications"
            subtitle="Send WhatsApp alerts when order delivery status changes (shipped, out for delivery, delivered)"
            value={waUpdateNotify}
            onChange={setWaUpdateNotify}
          />
          <Toggle
            title="AI auto-replies"
            subtitle="Automatically handle common questions from customers via AI chatbot."
            value={waAutoReplies}
            onChange={setWaAutoReplies}
          />

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold mb-0.5">Timeout for AI Call Fallback</p>
                <p className="text-sm text-slate-500">
                  Wait for customer reply for this long before starting the AI
                  call.
                </p>
              </div>
              <div className="w-32">
                <Select
                  value={waTimeoutMinutes}
                  onChange={(e) =>
                    setWaTimeoutMinutes(parseInt(e.target.value, 10))
                  }
                >
                  <option value={1}>1 Minute</option>
                  <option value={2}>2 Minutes</option>
                  <option value={5}>5 Minutes</option>
                  <option value={10}>10 Minutes</option>
                  <option value={15}>15 Minutes</option>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ TIMING ═══════ */}
      <div
        className={`p-8 rounded-[2rem] border-2 space-y-6 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <h4 className="text-lg font-bold flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 text-sm">
            ⏱
          </span>
          Timing & Retry Settings
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
              Initial Delay Before First Call
            </label>
            <Select
              value={initialDelay}
              onChange={(e) => setInitialDelay(e.target.value)}
            >
              <option value="immediate">Immediate (when order arrives)</option>
              <option value="5min">5 minutes</option>
              <option value="15min">15 minutes</option>
              <option value="30min">30 minutes</option>
              <option value="1hour">1 hour</option>
            </Select>
            <p className="text-[11px] text-slate-400 pl-1">
              Time to wait after a new COD order is placed before the first AI
              call attempt
            </p>
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
              Retry Interval (Between Calls)
            </label>
            <Select
              value={retryInterval}
              onChange={(e) => setRetryInterval(e.target.value)}
            >
              <option value="5min">5 minutes</option>
              <option value="30min">30 minutes</option>
              <option value="2hours">2 hours (Default)</option>
              <option value="4hours">4 hours</option>
              <option value="nextday">Next day</option>
            </Select>
            <p className="text-[11px] text-slate-400 pl-1">
              Wait time between retry attempts if the customer doesn't answer
            </p>
          </div>
        </div>
      </div>

      {/* ═══════ TWILIO CREDENTIALS ═══════ */}
      <div
        className={`p-8 rounded-[2rem] border-2 space-y-6 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 text-sm">
              🔑
            </span>
            Twilio / WhatsApp Credentials
          </h4>
          <button
            onClick={() => setShowTestModal(true)}
            disabled={!twilioSid || !twilioToken || !twilioWaFrom}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all ${
              !twilioSid || !twilioToken || !twilioWaFrom
                ? "opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400"
                : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95"
            }`}
          >
            <WhatsAppIcon className="w-4 h-4" /> Send Test Message
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Twilio Account SID"
            value={twilioSid}
            onChange={setTwilioSid}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            type="password"
          />
          <InputField
            label="Twilio Auth Token"
            value={twilioToken}
            onChange={setTwilioToken}
            placeholder="Your auth token"
            type="password"
          />
        </div>
        <InputField
          label="WhatsApp From Number"
          value={twilioWaFrom}
          onChange={setTwilioWaFrom}
          placeholder="whatsapp:+14155238886"
        />

        {/* Webhook URL */}
        <div
          className={`p-5 rounded-2xl border-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-100"}`}
        >
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
            Webhook URL (for Twilio Console)
          </label>
          <div className="flex items-center gap-3">
            <code
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-mono break-all ${isDark ? "bg-slate-800 text-emerald-400" : "bg-white text-emerald-600 border border-slate-200"}`}
            >
              {webhookUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                showToastMsg("✓ Webhook URL copied!", "success");
              }}
              className={`px-4 py-3 rounded-xl font-bold text-xs transition-all ${isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-white border border-slate-200 hover:bg-slate-50"}`}
            >
              Copy
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 pl-1">
            Paste this URL in your Twilio Console → Messaging → WhatsApp Sandbox
            → "When a message comes in"
          </p>
        </div>
      </div>
      <div>
        {/* ═══════ SAVE BUTTON ═══════ */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-8 py-3.5 bg-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-violet-600/20 active:scale-95 transition-all flex items-center gap-2 ${isSaving ? "opacity-60 cursor-not-allowed" : "hover:bg-violet-700"}`}
          >
            {isSaving ? (
              <>
                <SpinnerIcon className="w-5 h-5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <SaveIcon className="w-5 h-5" /> Save Settings
              </>
            )}
          </button>
        </div>

        {/* ═══════ TEST MESSAGE MODAL ═══════ */}
        <AnimatePresence>
          {showTestModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowTestModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-md p-8 rounded-3xl border-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <WhatsAppIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Send Test WhatsApp Message</h4>
                    <p className="text-xs text-slate-400">
                      Make sure the number has joined your Twilio Sandbox
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      placeholder="+919876543210"
                      className={`w-full h-14 px-5 rounded-2xl border-2 outline-none font-bold text-sm transition-all focus:border-violet-500 ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100"}`}
                    />
                  </div>
                  <p
                    className={`text-xs p-3 rounded-xl ${isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"}`}
                  >
                    ⚠ The recipient must have joined your Twilio WhatsApp
                    Sandbox first (send "join [keyword]" to your sandbox number)
                  </p>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => setShowTestModal(false)}
                    className={`flex-1 h-12 rounded-2xl font-bold text-sm border-2 ${isDark ? "border-slate-800 text-white hover:bg-slate-800" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendTestMessage}
                    disabled={isTesting || !testNumber}
                    className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      isTesting || !testNumber
                        ? "bg-emerald-600/50 text-white cursor-not-allowed"
                        : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95"
                    }`}
                  >
                    {isTesting ? (
                      <>
                        <SpinnerIcon className="w-4 h-4 animate-spin" />{" "}
                        Sending...
                      </>
                    ) : (
                      <>
                        <WhatsAppIcon className="w-4 h-4" /> Send Test
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VOICES TAB — Premium SaaS-Level AI Voice Selector
   ═══════════════════════════════════════════════════════════════ */
function VoicesTab({ config }) {
  const { isDark } = useTheme();
  const fetcher = useFetcher();
  const isSaving = fetcher.state !== "idle";

  // ── State ────────────────────────────────────────────────────
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState(
    config.selectedVoice || "11labs-sarah",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLang, setFilterLang] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [testText, setTestText] = useState(
    "Namaste, your order has been confirmed. Thank you for shopping with us!",
  );

  // ── Vapi settings (keep existing) ────────────────────────────
  const [vapiApiKey, setVapiApiKey] = useState(config.vapiApiKey);
  const [vapiPhoneId, setVapiPhoneId] = useState(config.vapiPhoneId);
  const [vapiAssistantId, setVapiAssistantId] = useState(
    config.vapiAssistantId,
  );
  const [callLanguage, setCallLanguage] = useState(config.callLanguage);
  const [maxRetries, setMaxRetries] = useState(config.maxRetries);

  // ── Fetch voices ─────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        setVoices(data.voices || []);
        if (data.selectedVoiceId) setSelectedVoiceId(data.selectedVoiceId);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Toast on save ────────────────────────────────────────────
  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMsg(fetcher.data.message || "✓ Settings saved!");
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [fetcher.data]);

  // ── Select voice handler ─────────────────────────────────────
  const handleSelectVoice = (voice) => {
    setSelectedVoiceId(voice.id);
    const formData = new FormData();
    formData.set("intent", "select");
    formData.set("voiceId", voice.id);
    formData.set("voiceName", voice.name);
    formData.set("voiceProvider", voice.provider);
    fetch("/api/voices", { method: "POST", body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setToastMsg(`✓ "${voice.name}" selected as active voice`);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      });
  };

  // ── Preview play (real audio via SpeechSynthesis) ──────────
  const handlePlayPreview = (voice) => {
    // If already playing this voice, stop it
    if (playingVoiceId === voice.id) {
      window.speechSynthesis.cancel();
      setPlayingVoiceId(null);
      return;
    }

    // Stop any currently playing voice
    window.speechSynthesis.cancel();
    setPlayingVoiceId(voice.id);

    // Build the speech utterance
    const previewText =
      testText ||
      "Namaste, your order has been confirmed. Thank you for shopping with us!";
    const utterance = new SpeechSynthesisUtterance(previewText);

    // Try to match a browser voice by language
    const langCode = voice.language || "en-US";
    const availableVoices = window.speechSynthesis.getVoices();
    const matchedVoice = availableVoices.find((v) =>
      v.lang.startsWith(langCode.slice(0, 2)),
    );
    if (matchedVoice) utterance.voice = matchedVoice;
    utterance.lang = langCode;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => setPlayingVoiceId(null);
    utterance.onerror = () => setPlayingVoiceId(null);

    window.speechSynthesis.speak(utterance);
  };

  // ── Save Vapi settings ───────────────────────────────────────
  const handleSaveSettings = () => {
    fetcher.submit(
      {
        intent: "save-voice",
        selectedVoice: selectedVoiceId,
        vapiApiKey,
        vapiPhoneId,
        vapiAssistantId,
        callLanguage,
        maxRetries: String(maxRetries),
      },
      { method: "post" },
    );
  };

  // ── Filter logic ─────────────────────────────────────────────
  const filtered = voices.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.style.toLowerCase().includes(q) ||
      v.accent.toLowerCase().includes(q);
    const matchesLang = filterLang === "all" || v.language === filterLang;
    const matchesProv =
      filterProvider === "all" || v.provider === filterProvider;
    const matchesGender = filterGender === "all" || v.gender === filterGender;
    return matchesSearch && matchesLang && matchesProv && matchesGender;
  });

  // ── Unique values for filters ────────────────────────────────
  const languages = [...new Set(voices.map((v) => v.language))].sort();
  const providers = [...new Set(voices.map((v) => v.provider))].sort();
  const genders = [...new Set(voices.map((v) => v.gender))].sort();

  // ── Provider colors ──────────────────────────────────────────
  const providerColor = {
    "11labs": {
      bg: "bg-violet-500/10",
      text: "text-violet-500",
      border: "border-violet-500/20",
    },
    openai: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
      border: "border-emerald-500/20",
    },
    azure: {
      bg: "bg-blue-500/10",
      text: "text-blue-500",
      border: "border-blue-500/20",
    },
    deepgram: {
      bg: "bg-amber-500/10",
      text: "text-amber-500",
      border: "border-amber-500/20",
    },
  };

  return (
    <div className="space-y-10">
      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-emerald-500/30 flex items-center gap-2"
          >
            <CheckIcon className="w-5 h-5" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ SEARCH & FILTER BAR ═══════ */}
      <div
        className={`p-6 rounded-[2rem] border-2 ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 w-full lg:max-w-xs">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search voices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-12 pl-11 pr-4 rounded-xl border-2 outline-none text-sm font-medium transition-all focus:border-violet-500 ${isDark ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-100 placeholder:text-slate-400"}`}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect
              label="Language"
              value={filterLang}
              onChange={setFilterLang}
              options={[
                { value: "all", label: "All Languages" },
                ...languages.map((l) => ({ value: l, label: l })),
              ]}
            />
            <FilterSelect
              label="Provider"
              value={filterProvider}
              onChange={setFilterProvider}
              options={[
                { value: "all", label: "All Providers" },
                ...providers.map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                })),
              ]}
            />
            <FilterSelect
              label="Gender"
              value={filterGender}
              onChange={setFilterGender}
              options={[
                { value: "all", label: "All Genders" },
                ...genders.map((g) => ({ value: g, label: g })),
              ]}
            />
          </div>

          <div className="text-xs font-bold text-slate-400 whitespace-nowrap">
            {filtered.length} of {voices.length} voices
          </div>
        </div>
      </div>

      {/* ═══════ VOICE GRID ═══════ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`p-6 rounded-3xl border-2 animate-pulse ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
            >
              <div
                className={`w-14 h-14 rounded-2xl mb-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              />
              <div
                className={`h-5 w-24 rounded-lg mb-2 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              />
              <div
                className={`h-3 w-32 rounded-lg mb-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              />
              <div className="flex gap-2">
                <div
                  className={`h-6 w-16 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                />
                <div
                  className={`h-6 w-12 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center py-20 rounded-[2rem] border-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
        >
          <VoiceIcon className="w-12 h-12 text-slate-300 mb-4" />
          <p className="font-bold text-lg mb-1">No voices found</p>
          <p className="text-sm text-slate-400">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((voice, i) => {
            const isSelected = selectedVoiceId === voice.id;
            const isPlaying = playingVoiceId === voice.id;
            const pColor =
              providerColor[voice.provider] || providerColor["11labs"];

            return (
              <motion.div
                key={voice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className={`relative p-6 rounded-3xl border-2 cursor-pointer transition-all overflow-hidden group ${
                  isSelected
                    ? "border-violet-500 ring-4 ring-violet-500/10 shadow-lg shadow-violet-500/10"
                    : isDark
                      ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                      : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200"
                }`}
                style={
                  isSelected
                    ? {
                        background: isDark
                          ? "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(15,23,42,1))"
                          : "linear-gradient(135deg, rgba(139,92,246,0.04), rgba(255,255,255,1))",
                      }
                    : undefined
                }
              >
                {/* Recommended badge */}
                {voice.recommended && (
                  <div className="absolute top-4 right-4 px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider">
                    ⭐ Recommended
                  </div>
                )}

                {/* Selected check */}
                {isSelected && (
                  <div className="absolute top-4 left-4">
                    <div className="w-7 h-7 bg-violet-600 rounded-full flex items-center justify-center shadow-lg shadow-violet-600/30">
                      <CheckIcon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                {/* Avatar */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black mb-4 transition-all ${
                    isSelected
                      ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                      : isDark
                        ? "bg-slate-800 text-slate-400"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {voice.name.charAt(0)}
                </div>

                {/* Name + Style */}
                <h4 className="font-bold text-lg mb-0.5">{voice.name}</h4>
                <p className="text-xs text-slate-400 mb-4">{voice.style}</p>

                {/* Tags row */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${pColor.bg} ${pColor.text} ${pColor.border}`}
                  >
                    {voice.provider.toUpperCase()}
                  </span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${isDark ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                  >
                    {voice.language}
                  </span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${isDark ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                  >
                    {voice.gender}
                  </span>
                  {voice.accent && (
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${isDark ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                    >
                      {voice.accent}
                    </span>
                  )}
                </div>

                {/* Waveform (visible when playing) */}
                {isPlaying && (
                  <div className="flex items-center justify-center gap-0.5 h-8 mb-4">
                    {[
                      0.3, 0.6, 1, 0.5, 0.8, 0.4, 0.9, 0.3, 0.7, 0.5, 0.8, 0.6,
                    ].map((h, wi) => (
                      <motion.div
                        key={wi}
                        animate={{
                          height: [`${h * 20}%`, `${h * 100}%`, `${h * 20}%`],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.5 + wi * 0.08,
                          ease: "easeInOut",
                        }}
                        className="w-1 bg-violet-500 rounded-full"
                      />
                    ))}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPreview(voice);
                    }}
                    className={`flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isPlaying
                        ? "bg-violet-600 text-white"
                        : isDark
                          ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <StopIcon className="w-3.5 h-3.5" /> Stop
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-3.5 h-3.5" /> Preview
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectVoice(voice);
                    }}
                    disabled={isSelected}
                    className={`flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isSelected
                        ? "bg-violet-600/10 text-violet-500 border border-violet-500/20 cursor-default"
                        : "bg-violet-600 text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 active:scale-95"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5" /> Active
                      </>
                    ) : (
                      "Select"
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══════ TEST VOICE SECTION ═══════ */}
      <div
        className={`p-8 rounded-[2rem] border-2 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-500">
            <SpeakerIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold">Test Selected Voice</h4>
            <p className="text-xs text-slate-400">
              Type custom text and hear how the selected voice sounds
            </p>
          </div>
        </div>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Type text to test..."
          className={`w-full h-28 p-5 rounded-2xl border-2 outline-none text-sm leading-relaxed resize-none transition-all focus:border-violet-500 ${isDark ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-600" : "bg-slate-50 border-slate-100 placeholder:text-slate-400"}`}
        />
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-400">
            Using voice:{" "}
            <span className="text-violet-500 font-bold">
              {voices.find((v) => v.id === selectedVoiceId)?.name || "None"}
            </span>
          </p>
          <button
            onClick={() => {
              const selectedVoice = voices.find(
                (v) => v.id === selectedVoiceId,
              );
              if (selectedVoice) handlePlayPreview(selectedVoice);
            }}
            className="px-6 py-3 bg-violet-600 text-white rounded-2xl font-bold shadow-lg shadow-violet-600/20 active:scale-95 transition-all flex items-center gap-2 hover:bg-violet-700"
          >
            <SpeakerIcon className="w-4 h-4" /> Test Voice
          </button>
        </div>
      </div>

      {/* ═══════ VAPI CONFIGURATION ═══════ */}
      <div className="space-y-6">
        <h4 className="text-lg font-bold">Vapi AI Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Vapi API Key"
            value={vapiApiKey}
            onChange={setVapiApiKey}
            placeholder="Your Vapi API key"
            type="password"
          />
          <InputField
            label="Phone Number ID"
            value={vapiPhoneId}
            onChange={setVapiPhoneId}
            placeholder="Vapi phone number ID"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField
            label="Assistant ID"
            value={vapiAssistantId}
            onChange={setVapiAssistantId}
            placeholder="Vapi assistant ID"
          />
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
              Call Language
            </label>
            <Select
              value={callLanguage}
              onChange={(e) => setCallLanguage(e.target.value)}
            >
              <option value="hindi">Hindi</option>
              <option value="english">English</option>
              <option value="gujarati">Gujarati</option>
            </Select>
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
              Max Retries
            </label>
            <Select
              value={String(maxRetries)}
              onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3 (Default)</option>
              <option value="5">5</option>
              <option value="10">10</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className={`px-8 py-3.5 bg-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-violet-600/20 active:scale-95 transition-all flex items-center gap-2 ${isSaving ? "opacity-60 cursor-not-allowed" : "hover:bg-violet-700"}`}
        >
          {isSaving ? (
            <>
              <SpinnerIcon className="w-5 h-5 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <SaveIcon className="w-5 h-5" /> Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Compact filter dropdown */
function FilterSelect({ label, value, onChange, options }) {
  const { isDark } = useTheme();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 px-3 rounded-xl border-2 text-xs font-bold outline-none appearance-none cursor-pointer transition-all focus:border-violet-500 ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-100 text-slate-600"}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCRIPTS TAB
   ═══════════════════════════════════════════════════════════════ */
function ScriptsTab({ scripts: initialScripts }) {
  const { isDark } = useTheme();
  const fetcher = useFetcher();
  const isSaving = fetcher.state !== "idle";

  const [scripts, setScripts] = useState(initialScripts);
  const [selectedScript, setSelectedScript] = useState(
    initialScripts.find((s) => s.isActive) || initialScripts[0] || null,
  );
  const [editName, setEditName] = useState(selectedScript?.name || "");
  const [editBody, setEditBody] = useState(selectedScript?.body || "");
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");

  useEffect(() => {
    if (selectedScript) {
      setEditName(selectedScript.name);
      setEditBody(selectedScript.body);
    }
  }, [selectedScript]);

  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMsg(fetcher.data.message);
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [fetcher.data]);

  const handleSelectScript = (script) => {
    setSelectedScript(script);
  };

  const handleSaveScript = () => {
    if (!selectedScript) return;
    fetcher.submit(
      {
        intent: "save-script",
        scriptId: selectedScript.id,
        scriptName: editName,
        scriptBody: editBody,
      },
      { method: "post" },
    );
    // Optimistic update
    setScripts((prev) =>
      prev.map((s) =>
        s.id === selectedScript.id
          ? { ...s, name: editName, body: editBody }
          : s,
      ),
    );
    setSelectedScript((prev) =>
      prev ? { ...prev, name: editName, body: editBody } : prev,
    );
  };

  const handleSetActive = (script) => {
    fetcher.submit(
      { intent: "set-active-script", scriptId: script.id },
      { method: "post" },
    );
    // Optimistic update
    setScripts((prev) =>
      prev.map((s) => ({ ...s, isActive: s.id === script.id })),
    );
    setSelectedScript((prev) =>
      prev && prev.id === script.id ? { ...prev, isActive: true } : prev,
    );
  };

  const handleCreateScript = () => {
    if (!newScriptName.trim()) return;
    fetcher.submit(
      {
        intent: "create-script",
        scriptName: newScriptName,
        scriptBody:
          "Hi {{CUSTOMER_NAME}}, confirming your order #{{ORDER_ID}} worth ₹{{TOTAL}}.",
      },
      { method: "post" },
    );
    setShowCreateModal(false);
    setNewScriptName("");
    // Re-fetch happens via revalidation
  };

  const handleDeleteScript = (id) => {
    if (scripts.length <= 1) return; // Prevent deleting last script
    fetcher.submit(
      { intent: "delete-script", scriptId: id },
      { method: "post" },
    );
    // Optimistic update
    const remaining = scripts.filter((s) => s.id !== id);
    setScripts(remaining);
    if (selectedScript?.id === id) {
      setSelectedScript(remaining[0] || null);
    }
  };

  const insertVariable = (varName) => {
    const tag = `{{${varName}}}`;
    setEditBody((prev) => prev + tag);
  };

  const vars = [
    "ORDER_ID",
    "CUSTOMER_NAME",
    "TOTAL",
    "PRODUCT_LIST",
    "ADDRESS",
    "DELIVERY_DATE",
    "STORE_NAME",
  ];

  return (
    <div className="space-y-8">
      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold shadow-xl"
          >
            ✓ {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Script Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`p-8 rounded-3xl shadow-2xl w-full max-w-md ${isDark ? "bg-slate-900" : "bg-white"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-6">Create New Script</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Script Name
                  </label>
                  <input
                    type="text"
                    value={newScriptName}
                    onChange={(e) => setNewScriptName(e.target.value)}
                    placeholder="e.g. Follow-up Script"
                    className={`w-full h-12 px-4 rounded-xl border-2 outline-none font-medium transition-all focus:border-violet-500 ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200"}`}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm border-2 ${isDark ? "border-slate-700" : "border-slate-200"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateScript}
                    className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Script List */}
        <div className="md:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Saved Scripts
            </h4>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-violet-600 font-bold text-xs hover:underline"
            >
              + Create New
            </button>
          </div>
          <div className="space-y-3">
            {scripts.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectScript(s)}
                className={`p-5 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  selectedScript?.id === s.id
                    ? "border-violet-500 bg-violet-600/5"
                    : isDark
                      ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                      : "bg-white border-slate-100 shadow-sm hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <ScriptIcon
                    className={`w-5 h-5 ${selectedScript?.id === s.id ? "text-violet-500" : "text-slate-400"}`}
                  />
                  <div className="font-bold flex items-center gap-2">
                    {s.name}
                    {s.isActive && (
                      <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded ml-1">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRightIcon
                  className={`w-4 h-4 ${selectedScript?.id === s.id ? "text-violet-500" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Script Editor */}
        <div className="md:col-span-8 space-y-6">
          {selectedScript ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Script Editor</h3>
                <div className="flex gap-3">
                  {!selectedScript.isActive && (
                    <button
                      onClick={() => handleSetActive(selectedScript)}
                      className={`px-5 py-2.5 border-2 rounded-2xl font-bold text-sm transition-all ${isDark ? "border-slate-800 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      Set as Active
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteScript(selectedScript.id)}
                    disabled={scripts.length <= 1}
                    className={`px-5 py-2.5 border-2 rounded-2xl font-bold text-sm text-rose-500 transition-all ${scripts.length <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-rose-50 dark:hover:bg-rose-500/10"} ${isDark ? "border-slate-800" : "border-slate-200"}`}
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleSaveScript}
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-violet-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-violet-600/20 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <SpinnerIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <SaveIcon className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Script Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                  Script Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full h-14 px-5 rounded-2xl border-2 outline-none font-bold text-sm transition-all focus:border-violet-500 ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100"}`}
                />
              </div>

              <div
                className={`p-6 rounded-3xl border-2 space-y-4 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-100"}`}
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Insert Variable
                </p>
                <div className="flex flex-wrap gap-2">
                  {vars.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="px-3 py-1.5 rounded-xl bg-violet-600/10 text-violet-600 border border-violet-200 dark:border-violet-500/20 text-xs font-bold hover:scale-105 transition-transform"
                    >
                      {"{{" + v + "}}"}
                    </button>
                  ))}
                </div>
                <textarea
                  className={`w-full p-6 h-64 rounded-2xl border-2 outline-none font-mono text-sm leading-relaxed transition-all focus:border-violet-500 ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100"}`}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
              </div>

              {/* Live Preview */}
              <div
                className={`p-6 rounded-3xl border-2 space-y-3 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-violet-50 border-violet-100"}`}
              >
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest flex items-center gap-2">
                  <EyeIcon className="w-4 h-4" /> Live Preview
                </p>
                <div
                  className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}
                >
                  {editBody
                    .replace(/\{\{CUSTOMER_NAME\}\}/g, "John Doe")
                    .replace(/\{\{ORDER_ID\}\}/g, "1234")
                    .replace(/\{\{TOTAL\}\}/g, "599.00")
                    .replace(/\{\{PRODUCT_LIST\}\}/g, "1x Widget, 2x Gadget")
                    .replace(/\{\{ADDRESS\}\}/g, "123 Main St, Mumbai")
                    .replace(/\{\{DELIVERY_DATE\}\}/g, "March 25, 2025")
                    .replace(/\{\{STORE_NAME\}\}/g, "My Shopify Store")}
                </div>
              </div>
            </>
          ) : (
            <div
              className={`flex items-center justify-center h-64 rounded-3xl border-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
            >
              <p className="text-slate-400 font-bold">
                Select a script or create one
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REUSABLE UI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
function Toggle({ title, subtitle, value, onChange }) {
  return (
    <div
      className="flex items-center justify-between group cursor-pointer"
      onClick={() => onChange(!value)}
    >
      <div className="flex-1 pr-6">
        <p className="font-bold mb-0.5 group-hover:text-violet-600 transition-colors">
          {title}
        </p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div
        className={`w-14 h-8 rounded-full transition-all relative ${value ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-700"}`}
      >
        <div
          className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${value ? "left-7" : "left-1"}`}
        />
      </div>
    </div>
  );
}

function Select({ children, value, onChange }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full h-14 px-5 rounded-2xl border-2 bg-transparent dark:border-slate-800 outline-none font-bold text-sm appearance-none cursor-pointer transition-all focus:border-violet-500"
    >
      {children}
    </select>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }) {
  const { isDark } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === "password" && !showPassword ? "password" : "text";

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-14 px-5 rounded-2xl border-2 outline-none font-medium text-sm transition-all focus:border-violet-500 ${isDark ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-600" : "bg-white border-slate-100 placeholder:text-slate-300"} ${type === "password" ? "pr-14" : ""}`}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? (
              <EyeOffIcon className="w-5 h-5" />
            ) : (
              <EyeIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════ */
const WhatsAppIcon = (props) => (
  <svg {...props} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .011 5.404.008 12.038c0 2.12.553 4.189 1.602 6.039L0 24l6.102-1.601a11.8 11.8 0 005.943 1.603h.005c6.634 0 12.038-5.405 12.041-12.04.001-3.214-1.248-6.234-3.513-8.5a11.76 11.76 0 00-8.536-3.502z" />
  </svg>
);
const VoiceIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
    />
  </svg>
);
const ScriptIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);
const SpeakerIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0"
    />
  </svg>
);
const CheckIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={3}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const ChevronRightIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
const SaveIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
    />
  </svg>
);
const SpinnerIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);
const EyeIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);
const EyeOffIcon = (props) => (
  <svg
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
);
const PlayIcon = (props) => (
  <svg {...props} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const StopIcon = (props) => (
  <svg {...props} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </svg>
);
