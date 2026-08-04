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

  return (
    <Modal isOpen={isOpen} title={"Settings - " + (apiKey.name || "API key")} onClose={onClose}>
      <div className="flex flex-col gap-4">
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

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Allowed models
            <span className="text-text-muted font-normal"> - one per line. Supports combos too. Empty = all models</span>
          </label>
          <textarea
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            placeholder={"glm/glm-5.2\ncc/claude-opus-4-7\nmy-combo"}
            className="w-full min-h-32 rounded border border-border bg-surface p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {usage && usage.totals && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <div>
              <p className="text-xs text-text-muted">Requests</p>
              <p className="text-sm font-medium">{usage.totals.requests.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Tokens used</p>
              <p className="text-sm font-medium">{(usage.totals.totalTokens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Prompt tokens</p>
              <p className="text-sm font-medium">{(usage.totals.promptTokens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Completion tokens</p>
              <p className="text-sm font-medium">{(usage.totals.completionTokens || 0).toLocaleString()}</p>
            </div>
            {usage.totals.cost > 0 && (
              <div>
                <p className="text-xs text-text-muted">Cost</p>
                <p className="text-sm font-medium">${usage.totals.cost.toFixed(4)}</p>
              </div>
            )}
            {usage.totals.errors > 0 && (
              <div>
                <p className="text-xs text-text-muted">Errors</p>
                <p className="text-sm font-medium text-red-500">{usage.totals.errors}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-3 border-t border-border">
          <label className="text-sm font-medium">Shared at root URL</label>
          {isShared ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 dark:text-green-400 flex-1">
                {typeof window !== "undefined" ? window.location.origin : "your-domain"}
              </span>
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
                {toggling ? "..." : "Stop sharing"}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" disabled={toggling} onClick={handleToggleShared}>
              {toggling ? "..." : "Set as shared"}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={handleSave} fullWidth disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
