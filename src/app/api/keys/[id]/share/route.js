import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getApiKeyById, setPublicApiKey, unsetPublicApiKey } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// POST /api/keys/[id]/share - mark this key as the single public key.
// The share URL is the bare origin (root /) — the landing page there fetches
// /api/public-key to surface whichever key currently holds isPublic=1.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await setPublicApiKey(id);

    return NextResponse.json({
      shareUrl: request.nextUrl.origin,
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating share token:", error);
    return NextResponse.json({ error: "Failed to create share token" }, { status: 500 });
  }
}

// DELETE /api/keys/[id]/share - revoke public status + share token
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await unsetPublicApiKey(id);
    return NextResponse.json({ message: "Share link revoked" });
  } catch (error) {
    console.log("Error revoking share token:", error);
    return NextResponse.json({ error: "Failed to revoke share token" }, { status: 500 });
  }
}
