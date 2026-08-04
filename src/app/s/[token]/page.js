"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Spinner, Badge } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function SharePage({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { token } = await params;
        const res = await fetch("/api/share/" + encodeURIComponent(token), { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        setData(await res.json());
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <span className="material-symbols-outlined text-[40px] text-text-muted">link_off</span>
          <h1 className="text-lg font-semibold mt-2">Share link not found</h1>
          <p className="text-sm text-text-muted mt-1">
            This link is invalid or has been revoked.
          </p>
        </Card>
      </div>
    );
  }

  const models = Array.isArray(data.modelWhitelist) ? data.modelWhitelist : [];

  return (
    <div className="min-h-screen flex items-start justify-center p-6">
      <Card className="max-w-2xl w-full flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold">{data.name || "Shared API access"}</h1>
          <p className="text-sm text-text-muted mt-1">
            Use this base URL and key with any OpenAI-compatible client.
          </p>
        </div>

        <div className="rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-500/10 p-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            This page shows a live API key. Anyone with this link can use it.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Base URL</label>
          <div className="flex gap-2">
            <Input value={data.baseUrl} readOnly className="flex-1 font-mono text-sm" />
            <Button
              variant="secondary"
              icon={copied === "base" ? "check" : "content_copy"}
              onClick={() => copy(data.baseUrl, "base")}
            >
              {copied === "base" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="flex gap-2">
            <Input value={data.key} readOnly className="flex-1 font-mono text-sm" />
            <Button
              variant="secondary"
              icon={copied === "key" ? "check" : "content_copy"}
              onClick={() => copy(data.key, "key")}
            >
              {copied === "key" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

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
              {data.rateLimitRpm ? data.rateLimitRpm + " req/min" : "Unlimited"}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Token quota</p>
            <p className="text-sm font-medium">
              {data.tokenQuota
                ? (data.tokenUsed || 0).toLocaleString() + " / " + data.tokenQuota.toLocaleString()
                : "Unlimited"}
            </p>
          </div>
          {data.expiresAt && (
            <div>
              <p className="text-xs text-text-muted">Expires</p>
              <p className="text-sm font-medium">{new Date(data.expiresAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
