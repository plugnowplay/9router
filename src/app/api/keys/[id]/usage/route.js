import { NextResponse } from "next/server";
import { getApiKeyById } from "@/lib/localDb";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

// GET /api/keys/[id]/usage — per-key usage summary from usageHistory
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const db = await getAdapter();
    const rows = db.all(
      `SELECT promptTokens, completionTokens, cost, status, timestamp
       FROM usageHistory WHERE apiKey = ?
       ORDER BY id DESC LIMIT 10000`,
      [key.key]
    );

    const totalRequests = rows.length;
    const totalPrompt = rows.reduce((s, r) => s + (r.promptTokens || 0), 0);
    const totalCompletion = rows.reduce((s, r) => s + (r.completionTokens || 0), 0);
    const totalCost = rows.reduce((s, r) => s + (r.cost || 0), 0);
    const errorCount = rows.filter((r) => r.status && r.status !== "ok" && r.status !== "200 OK").length;

    const last30 = rows.slice(0, 30).map((r) => ({
      timestamp: r.timestamp,
      model: null,
      promptTokens: r.promptTokens || 0,
      completionTokens: r.completionTokens || 0,
      cost: r.cost || 0,
      status: r.status,
    }));

    return NextResponse.json({
      totals: {
        requests: totalRequests,
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        totalTokens: totalPrompt + totalCompletion,
        cost: totalCost,
        errors: errorCount,
      },
      keyQuota: {
        used: key.tokenUsed || 0,
        quota: key.tokenQuota || null,
        remaining: key.tokenQuota ? Math.max(0, key.tokenQuota - (key.tokenUsed || 0)) : null,
      },
      recent: last30,
    });
  } catch (error) {
    console.log("Error fetching key usage:", error);
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
