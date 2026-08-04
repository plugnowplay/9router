"use client";

import { useState } from "react";

export default function CopyableField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/40 uppercase tracking-wide">{label}</label>
      <button
        onClick={handleCopy}
        className="group flex items-center gap-3 w-full text-left rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-150 px-4 py-3"
      >
        <span className="flex-1 min-w-0 truncate font-mono text-sm text-white/80">
          {value}
        </span>
        <span className={`material-symbols-outlined text-[18px] shrink-0 transition-colors ${copied ? "text-emerald-400" : "text-white/30 group-hover:text-white/60"}`}>
          {copied ? "check" : "content_copy"}
        </span>
      </button>
    </div>
  );
}
