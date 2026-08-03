"use client";

import { useState, useEffect } from "react";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

function CopyRow({ label, value, copyId, copied, onCopy, masked }) {
  const [show, setShow] = useState(false);
  const display = masked && !show ? "•".repeat(Math.min(value?.length ?? 0, 32)) : (value ?? "—");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-muted font-medium uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
        <code className="flex-1 text-sm font-mono text-text-main break-all select-all">{display}</code>
        {masked && (
          <button onClick={() => setShow((s) => !s)} className="text-text-muted hover:text-text-main transition-colors cursor-pointer shrink-0">
            <span className="material-symbols-outlined text-[18px]">{show ? "visibility_off" : "visibility"}</span>
          </button>
        )}
        <button onClick={() => onCopy(value, copyId)} className="text-text-muted hover:text-text-main transition-colors cursor-pointer shrink-0">
          <span className="material-symbols-outlined text-[18px]">{copied === copyId ? "check" : "content_copy"}</span>
        </button>
      </div>
    </div>
  );
}

export default function SharePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    fetch("/api/share")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredModels = (data?.models ?? []).filter((m) =>
    m.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-main">Share Endpoint</h1>
        <p className="text-sm text-text-muted mt-1">Base URL, API key, and available models for this 9Router instance.</p>
      </div>

      <div className="flex flex-col gap-4 bg-surface-1 rounded-xl p-5 border border-border-subtle">
        <CopyRow label="Base URL" value={data?.baseUrl} copyId="base_url" copied={copied} onCopy={copy} />
        <CopyRow label="API Key" value={data?.apiKey ?? "(no active key)"} copyId="api_key" copied={copied} onCopy={copy} masked={!!data?.apiKey} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-main">
            Available Models
            <span className="ml-2 text-xs font-normal text-text-muted">({filteredModels.length})</span>
          </h2>
          <input
            type="text"
            placeholder="Filter models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-text-main placeholder:text-text-muted outline-none focus:ring-1 focus:ring-primary/50 w-48"
          />
        </div>
        <div className="flex flex-col gap-1 max-h-[480px] overflow-y-auto custom-scrollbar rounded-xl border border-border-subtle bg-surface-1 p-2">
          {filteredModels.length === 0 ? (
            <p className="text-sm text-text-muted px-3 py-4 text-center">No models found.</p>
          ) : filteredModels.map((m) => (
            <div key={m} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-surface-2 group">
              <code className="text-sm font-mono text-text-main">{m}</code>
              <button onClick={() => copy(m, m)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-main cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">{copied === m ? "check" : "content_copy"}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
