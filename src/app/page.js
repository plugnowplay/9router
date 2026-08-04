import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPublicApiKey } from "@/lib/localDb";
import { Card, Badge } from "@/shared/components";
import CopyableField from "./_copyableField";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "API Access",
};

export default async function RootPage() {
  let key;
  try {
    key = await getPublicApiKey();
  } catch {
    key = null;
  }
  if (!key) redirect("/dashboard");

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = host ? `${proto}://${host}/v1` : `${process.env.NEXT_PUBLIC_BASE_URL || ""}/v1`;

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

        <div className="rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-500/10 p-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            This page shows a live API key. Anyone with this link can use it.
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
