import { headers } from "next/headers";
import { getPublicApiKey } from "@/lib/localDb";
import { Card, Badge } from "@/shared/components";
import CopyableField from "./_copyableField";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "API Access",
};

export default async function RootPage() {
  let key = null;
  try {
    key = await getPublicApiKey();
  } catch {
    key = null;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = host ? `${proto}://${host}/v1` : `${process.env.NEXT_PUBLIC_BASE_URL || ""}/v1`;

  if (!key) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <span className="material-symbols-outlined text-[40px] text-text-muted">key_off</span>
          <h1 className="text-lg font-semibold mt-2">No API key</h1>
          <p className="text-sm text-text-muted mt-1">
            Create a key in the dashboard to see it here.
          </p>
        </Card>
      </div>
    );
  }

  const models = Array.isArray(key.modelWhitelist) ? key.modelWhitelist : [];

  return (
    <div className="min-h-screen flex items-start justify-center p-6">
      <Card className="max-w-2xl w-full flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold">{key.name || "Shared API access"}</h1>
          <p className="text-sm text-text-muted mt-1">
            Use this base URL and key with any OpenAI-compatible client.
          </p>
        </div>

        <CopyableField label="Base URL" value={baseUrl} copyKey="base" />
        <CopyableField label="API Key" value={key.key} copyKey="key" />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Allowed models</label>
          {models.length === 0 ? (
            <p className="text-sm text-text-muted">All models</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {models.map((m) => (
                <Badge key={m}>{m}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-text-muted">Rate limit</p>
            <p className="text-sm font-medium">
              {key.rateLimitRpm ? key.rateLimitRpm + " req/min" : "Unlimited"}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Token quota</p>
            <p className="text-sm font-medium">
              {key.tokenQuota
                ? (key.tokenUsed || 0).toLocaleString() + " / " + key.tokenQuota.toLocaleString()
                : "Unlimited"}
            </p>
          </div>
          {key.expiresAt && (
            <div>
              <p className="text-xs text-text-muted">Expires</p>
              <p className="text-sm font-medium">{new Date(key.expiresAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
