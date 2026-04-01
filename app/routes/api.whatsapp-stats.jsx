/**
 * WhatsApp Stats API
 * 
 * GET /api/whatsapp-stats → returns real WhatsApp message statistics from DB
 */

import prisma from "../db.server.js";

export async function loader() {
  try {
    // Count WhatsApp messages sent (callLogs where whatsappSentAt is set)
    const sent = await prisma.callLog.count({
      where: {
        whatsappSentAt: { not: null },
      },
    });

    // Count replies received
    const replied = await prisma.callLog.count({
      where: {
        whatsappReplied: true,
      },
    });

    // Count pending (sent but no reply, not failed)
    const pending = await prisma.callLog.count({
      where: {
        whatsappSentAt: { not: null },
        whatsappReplied: false,
        status: "WHATSAPP_SENT",
      },
    });

    // Count failed/timed out (sent, no reply, status is FAILED)
    const failed = await prisma.callLog.count({
      where: {
        whatsappSentAt: { not: null },
        whatsappReplied: false,
        status: "FAILED",
      },
    });

    return Response.json({
      stats: { sent, replied, pending, failed },
    });
  } catch (err) {
    console.error("[WhatsApp-Stats] Error:", err.message);
    return Response.json({
      stats: { sent: 0, replied: 0, pending: 0, failed: 0 },
    });
  }
}
