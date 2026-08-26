"use client";

import { useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";

export interface MeterVerdict {
  paperId: string;
  title: string;
  year: number;
  journal?: string;
  verdict: "yes" | "possibly" | "mixed" | "no";
  keyFinding?: string;
}

interface ConsensusMeter4WayProps {
  verdicts: MeterVerdict[];
  query: string;
  loading?: boolean;
}

const SEGMENTS = [
  {
    key: "yes" as const,
    label: "Yes",
    color: "#16a34a", // green-600
    lightBg: "bg-green-50",
    textColor: "text-green-700",
  },
  {
    key: "possibly" as const,
    label: "Possibly",
    color: "#eab308", // yellow-500
    lightBg: "bg-yellow-50",
    textColor: "text-yellow-700",
  },
  {
    key: "mixed" as const,
    label: "Mixed",
    color: "#f97316", // orange-500
    lightBg: "bg-orange-50",
    textColor: "text-orange-700",
  },
  {
    key: "no" as const,
    label: "No",
    color: "#dc2626", // red-600
    lightBg: "bg-red-50",
    textColor: "text-red-700",
  },
];

/**
 * Classify a single paper's verdict for the query from its AI finding text.
 * Mirrors consensus.app's Yes / Possibly / Mixed / No categorization.
 */
export function classifyVerdict(finding?: string): MeterVerdict["verdict"] {
  if (!finding) return "mixed";
  const t = finding.toLowerCase();

  // Explicit negation patterns → No
  const noPatterns = [
    /\bno (significant|evidence|effect|association|difference|benefit)\b/,
    /\bdoes not\b/,
    /\bdid not\b/,
    /\bnot effective\b/,
    /\bnot associated\b/,
    /\bno improvement\b/,
    /\bfails? to\b/,
    /\bno support\b/,
  ];
  // Strong positive patterns → Yes
  const yesPatterns = [
    /\bsignificantly (improv|reduc|increas|decreas|enhanc|lowers?|better|higher)/,
    /\beffective\b/,
    /\bimproves?\b/,
    /\breduces?\b/,
    /\bincreases?\b/,
    /\bbeneficial\b/,
    /\bsupports?\b/,
    /\bpositive(ly)? (correlat|associat)/,
  ];
  // Hedged patterns → Possibly
  const possiblyPatterns = [
    /\bmay\b/,
    /\bmight\b/,
    /\bcould\b/,
    /\bpossible\b/,
    /\blikely\b/,
    /\bsuggest(s)?\b/,
    /\bpreliminary\b/,
    /\bassociated with\b/,
    /\bin some\b/,
    /\bsmall\b.*\beffect\b/,
  ];

  const hasNo = noPatterns.some((p) => p.test(t));
  const hasYes = yesPatterns.some((p) => p.test(t));
  const hasPossibly = possiblyPatterns.some((p) => p.test(t));

  if (hasYes && hasNo) return "mixed";
  if (hasNo) return "no";
  // Strong positive claim dominates hedging (consensus.app skews decisive)
  if (hasYes) return "yes";
  if (hasPossibly) return "possibly";
  return "mixed";
}

export function ConsensusMeter4Way({
  verdicts,
  query,
  loading = false,
}: ConsensusMeter4WayProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [hoveredSeg, setHoveredSeg] = useState<string | null>(null);

  const counts = Object.fromEntries(
    SEGMENTS.map((s) => [
      s.key,
      verdicts.filter((v) => v.verdict === s.key).length,
    ])
  ) as Record<string, number>;

  const total = verdicts.length || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  if (loading) {
    return (
      <div className="mb-5 p-5 bg-white rounded-2xl border border-slate-200">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-100 rounded w-48 mb-3" />
          <div className="h-8 bg-slate-100 rounded-xl w-full mb-2" />
          <div className="h-3 bg-slate-100 rounded w-64" />
        </div>
      </div>
    );
  }

  if (!verdicts.length) return null;

  return (
    <div className="mb-5 p-5 bg-white rounded-2xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-slate-900">
            Consensus Meter
          </h3>
          <span className="text-xs text-slate-400">
            N = {verdicts.length}
          </span>
        </div>
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
        >
          All details
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              showDetails ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Stacked bar */}
      <div
        className="flex h-9 rounded-xl overflow-hidden w-full"
        role="meter"
        aria-label={`Consensus on ${query}`}
      >
        {SEGMENTS.map((seg) => {
          const n = counts[seg.key];
          if (n === 0) return null;
          const w = pct(n);
          return (
            <button
              key={seg.key}
              onMouseEnter={() => setHoveredSeg(seg.key)}
              onMouseLeave={() => setHoveredSeg(null)}
              style={{ backgroundColor: seg.color, width: `${w}%` }}
              className="relative flex items-center justify-center min-w-[0] transition-all hover:brightness-110 focus:outline-none"
              aria-label={`${seg.label}: ${n} papers`}
            >
              {/* Count badge inside segment */}
              <span className="text-white text-xs font-bold drop-shadow truncate px-1">
                {n > 1 ? `${seg.label} ${w}%` : seg.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
        {SEGMENTS.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            {seg.label}
            <span className="font-semibold">{counts[seg.key]}</span>
          </span>
        ))}
      </div>

      {/* Hover tooltip per segment */}
      {hoveredSeg && (
        <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Table2 className="w-3.5 h-3.5" />
            {counts[hoveredSeg]} ✓{" "}
            {SEGMENTS.find((s) => s.key === hoveredSeg)?.label}
          </p>
          <ul className="space-y-0.5 max-h-28 overflow-y-auto">
            {verdicts
              .filter((v) => v.verdict === hoveredSeg)
              .slice(0, 6)
              .map((v) => (
                <li key={v.paperId} className="text-xs text-slate-500 truncate">
                  • {v.title.slice(0, 90)} ({v.year})
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* All details expansion — summary stats across positions */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {SEGMENTS.map((seg) => {
            const group = verdicts.filter((v) => v.verdict === seg.key);
            return (
              <div key={seg.key}>
                <p
                  className={`text-xs font-bold uppercase tracking-wide mb-1 ${seg.textColor}`}
                >
                  {seg.label} · {group.length}
                </p>
                {group.length ? (
                  <ul className="space-y-1">
                    {group.slice(0, 4).map((v) => (
                      <li
                        key={v.paperId}
                        className="text-[11px] leading-snug text-slate-500 line-clamp-2"
                        title={v.title}
                      >
                        {v.title.slice(0, 70)} ({v.year})
                      </li>
                    ))}
                    {group.length > 4 && (
                      <li className="text-[11px] text-slate-400">
                        +{group.length - 4} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-400">None</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
