"use client";

import { useState } from "react";
import { Button, Input } from "@/shared/components";

export default function CopyableField({ label, value, copyKey }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="flex-1 font-mono text-sm" />
        <Button
          variant="secondary"
          icon={copied ? "check" : "content_copy"}
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
