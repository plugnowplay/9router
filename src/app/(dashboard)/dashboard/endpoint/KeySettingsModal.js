"use client";

import { useEffect, useState } from "react";
import { Button, Input, Modal } from "@/shared/components";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

export default function KeySettingsModal({ isOpen, apiKey, onClose, onSaved }) {
  const [rateLimitRpm, setRateLimitRpm] = useState("");
  const [tokenQuota, setTokenQuota] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [modelsText, setModelsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!isOpen || !apiKey) return;
    setRateLimitRpm(apiKey.rateLimitRpm == null ? "" : String(apiKey.rateLimitRpm));
    setTokenQuota(apiKey.tokenQuota == null ? "" : String(apiKey.tokenQuota));
    setExpiresAt(toLocalInput(apiKey.expiresAt));
    setModelsText(Array.isArray(apiKey.modelWhitelist) ? apiKey.modelWhitelist.join("\n") : "");
    setIsShared(apiKey.isPublic === true);
    setError("");
    setUsage(null);
    fetch("/api/keys/" + apiKey.id + "/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setUsage(d); })
      .catch(() => {});
  }, [isOpen, apiKey]);

  if (!apiKey) return null;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const list = modelsText
        .split("\n")
        .map((m) => m.trim())
        .filter(Boolean);
      const res = await fetch("/api/keys/" + apiKey.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateLimitRpm: rateLimitRpm === "" ? null : Number(rateLimitRpm),
          tokenQuota: tokenQuota === "" ? null : Number(tokenQuota),
          modelWhitelist: list.length ? list : null,
          expiresAt: expiresAt === "" ? null : new Date(expiresAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShared = async () => {
    setError("");
    setToggling(true);
    try {
      const method = isShared ? "DELETE" : "POST";
      const res = await fetch("/api/keys/" + apiKey.id + "/share", { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to toggle share");
        return;
      }
      setIsShared(!isShared);
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setToggling(false);
    }
  };

  const quotaNum = tokenQuota === "" ? null : Number(tokenQuota);
  const quotaUsed = usage?.keyQuota?.used ?? apiKey.tokenUsed ?? 0;
  const quotaPct = quotaNum && quotaNum > 0
    ? Math.min(100, Math.round((quotaUsed / quotaNum) * 100))
    : null;
  const quotaBar = quotaPct == null ? null
    : quotaPct >= 90 ? "bg-red-500"
    : quotaPct >= 70 ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <Modal isOpen={isOpen} title={"Settings - " + (apiKey.name || "API key")} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {usage?.totals && (
          <div className="rounded-lg border border-border bg-surface-2/40 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-text-muted">insights</span>
              <span className="text-sm font-semibold">Usage</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-lg font-semibold tabular-nums">{usage.totals.requests.toLocaleString()}</p>
                <p className="text-xs text-text-muted">Requests</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">{(usage.totals.totalTokens || 0).toLocaleString()}</p>
                <p className="text-xs text-text-muted">Tokens</p>
              </div>
              <div>
                <p className={`text-lg font-semibold tabular-nums ${usage.totals.errors > 0 ? "text-red-500" : ""}`}>
                  {usage.totals.errors.toLocaleString()}
                </p>
                <p className="text-xs text-text-muted">Errors</p>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-text-muted">
              <span>In {(usage.totals.promptTokens || 0).toLocaleString()}</span>
              <span>Out {(usage.totals.completionTokens || 0).toLocaleString()}</span>
              {usage.totals.cost > 0 && <span>${usage.totals.cost.toFixed(4)}</span>}
            </div>
            {quotaPct != null && (
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Quota</span>
                  <span className="font-mono">
                    {quotaUsed.toLocaleString()} / {quotaNum.toLocaleString()} ({quotaPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface overflow-hidden">
                  <div className={`h-full rounded-full ${quotaBar} transition-all`} style={{ width: `${quotaPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-text-muted">tune</span>
            <span className="text-sm font-semibold">Limits</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Rate limit (req/min)"
              type="number"
              min="0"
              value={rateLimitRpm}
              onChange={(e) => setRateLimitRpm(e.target.value)}
              placeholder="Unlimited"
            />
            <Input
              label="Token quota (per month)"
              type="number"
              min="0"
              value={tokenQuota}
              onChange={(e) => setTokenQuota(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <Input
            label="Expires at"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-text-muted">list</span>
            <span className="text-sm font-semibold">Allowed models</span>
          </div>
          <p className="text-xs text-text-muted -mt-1">
            One per line. Provider models or combo names. Empty = all models.
          </p>
          <textarea
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            placeholder={"glm/glm-5.2\ncc/claude-opus-4-7\nmy-combo"}
            className="w-full min-h-28 rounded-lg border border-border bg-surface p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-col gap-2 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-text-muted">share</span>
            <span className="text-sm font-semibold">Public share</span>
            {isShared && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
          </div>
          {isShared ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 text-xs font-mono">
                {typeof window !== "undefined" ? window.location.origin : "your-domain"}
              </code>
              <Button
                variant="secondary"
                icon={copiedShare ? "check" : "content_copy"}
                onClick={() => {
                  const url = window.location.origin;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopiedShare(true);
                    setTimeout(() => setCopiedShare(false), 2000);
                  });
                }}
              />
              <Button variant="danger" disabled={toggling} onClick={handleToggleShared}>
                {toggling ? "..." : "Stop"}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" disabled={toggling} onClick={handleToggleShared}>
              {toggling ? "..." : "Set as shared"}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} fullWidth disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
