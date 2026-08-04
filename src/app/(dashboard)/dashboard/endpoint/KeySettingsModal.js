"use client";

import { useEffect, useState } from "react";
import { Button, Input, Modal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

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
  const [selected, setSelected] = useState([]);
  const [models, setModels] = useState([]);
  const [shareUrl, setShareUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (!isOpen || !apiKey) return;
    setRateLimitRpm(apiKey.rateLimitRpm == null ? "" : String(apiKey.rateLimitRpm));
    setTokenQuota(apiKey.tokenQuota == null ? "" : String(apiKey.tokenQuota));
    setExpiresAt(toLocalInput(apiKey.expiresAt));
    setSelected(Array.isArray(apiKey.modelWhitelist) ? apiKey.modelWhitelist : []);
    setShareUrl("");
    setError("");
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) => setModels(Array.isArray(d.models) ? d.models : []))
      .catch(() => setModels([]));
  }, [isOpen, apiKey]);

  if (!apiKey) return null;

  const toggleModel = (routedModel) => {
    setSelected((prev) =>
      prev.includes(routedModel) ? prev.filter((m) => m !== routedModel) : [...prev, routedModel]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/keys/" + apiKey.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateLimitRpm: rateLimitRpm === "" ? null : Number(rateLimitRpm),
          tokenQuota: tokenQuota === "" ? null : Number(tokenQuota),
          modelWhitelist: selected.length ? selected : null,
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

  const handleGenerateShare = async () => {
    setError("");
    try {
      const res = await fetch("/api/keys/" + apiKey.id + "/share", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create share link");
        return;
      }
      setShareUrl(data.shareUrl);
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRevokeShare = async () => {
    setError("");
    try {
      const res = await fetch("/api/keys/" + apiKey.id + "/share", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to revoke");
        return;
      }
      setShareUrl("");
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message);
    }
  };

  const grouped = models.reduce((acc, m) => {
    const provider = m.provider || "other";
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(m);
    return acc;
  }, {});

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
            <span className="text-text-muted font-normal"> - none selected means all models</span>
          </label>
          <div className="max-h-52 overflow-y-auto rounded border border-border p-2 flex flex-col gap-2">
            {Object.keys(grouped).length === 0 && (
              <p className="text-xs text-text-muted">No models available.</p>
            )}
            {Object.entries(grouped).map(([provider, list]) => (
              <div key={provider}>
                <p className="text-xs font-semibold text-text-muted uppercase">{provider}</p>
                {list.map((m) => (
                  <label key={m.routedModel} className="flex items-center gap-2 text-sm py-0.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(m.routedModel)}
                      onChange={() => toggleModel(m.routedModel)}
                    />
                    <span className="font-mono text-xs">{m.routedModel}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-border">
          <label className="text-sm font-medium">Public share link</label>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Anyone with this link sees the full API key.
          </p>
          {shareUrl ? (
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="flex-1 font-mono text-xs" />
              <Button
                variant="secondary"
                icon={copied === "share" ? "check" : "content_copy"}
                onClick={() => copy(shareUrl, "share")}
              />
              <Button variant="danger" onClick={handleRevokeShare}>Revoke</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleGenerateShare}>Generate share link</Button>
              {apiKey.shareToken && (
                <Button variant="danger" onClick={handleRevokeShare}>Revoke existing</Button>
              )}
            </div>
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
