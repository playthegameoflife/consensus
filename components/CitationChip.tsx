"use client";

import { useState } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { Paper } from "@/lib/types";

interface CitationHoverCardProps {
  paper: Paper;
  onOpenDetails?: (paper: Paper) => void;
}

/**
 * Green [N] citation chip with a consensus.app-style hover card:
 * paper title, "USED FULL TEXT" badge, year/citations/authors/journal,
 * Details + PDF buttons.
 */
export function CitationChip({
  paper,
  onOpenDetails,
}: CitationHoverCardProps) {
  const [hovered, setHovered] = useState(false);
  const hasPdf = !!paper.openAccessPdf?.url;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button className="inline-flex items-center justify-center align-super mx-0.5 w-4 h-4 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[10px] font-bold transition-colors">
        {""}
      </button>

      {hovered && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 block">
          <span className="block bg-white rounded-xl border border-slate-200 shadow-xl p-3.5 text-left">
            {/* USED FULL TEXT badge */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold tracking-wide text-slate-500 mb-2">
              <FileText className="w-2.5 h-2.5" />
              {hasPdf ? "USED FULL TEXT" : "USED ABSTRACT"}
            </span>
            {/* Title */}
            <span className="block text-[13px] font-semibold text-slate-900 leading-snug mb-1.5">
              {paper.title}
            </span>
            {/* Meta */}
            <span className="block text-[11px] text-slate-400 leading-relaxed">
              {paper.year} ·{" "}
              {paper.citationCount?.toLocaleString() || 0} citations
              <br />
              {paper.authors?.slice(0, 3).map((a) => a.name).join(", ") || "Unknown authors"}
              {paper.journal ? ` · ${paper.journal}` : ""}
            </span>
            {/* Actions */}
            <span className="flex gap-2 mt-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails?.(paper);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 font-medium"
              >
                Details
              </button>
              {hasPdf && (
                <a
                  href={paper.openAccessPdf!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium"
                >
                  PDF <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
