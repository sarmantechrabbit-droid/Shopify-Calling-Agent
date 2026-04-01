# CLAUDE.md — AI Agent Shopify App

## Project Purpose

A Shopify embedded app that automatically confirms **Cash-on-Delivery (COD)** orders via AI phone calls (Vapi) and WhatsApp (Twilio). When a COD order arrives, the app sends a WhatsApp message first; if the customer doesn't respond within a configurable timeout, it falls back to an AI voice call via Vapi. Confirmed/cancelled orders update the order status in the database.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20.19 (ESM modules — `"type": "module"`) |
| Framework | React Router v7 (`@react-router/dev`) — **not Remix, not Next.js** |
| Shopify integration | `@shopify/shopify-app-react-router` v1 |
| UI | React 18 + Tailwind CSS v3 + Framer Motion |
| Database | PostgreSQL via Prisma v6 |
| AI calls | Vapi AI REST API (`https://api.vapi.ai`) |
| WhatsApp | Twilio SDK |
| Scheduling | `node-cron` + `setInterval` (interval-based cron, 30s) |
| Build | Vite 6 |
| Session storage | `@shopify/shopify-app-session-storage-prisma` |

---

## Folder Structure

```
app/
  components/       # React UI components (JSX only)
    DashboardComponents.jsx
    DashboardWidgets.jsx
    OrderComponents.jsx
    SubscriptionPage.jsx
    ThemeToggle.jsx
  constants.js      # Shared enums/constants (ORDER_STATUS, CALL_INTENT, etc.)
  contexts/
    ThemeContext.jsx # Dark/light theme context
  db.server.js      # Prisma client singleton
  shopify.server.js # Shopify app config, exports: authenticate, login, etc.
  root.jsx          # HTML shell, loads Tailwind + ThemeProvider
  routes/
    app.jsx             # Shopify AppProvider + nav layout
    app._index.jsx      # Dashboard (auto-refresh every 10s)
    app.orders.jsx      # Orders management page
    app.configuration.jsx # Vapi/Twilio config + script editor
    app.subscription.jsx  # Subscription management
    app.additional.jsx    # About page
    webhooks.orders.create.jsx  # Main webhook: COD order → WhatsApp/call
    webhooks.app.uninstalled.jsx
    webhooks.app.scopes_update.jsx
    api.vapi-webhook.jsx        # Vapi call status webhook
    api.order-vapi-webhook.jsx  # Vapi order call webhook
    api.whatsapp-webhook.jsx    # Twilio inbound WhatsApp replies
    api.calls.start.jsx
    api.calls.upload.jsx
    api.voices.jsx
    api.whatsapp-stats.jsx
    api.whatsapp-test.jsx
  services/
    orderCallService.server.js  # Core DB logic: create orders, handle call results, retry logic
    vapiService.server.js       # Low-level Vapi API wrapper
    vapiOrderService.server.js  # Order-specific Vapi call orchestration
    reminderService.server.js   # WhatsApp reminders
    callService.server.js       # General call service
  utils/
    orderCronJobs.server.js     # 30s interval cron: stale calls, retries, WA timeouts
    whatsappFallback.server.js  # Twilio WhatsApp sender
  styles/
    tailwind.css    # Tailwind entry point
prisma/
  schema.prisma     # DB schema
```

---

## Database Models (Prisma)

- **Session** — Shopify OAuth sessions (managed by Shopify SDK)
- **AppConfig** — Single-row config (`id: "default"`, `shop: "default"`). Stores Vapi keys, Twilio keys, feature flags, retry intervals, call language, WhatsApp enable/disable, timeout.
- **Script** — AI call scripts with `{{CUSTOMER_NAME}}`, `{{ORDER_ID}}`, `{{TOTAL}}`, `{{ADDRESS}}`, `{{PRODUCT_LIST}}`, `{{DELIVERY_DATE}}`, `{{STORE_NAME}}` template variables. One `isActive` per shop.
- **Order** — Shopify order mirror: `shopifyOrderId`, `phoneNumber`, `orderStatus` (PENDING/CONFIRMED/CANCELLED/PENDING_MANUAL_REVIEW/INVALID), `confirmationStatus`, `communicationLog` (JSON).
- **CallLog** — Per-order call attempts: `status` (QUEUED/IN_PROGRESS/COMPLETED/RETRY_SCHEDULED/FAILED/WHATSAPP_SENT), `vapiCallId`, `retryCount`, `lockedAt` (optimistic lock), WhatsApp fields.
- **CustomerCall** — General (non-order) calls.

---

## Coding Conventions

### File naming
- React components: `.jsx`
- Server-only modules: `.server.js` (never imported client-side)
- No `.ts`/`.tsx` files currently — the project uses JSX + JSDoc

### Imports
- Use named exports from services: `import { handleCallResult } from "../services/orderCallService.server.js"`
- Always include the `.js` extension in imports (ESM requirement)
- Prisma client is a singleton at `app/db.server.js`

### Server vs client
- Anything with DB/Prisma/secrets must be in `.server.js` files or route `loader`/`action` functions
- Components in `app/components/` are pure UI — no server imports
- `authenticate.admin(request)` must be the first call in every admin route loader/action

### State management
- No Redux/Zustand — use React Router's `useLoaderData`, `useFetcher`, `useRevalidator`
- Dark/light theme via `useTheme()` from `ThemeContext`
- Dashboard auto-revalidates every 10 seconds via `setInterval(revalidate, 10000)`

### Config resolution pattern (IMPORTANT)
All services read config from `AppConfig` DB first, fall back to env vars:
```js
const apiKey = dbConfig?.vapiApiKey || process.env.VAPI_API_KEY;
```
Always follow this pattern when adding new configurable values.

### Phone numbers
- Normalize to E.164 format: 10-digit Indian numbers → `+91XXXXXXXXXX`
- Phone normalization logic lives in `webhooks.orders.create.jsx:normalizePhone()`
- `DEFAULT_AGENT_PHONE` env var overrides customer phone (for testing)

### Cron jobs
- The 30s interval cron runs in `orderCronJobs.server.js`
- Uses `global.__aiAgentOrderCronIntervalId` guard to prevent duplicate intervals on hot-reload
- Processes: stale IN_PROGRESS calls, QUEUED calls, due retries, WhatsApp timeouts

### Single-tenant design
- App currently uses `shop: "default"` throughout as a single-tenant placeholder
- `AppConfig` and `Script` queries use `{ where: { shop: "default" } }`
- Multi-tenant support would require passing actual shop domain

---

## Call Flow

1. **New COD order** → `webhooks.orders.create.jsx`
2. Creates `Order` + `CallLog` in DB
3. If `whatsappEnabled` (AppConfig): send WhatsApp via Twilio → mark `WHATSAPP_SENT`
4. If customer replies (via `api.whatsapp-webhook.jsx`): auto-confirm/cancel
5. If no reply within `waTimeoutMinutes` (default 5): cron triggers Vapi AI call
6. Vapi calls back via `api.order-vapi-webhook.jsx` or `api.vapi-webhook.jsx`
7. `handleCallResult()` in `orderCallService.server.js` processes the intent (CONFIRM/CANCEL/RECALL_REQUEST/BUSY/NO_RESPONSE/WRONG_NUMBER)
8. Retries up to `maxRetries` (AppConfig, default 3) with `retryInterval` (default 2 hours); `ORDER_MAX_RETRIES` constant is 100 (soft cap in UI)

---

## Required Environment Variables

```
DATABASE_URL                # PostgreSQL connection string
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
SCOPES                      # Comma-separated Shopify scopes

# Vapi (can also be set in AppConfig DB)
VAPI_API_KEY
VAPI_PHONE_NUMBER_ID
VAPI_ASSISTANT_ID
VAPI_ORDER_ASSISTANT_ID     # Optional: separate assistant for order calls

# Twilio (can also be set in AppConfig DB)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM        # e.g. +14155238886 (Twilio WA sandbox number)

# Optional
DEFAULT_AGENT_PHONE         # Override customer phone for testing (E.164)
CALL_LANGUAGE               # default: "hindi"
SHOP_CUSTOM_DOMAIN
```

---

## Commands

```bash
npm run dev          # Start dev server via Shopify CLI
npm run dev:local    # Dev with localhost (no tunnel)
npm run build        # Production build
npm run setup        # prisma generate + prisma migrate deploy (Docker/prod)
npm run deploy       # Shopify app deploy
npx prisma migrate dev --name <name>   # Create new migration
npx prisma studio    # Browse DB
```

---

## Rules for Claude

1. **Never import Prisma or server modules in component files** — keep `app/components/` client-safe.
2. **Always call `authenticate.admin(request)` first** in route loaders/actions under `app/`.
3. **Follow the DB-first config pattern** — read from `AppConfig` with env var fallback.
4. **Use `.js` extension** in all ESM import paths.
5. **Don't change the `shop: "default"` pattern** without discussing multi-tenancy implications.
6. **Cron safety**: always clear previous interval with the global guard before starting a new one.
7. **Serialization**: always `.toISOString()` dates before returning from loaders (Prisma `DateTime` fields are not JSON-serializable).
8. **COD only**: the app only processes orders where `gateway === "cash_on_delivery"` or `"cod"`.
9. **Call intents** are defined in `app/constants.js` — use `CALL_INTENT.*` constants, never raw strings.
10. **Optimistic locking** via `lockedAt` in `CallLog` — don't bypass this when processing call logs in batch.
