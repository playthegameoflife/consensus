"use client";

import { Lock, LockOpen } from "lucide-react";

interface DevGateToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/**
 * Visible dev-only toggle for the Pro-gate preview.
 * Sits in the top-right corner next to Sign up. Shows a lock icon +
 * "Pro gate" state so Paul can flip between open and gated modes without
 * touching the URL.
 */
export function DevGateToggle({ enabled, onChange }: DevGateToggleProps) {
  return (
    <button
      type="button"
      data-testid="dev-gate-toggle"
      onClick={() => onChange(!enabled)}
      title={
        enabled
          ? "Dev: Pro gate ON (Deep/Pro/Agent locked)"
          : "Dev: Pro gate OFF (everything open)"
      }
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
        enabled
          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
      }`}
    >
      {enabled ? (
        <>
          <Lock className="w-3 h-3" />
          <span>Pro gate ON</span>
        </>
      ) : (
        <>
          <LockOpen className="w-3 h-3" />
          <span>Pro gate OFF</span>
        </>
      )}
    </button>
  );
}
