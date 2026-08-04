import { NextResponse } from "next/server";
import { getApiKeyByShareToken } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// GET /api/share/[token] - PUBLIC. Reachable because dashboardGuard lists
// "/api/share" in PUBLIC_API_PATHS; the /api/* branch is deny-by-default.
export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const key = await getApiKeyByShareToken(token);

    // Same 404 for unknown and revoked: do not leak which one it was.
    if (!key) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    return NextResponse.json({
      baseUrl: request.nextUrl.origin + "/v1",
      name: key.name,
      key: key.key,
      modelWhitelist: key.modelWhitelist,
      rateLimitRpm: key.rateLimitRpm,
      tokenQuota: key.tokenQuota,
      tokenUsed: key.tokenUsed,
      expiresAt: key.expiresAt,
    });
  } catch (error) {
    console.log("Error fetching share link:", error);
    return NextResponse.json({ error: "Failed to fetch share link" }, { status: 500 });
  }
}
