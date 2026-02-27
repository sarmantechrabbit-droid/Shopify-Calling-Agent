// app/routes/webhooks.orders.create.jsx
import { authenticate } from "../shopify.server";
import {
  CALL_INTENT,
  createOrderWithCallLog,
  getOrderByShopifyId,
  handleCallResult,
  setCallLogInProgress,
  updateCallLogVapiId,
} from "../services/orderCallService.server.js";
import {
  triggerOrderConfirmationCall,
  isPermanentOrderVapiError,
} from "../services/vapiOrderService.server.js";

function isCOD(payload) {
  const gateway = String(payload?.gateway ?? "").toLowerCase();
  const names = (payload?.payment_gateway_names ?? []).map((n) =>
    String(n).toLowerCase(),
  );
  return (
    gateway === "cash_on_delivery" ||
    gateway === "cod" ||
    names.includes("cash_on_delivery") ||
    names.includes("cod")
  );
}

function normalizePhone(raw) {
  if (!raw) return null;
  const phone = String(raw).replace(/[\s\-().]/g, "");
  if (phone.startsWith("+"))
    return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
  if (/^\d{10}$/.test(phone)) return `+91${phone}`;
  if (/^91\d{10}$/.test(phone)) return `+${phone}`;
  return null;
}

function extractPhone(payload) {
  const candidates = [
    payload?.billing_address?.phone,
    payload?.shipping_address?.phone,
    payload?.customer?.phone,
  ];
  for (const raw of candidates) {
    const phone = normalizePhone(raw);
    if (phone) return phone;
  }
  return null;
}

function getDefaultAgentPhone() {
  const raw = String(process.env.DEFAULT_AGENT_PHONE ?? "").trim();
  if (!raw) return null;
  return /^\+[1-9]\d{6,14}$/.test(raw) ? raw : null;
}

function buildOrderInput(shop, payload) {
  const shopifyOrderId = String(payload.id);
  const orderId = payload.order_number ?? payload.name ?? shopifyOrderId;
  const customerName =
    payload?.customer?.first_name && payload?.customer?.last_name
      ? `${payload.customer.first_name} ${payload.customer.last_name}`.trim()
      : payload?.billing_address?.name ??
        payload?.shipping_address?.name ??
        "Customer";

  return {
    shopifyOrderId,
    orderId: String(orderId),
    customerName,
    phoneNumber: getDefaultAgentPhone() || extractPhone(payload),
    storeName: String(shop).replace(".myshopify.com", ""),
    totalPrice: String(payload.total_price ?? "0"),
    orderPlacedDate: new Date(payload.created_at ?? Date.now()),
  };
}

export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") return new Response(null, { status: 200 });
  if (!isCOD(payload)) return new Response(null, { status: 200 });

  const input = buildOrderInput(shop, payload);
  if (!input.phoneNumber) {
    console.warn(
      `[OrderCreate] Missing valid phone for shopifyOrderId=${input.shopifyOrderId}`,
    );
    return new Response(null, { status: 200 });
  }

  const existing = await getOrderByShopifyId(input.shopifyOrderId);
  if (existing) return new Response(null, { status: 200 });

  let order;
  let callLog;
  try {
    ({ order, callLog } = await createOrderWithCallLog(input));
  } catch (err) {
    console.error("[OrderCreate] createOrderWithCallLog failed", err);
    return new Response(null, { status: 200 });
  }

  try {
    await setCallLogInProgress(callLog.id);

    const origin = new URL(request.url).origin;
    const vapiRes = await triggerOrderConfirmationCall({
      callLogId: callLog.id,
      customerName: input.customerName,
      phoneNumber: input.phoneNumber,
      storeName: input.storeName,
      orderId: input.orderId,
      totalPrice: input.totalPrice,
      overrideBaseUrl: origin,
    });

    if (vapiRes?.id) {
      await updateCallLogVapiId(callLog.id, vapiRes.id);
    }

    console.log(
      `[OrderCreate] Dial started orderId=${order.id} callLogId=${
        callLog.id
      } vapiCallId=${vapiRes?.id ?? "n/a"}`,
    );
  } catch (err) {
    console.error(
      `[OrderCreate] triggerOrderConfirmationCall failed orderId=${order.id}`,
      err,
    );

    if (isPermanentOrderVapiError(err)) {
      const reason = String(err?.message ?? "").toLowerCase();
      const intent =
        reason.includes("wrong number") || reason.includes("invalid")
          ? CALL_INTENT.WRONG_NUMBER
          : CALL_INTENT.RECALL_REQUEST;
      await handleCallResult(order.id, intent, {
        callLogId: callLog.id,
        failureReason: err.message,
      }).catch((e) =>
        console.error("[OrderCreate] handleCallResult permanent failed", e),
      );
    } else {
      await handleCallResult(order.id, CALL_INTENT.RECALL_REQUEST, {
        callLogId: callLog.id,
        failureReason: err.message,
      }).catch((e) =>
        console.error("[OrderCreate] handleCallResult transient failed", e),
      );
    }
  }

  return new Response(null, { status: 200 });
};


