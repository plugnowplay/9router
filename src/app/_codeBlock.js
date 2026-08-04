"use client";

import { useState } from "react";

export default function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wide">{label}</label>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <span className={`material-symbols-outlined text-[14px] ${copied ? "text-emerald-400" : ""}`}>
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="rounded-xl bg-black/40 border border-white/[0.06] p-4 overflow-x-auto">
        <code className="font-mono text-xs text-white/70 leading-relaxed whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}
