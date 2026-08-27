"use client";

/**
 * Dev-only paywall gate toggle.
 *
 * Default: everything is OPEN (no gating) — this is a dev preview tool, not a
 * real paywall. To preview the gated consensus.app experience:
 *   - visit ?devgate=1 (persists in localStorage)
 *   - or set localStorage.setItem("consensus_dev_gate", "1")
 * To turn it off: ?devgate=0 or clear the localStorage key.
 */

const STORAGE_KEY = "consensus_dev_gate";

export function isDevGateEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDevGate(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Read ?devgate=1|0 on first load and persist it. */
export function initDevGateFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const v = url.searchParams.get("devgate");
    if (v === "1") setDevGate(true);
    else if (v === "0") setDevGate(false);
  } catch {
    // ignore
  }
}

/** The features that are gated in the real consensus.app (Pro/Deep). */
export type GatedFeature = "pro" | "deep" | "agent" | "fulltext";

export const GATED_FEATURE_LABELS: Record<GatedFeature, string> = {
  pro: "Pro Analysis",
  deep: "Deep Search",
  agent: "Research Agent",
  fulltext: "Chat with Full Text",
};

/** Locked message shown when the gate is on. Matches consensus.app's upsell copy. */
export function gateMessage(feature: GatedFeature): string {
  const label = GATED_FEATURE_LABELS[feature];
  return `${label} is available with Pro & Pro Max. Upgrade to unlock unlimited access.`;
}
