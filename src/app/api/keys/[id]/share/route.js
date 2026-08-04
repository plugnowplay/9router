import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getApiKeyById, updateApiKey } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// POST /api/keys/[id]/share - issue a public share token
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const shareToken = existing.shareToken || uuidv4();
    if (!existing.shareToken) {
      await updateApiKey(id, { shareToken });
    }

    return NextResponse.json({
      shareToken,
      shareUrl: request.nextUrl.origin + "/s/" + shareToken,
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating share token:", error);
    return NextResponse.json({ error: "Failed to create share token" }, { status: 500 });
  }
}

// DELETE /api/keys/[id]/share - revoke the share token
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await updateApiKey(id, { shareToken: null });
    return NextResponse.json({ message: "Share link revoked" });
  } catch (error) {
    console.log("Error revoking share token:", error);
    return NextResponse.json({ error: "Failed to revoke share token" }, { status: 500 });
  }
}
