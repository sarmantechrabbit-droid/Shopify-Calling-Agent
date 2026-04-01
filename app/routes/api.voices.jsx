import prisma from "../db.server.js";

/**
 * GET  /api/voices → fetches REAL voices from Vapi API
 * POST /api/voices → { intent: "select", voiceId, ... } to select a voice
 */

const VAPI_BASE_URL = "https://api.vapi.ai";

/* ─────────────────────────────────────────────────────────────
   Get Vapi API key from DB → env fallback
   ───────────────────────────────────────────────────────────── */
async function getVapiApiKey() {
  try {
    const config = await prisma.appConfig.findFirst({ where: { shop: "default" } });
    if (config?.vapiApiKey) return config.vapiApiKey;
  } catch (_) {}
  return process.env.VAPI_API_KEY || "";
}

/* ─────────────────────────────────────────────────────────────
   Fetch real voices from Vapi API
   ───────────────────────────────────────────────────────────── */
async function fetchRealVoices(apiKey) {
  if (!apiKey) {
    console.warn("[Voices] No Vapi API key configured");
    return [];
  }

  const allVoices = [];

  // 1. Try GET /voice (Vapi's voice listing)
  try {
    const res = await fetch(`${VAPI_BASE_URL}/voice`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const v of data) {
          allVoices.push(normalizeVoice(v, "vapi"));
        }
        console.log(`[Voices] Fetched ${data.length} voices from GET /voice`);
      }
    } else {
      console.log(`[Voices] GET /voice returned ${res.status}`);
    }
  } catch (err) {
    console.error("[Voices] Error fetching /voice:", err.message);
  }

  // 2. Also fetch assistant to see what voice is configured there
  const assistantId = process.env.VAPI_ASSISTANT_ID || process.env.VAPI_ORDER_ASSISTANT_ID;
  if (assistantId) {
    try {
      const res = await fetch(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const assistant = await res.json();
        if (assistant?.voice) {
          const v = assistant.voice;
          const exists = allVoices.some(
            (ev) => ev.voiceId === (v.voiceId || v.id) && ev.provider === v.provider
          );
          if (!exists) {
            allVoices.unshift({
              ...normalizeVoice(v, "assistant"),
              recommended: true,
              style: "Currently Active on Assistant",
            });
          } else {
            // Mark the existing one as recommended
            const match = allVoices.find(
              (ev) => ev.voiceId === (v.voiceId || v.id) && ev.provider === v.provider
            );
            if (match) {
              match.recommended = true;
              match.style = match.style
                ? match.style + " • Active"
                : "Currently Active";
            }
          }
          console.log(`[Voices] Found assistant voice: ${v.voiceId || v.provider}`);
        }
      }
    } catch (err) {
      console.error("[Voices] Error fetching assistant:", err.message);
    }
  }

  // 3. Fetch all assistants to discover more voices in use
  try {
    const res = await fetch(`${VAPI_BASE_URL}/assistant`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const assistants = await res.json();
      if (Array.isArray(assistants)) {
        for (const a of assistants) {
          if (a.voice) {
            const v = a.voice;
            const exists = allVoices.some(
              (ev) => ev.voiceId === (v.voiceId || v.id) && ev.provider === v.provider
            );
            if (!exists) {
              allVoices.push({
                ...normalizeVoice(v, "assistant"),
                style: `Used in: ${a.name || "Unnamed Assistant"}`,
              });
            }
          }
        }
        console.log(`[Voices] Scanned ${assistants.length} assistants for voices`);
      }
    }
  } catch (err) {
    console.error("[Voices] Error fetching assistants:", err.message);
  }

  return allVoices;
}

/* ─────────────────────────────────────────────────────────────
   Normalize any voice object into our standard format
   ───────────────────────────────────────────────────────────── */
function normalizeVoice(v, source = "api") {
  const provider = v.provider || "unknown";
  const voiceId = v.voiceId || v.voice_id || v.id || "";
  const name =
    v.name ||
    voiceId.replace(/Neural$/i, "").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) ||
    "Unknown Voice";

  return {
    id: `${provider}-${voiceId}`,
    name,
    provider,
    voiceId,
    language: detectLanguage(v, voiceId),
    gender: detectGender(v, name),
    accent: detectAccent(v, voiceId),
    style: v.description || v.style || buildStyleFromProvider(provider),
    recommended: v.recommended || false,
    source,
  };
}

/* ── Detection helpers ──────────────────────────────────── */
function detectLanguage(v, voiceId) {
  if (v.language) return v.language;
  const id = String(voiceId).toLowerCase();
  if (id.includes("hi-in") || id.includes("hindi")) return "hi-IN";
  if (id.includes("gu-in") || id.includes("gujarati")) return "gu-IN";
  if (id.includes("en-in")) return "en-IN";
  if (id.includes("en-gb") || id.includes("en-uk")) return "en-UK";
  if (id.includes("en-au")) return "en-AU";
  if (id.includes("es-")) return "es";
  if (id.includes("fr-")) return "fr";
  if (id.includes("de-")) return "de";
  if (id.includes("ja-")) return "ja";
  return "en-US";
}

function detectGender(v, name) {
  if (v.gender) return v.gender;
  const n = String(name).toLowerCase();
  const femaleIndicators = [
    "female", "woman", "girl", "she",
    "sarah", "rachel", "nova", "shimmer", "elli", "domi", "charlotte",
    "swara", "dhwani", "neerja", "asteria", "luna", "jenny", "aria",
    "priya", "mary", "emma", "jessica",
  ];
  const maleIndicators = [
    "male", "man", "boy", "he",
    "josh", "drew", "clyde", "paul", "dave", "fin", "arnold",
    "echo", "onyx", "fable", "madhur", "dheer", "prabhat",
    "orion", "arcas", "james", "andrew", "guy", "ryan",
  ];
  if (femaleIndicators.some((i) => n.includes(i))) return "Female";
  if (maleIndicators.some((i) => n.includes(i))) return "Male";
  return "Unknown";
}

function detectAccent(v, voiceId) {
  if (v.accent) return v.accent;
  const id = String(voiceId).toLowerCase();
  if (id.includes("hi-in")) return "Indian";
  if (id.includes("gu-in")) return "Gujarati";
  if (id.includes("en-in")) return "Indian English";
  if (id.includes("en-gb") || id.includes("en-uk")) return "British";
  if (id.includes("en-au")) return "Australian";
  if (id.includes("en-us")) return "American";
  return "";
}

function buildStyleFromProvider(provider) {
  const map = {
    "11labs": "ElevenLabs Voice",
    openai: "OpenAI TTS",
    azure: "Azure Neural Voice",
    deepgram: "Deepgram Voice",
    playht: "PlayHT Voice",
    cartesia: "Cartesia Voice",
    rime: "Rime Voice",
    lmnt: "LMNT Voice",
  };
  return map[provider] || "AI Voice";
}

/* ═══════════════════════════════════════════════════════════
   LOADER — fetch real voices from Vapi
   ═══════════════════════════════════════════════════════════ */
export async function loader() {
  const apiKey = await getVapiApiKey();
  const voices = await fetchRealVoices(apiKey);

  // Get the current selected voice from DB
  let selectedVoiceId = null;
  try {
    const config = await prisma.appConfig.findFirst({ where: { shop: "default" } });
    selectedVoiceId = config?.selectedVoice || null;
  } catch (_) {}

  return Response.json({
    voices,
    selectedVoiceId,
    total: voices.length,
    apiKeyConfigured: !!apiKey,
  });
}

/* ═══════════════════════════════════════════════════════════
   ACTION — select a voice (saves to DB)
   ═══════════════════════════════════════════════════════════ */
export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "select") {
    const voiceId = formData.get("voiceId");
    const voiceName = formData.get("voiceName");
    const voiceProvider = formData.get("voiceProvider");

    await prisma.appConfig.upsert({
      where: { shop: "default" },
      update: { selectedVoice: voiceId },
      create: { shop: "default", selectedVoice: voiceId },
    });

    console.log(`[Voices] ✅ Selected: "${voiceName}" (${voiceProvider}) → ${voiceId}`);
    return Response.json({ success: true, message: `Voice "${voiceName}" (${voiceProvider}) selected` });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400 });
}
