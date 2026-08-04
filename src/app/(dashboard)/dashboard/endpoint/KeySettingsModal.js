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

  useEffect(() => {
    if (!isOpen || !apiKey) return;
    setRateLimitRpm(apiKey.rateLimitRpm == null ? "" : String(apiKey.rateLimitRpm));
    setTokenQuota(apiKey.tokenQuota == null ? "" : String(apiKey.tokenQuota));
    setExpiresAt(toLocalInput(apiKey.expiresAt));
    setModelsText(Array.isArray(apiKey.modelWhitelist) ? apiKey.modelWhitelist.join("\n") : "");
    setError("");
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
            <span className="text-text-muted font-normal"> - one per line, empty means all models</span>
          </label>
          <textarea
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            placeholder={"glm/glm-5.2\ncc/claude-opus-4-7\nkr/claude-sonnet-4.5"}
            className="w-full min-h-32 rounded border border-border bg-surface p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
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
