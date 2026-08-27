"use client";

import { Eye, MessageSquare, BookOpen, Layers, Check } from "lucide-react";
import { Paper } from "@/lib/types";
import { extractKeyTakeaway, getQualityBadges } from "@/lib/paper-insights";

interface PaperRowProps {
  number: number;
  paper: Paper & { aiFinding?: string };
  onSelect: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}

const BADGE_ICONS = {
  eye: Eye,
  chat: MessageSquare,
  journal: BookOpen,
  meta: Layers,
};

export function PaperRow({
  number,
  paper,
  onSelect,
  selected,
  onToggleSelect,
}: PaperRowProps) {
  const takeaway = extractKeyTakeaway(paper);
  const badges = getQualityBadges(paper);
  const authors =
    paper.authors
      ?.slice(0, 2)
      .map((a) => a.name)
      .join(", ") + (paper.authors?.length > 2 ? " et al." : "") || "Unknown";

  return (
    <div
      className={`group flex gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
        selected
          ? "bg-cyan-50/60 border-cyan-300"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      {/* Number */}
      <span className="text-sm font-semibold text-slate-400 w-6 flex-shrink-0 pt-0.5 text-right">
        {number}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <h4 className="text-[15px] font-semibold text-slate-900 leading-snug mb-1.5 group-hover:text-cyan-700 transition-colors">
          {paper.title}
        </h4>

        {/* RETRACTED badge — consensus.app marks these and excludes from analyses */}
        {paper.isRetracted && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold tracking-wide mb-1.5">
            ⚠️ RETRACTED
          </span>
        )}

        {/* KEY TAKEAWAY block — left-bordered quote like consensus.app */}
        <p className="text-[13px] text-slate-600 leading-relaxed border-l-2 border-emerald-400 pl-2.5 mb-2 line-clamp-2">
          {takeaway}
        </p>

        {/* Quality badges */}
        {badges.length > 0 && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {badges.map((b) => {
              const Icon = BADGE_ICONS[b.icon];
              return (
                <span
                  key={b.label}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold tracking-wide text-slate-500"
                >
                  <Icon className="w-3 h-3" />
                  {b.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Meta line */}
        <p className="text-xs text-slate-400">
          {paper.year} · {paper.citationCount.toLocaleString()} citations ·{" "}
          {authors}
          {paper.journal ? ` · ${paper.journal}` : ""}
        </p>
      </div>

      {/* Select checkbox (chat-with-paper multi-select) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        aria-label={selected ? "Deselect paper" : "Select paper"}
        className={`self-start flex-shrink-0 w-5 h-5 mt-1 rounded-md border flex items-center justify-center transition-colors ${
          selected
            ? "bg-cyan-500 border-cyan-500 text-white"
            : "border-slate-300 hover:border-cyan-400 bg-white"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
