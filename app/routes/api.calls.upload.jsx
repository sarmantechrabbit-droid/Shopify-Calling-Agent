// app/routes/api.calls.upload.jsx

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { createCallsBatch } = await import("../services/callService.server.js");
  const { validatePhone, checkAllowedPrefix } = await import(
    "../utils/validation.server.js"
  );

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body. Send { customers: [...] }" },
      { status: 400 },
    );
  }

  const customers = body?.customers;

  if (!Array.isArray(customers) || customers.length === 0) {
    return Response.json(
      { error: "Body must contain a non-empty 'customers' array." },
      { status: 400 },
    );
  }

  if (customers.length > 500) {
    return Response.json(
      {
        error:
          "Maximum 500 customers per upload batch. Split your list and call again.",
      },
      { status: 400 },
    );
  }

  const valid = [];
  const errors = [];

  for (let i = 0; i < customers.length; i++) {
    const row = customers[i] ?? {};
    const rawName = row.customerName ?? row.name ?? "";
    const rawPhone = row.phone ?? row.phoneNumber ?? "";

    const customerName = String(rawName).trim();
    if (!customerName) {
      errors.push({ index: i, error: "Missing customerName" });
      continue;
    }

    const phoneResult = validatePhone(rawPhone);
    if (phoneResult.error) {
      errors.push({
        index: i,
        customerName,
        raw: rawPhone,
        error: phoneResult.error,
      });
      continue;
    }

    const prefixError = checkAllowedPrefix(phoneResult.phone);
    if (prefixError) {
      errors.push({
        index: i,
        customerName,
        phone: phoneResult.phone,
        error: prefixError.error,
      });
      continue;
    }

    valid.push({ customerName, phone: phoneResult.phone });
  }

  if (valid.length === 0) {
    return Response.json(
      {
        error: "No valid customers found. See 'details' for per-row errors.",
        details: errors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await createCallsBatch(valid);
    return Response.json({
      success: true,
      created: result.count,
      skipped: errors.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("[Upload] DB batch insert failed:", err);
    return Response.json(
      { error: "Database error during batch insert. Try again." },
      { status: 500 },
    );
  }
};

