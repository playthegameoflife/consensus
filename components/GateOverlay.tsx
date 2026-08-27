"use client";

import { Lock, Sparkles } from "lucide-react";
import { GatedFeature, gateMessage } from "@/lib/gate";

interface GateOverlayProps {
  feature: GatedFeature;
  /** Optional compact mode for inline blocks (meter, follow-ups). */
  compact?: boolean;
}

/**
 * "Available with Pro & Pro Max / Upgrade" upsell block — mirrors the
 * consensus.app paywall. Only rendered when the dev gate is enabled.
 */
export function GateOverlay({ feature, compact = false }: GateOverlayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        <Lock className="w-3.5 h-3.5 text-slate-400" />
        <span>
          {feature === "pro"
            ? "Pro Analysis"
            : feature === "deep"
              ? "Deep Search"
              : feature === "agent"
                ? "Research Agent"
                : "Chat with Full Text"}{" "}
          is available with{" "}
          <span className="font-semibold text-slate-700">Pro &amp; Pro Max</span>
        </span>
        <span className="ml-auto text-xs font-medium text-cyan-600 cursor-pointer hover:underline">
          Upgrade
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 px-6 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white text-center mb-5">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-[15px] font-semibold text-slate-800">
        {feature === "pro"
          ? "Pro Analysis"
          : feature === "deep"
            ? "Deep Search"
            : feature === "agent"
              ? "Research Agent"
              : "Chat with Full Text"}{" "}
        is a Pro feature
      </p>
      <p className="text-sm text-slate-500 max-w-md">
        {gateMessage(feature)}
      </p>
      <button className="mt-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors">
        Upgrade
      </button>
      <p className="text-[11px] text-slate-400 mt-1">
        Dev preview — this gate is off by default
      </p>
    </div>
  );
}
