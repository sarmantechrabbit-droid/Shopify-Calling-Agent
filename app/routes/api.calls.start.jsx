// app/routes/api.calls.start.jsx

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const {
    getAllPendingCalls,
    setCallCalling,
    setCallRetrying,
    markCallFailed,
    updateCallWithVapiId,
    MAX_RETRIES,
  } = await import("../services/callService.server.js");

  const { initiateVapiCall, isPermanentVapiError } = await import(
    "../services/vapiService.server.js"
  );

  let pending;
  try {
    pending = await getAllPendingCalls();
  } catch (err) {
    console.error("[Start] DB fetch error:", err.message);
    return Response.json(
      { error: "Database error while fetching pending calls." },
      { status: 500 },
    );
  }

  if (pending.length === 0) {
    return Response.json({
      success: true,
      message: "No pending calls to start.",
      started: 0,
      failed: 0,
    });
  }

  console.log(`[Start] Firing ${pending.length} pending call(s) …`);

  const results = { started: 0, failed: 0, errors: [] };

  for (const call of pending) {
    try {
      await setCallCalling(call.id);

      const vapiRes = await initiateVapiCall({
        customerName: call.customerName,
        phone: call.phone,
        callId: call.id,
      });

      if (!vapiRes?.id) {
        throw new Error("Vapi returned no call ID.");
      }

      await updateCallWithVapiId(call.id, vapiRes.id);

      results.started++;
      console.log(
        `[Start] ✓ "${call.customerName}" (${call.phone}) → vapiId=${vapiRes.id}`,
      );
    } catch (err) {
      results.failed++;
      results.errors.push({
        id: call.id,
        customerName: call.customerName,
        phone: call.phone,
        error: err.message,
      });
      console.error(
        `[Start] ✗ "${call.customerName}" (${call.phone}):`,
        err.message,
      );

      try {
        if (isPermanentVapiError(err)) {
          await markCallFailed(call.id, err.message);
        } else {
          if (call.retryCount < MAX_RETRIES) {
            await setCallRetrying(call.id, err.message);
          } else {
            await markCallFailed(call.id, err.message);
          }
        }
      } catch (recoveryErr) {
        console.error(
          `[Start] Recovery update failed for ${call.id}:`,
          recoveryErr.message,
        );
      }
    }
  }

  return Response.json({
    success: true,
    started: results.started,
    failed: results.failed,
    ...(results.errors.length > 0 ? { errors: results.errors } : {}),
  });
};

