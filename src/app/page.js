import { headers } from "next/headers";
import { getPublicApiKey } from "@/lib/localDb";
import CopyableField from "./_copyableField";
import CodeBlock from "./_codeBlock";

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
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="size-16 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-white/25">key_off</span>
          </div>
          <h1 className="text-lg font-semibold text-white/80">No API key shared</h1>
          <p className="text-sm text-white/40 mt-1">Set a key as shared in the dashboard.</p>
        </div>
      </div>
    );
  }

  const models = Array.isArray(key.modelWhitelist) ? key.modelWhitelist : [];
  const quotaUsed = key.tokenQuota && key.tokenQuota > 0 ? key.tokenUsed || 0 : 0;
  const quotaPct = key.tokenQuota && key.tokenQuota > 0
    ? Math.min(100, Math.round((quotaUsed / key.tokenQuota) * 100))
    : null;
  const quotaColor = quotaPct == null ? null
    : quotaPct >= 90 ? "from-red-500 to-rose-400"
    : quotaPct >= 70 ? "from-amber-500 to-yellow-400"
    : "from-emerald-500 to-teal-400";
  const quotaTextColor = quotaPct == null ? null
    : quotaPct >= 90 ? "text-rose-400"
    : quotaPct >= 70 ? "text-amber-400"
    : "text-emerald-400";
  const isExhausted = quotaPct != null && quotaPct >= 100;
  const isExpired = key.expiresAt && new Date(key.expiresAt) <= new Date();
  const isLive = !isExhausted && !isExpired;

  const sampleModel = models[0] || "gpt-4o";
  const curlSnippet = `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${key.key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${sampleModel}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-violet-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 size-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />

      <div className="relative flex items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-7">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/25">
              <span className="material-symbols-outlined text-[28px] text-white">bolt</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold truncate">{key.name || "API Access"}</h1>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                  isLive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}>
                  <span className={`size-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-rose-400"}`} />
                  {isExpired ? "Expired" : isExhausted ? "Quota used" : "Active"}
                </span>
              </div>
              <p className="text-sm text-white/40 mt-0.5">OpenAI-compatible endpoint</p>
            </div>
          </div>

          {/* Glass card */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl p-6 sm:p-7 flex flex-col gap-6 shadow-2xl shadow-black/40">
            {/* Connection */}
            <div className="flex flex-col gap-4">
              <CopyableField label="Base URL" value={baseUrl} />
              <CopyableField label="API Key" value={key.key} />
            </div>

            {/* Models */}
            {models.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/40 uppercase tracking-wide">
                  Allowed models
                </label>
                <div className="flex flex-wrap gap-2">
                  {models.map((m) => (
                    <span key={m} className="inline-flex items-center rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-xs font-mono text-white/60">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quota */}
            {quotaPct != null && (
              <div className="flex flex-col gap-3 pt-5 border-t border-white/[0.06]">
                <div className="flex items-end justify-between">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wide">Token quota</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold tabular-nums ${quotaTextColor}`}>{quotaPct}%</span>
                    <span className="text-xs text-white/30 font-mono">
                      {quotaUsed.toLocaleString()} / {key.tokenQuota.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${quotaColor} transition-all duration-700 ease-out`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">
                    {Math.max(0, key.tokenQuota - quotaUsed).toLocaleString()} tokens remaining
                  </span>
                  <span className="text-xs text-white/30">Monthly reset</span>
                </div>
              </div>
            )}

            {/* Quick start */}
            <div className="pt-5 border-t border-white/[0.06]">
              <CodeBlock label="Quick start" code={curlSnippet} />
            </div>

            {/* Rate limit + expiry */}
            {(key.rateLimitRpm || key.expiresAt) && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-5 border-t border-white/[0.06]">
                {key.rateLimitRpm && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-white/25">speed</span>
                    <span className="text-sm text-white/50">{key.rateLimitRpm} req/min</span>
                  </div>
                )}
                {key.expiresAt && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-white/25">schedule</span>
                    <span className="text-sm text-white/50">
                      Expires {new Date(key.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-white/20 mt-6">
            Anyone with this link can use the key above.
          </p>
        </div>
      </div>
    </div>
  );
}
