import { NextResponse } from "next/server";
import { getPublicApiKey } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// GET /api/public-key - PUBLIC. Reachable because dashboardGuard lists
// "/api/public-key" in PUBLIC_API_PATHS; the /api/* branch is deny-by-default.
// Returns the single key marked isPublic=1, or 404 when none is public.
export async function GET(request) {
  try {
    const key = await getPublicApiKey();
    if (!key) {
      return NextResponse.json({ error: "No public key" }, { status: 404 });
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
    console.log("Error fetching public key:", error);
    return NextResponse.json({ error: "Failed to fetch public key" }, { status: 500 });
  }
}
