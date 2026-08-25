"use client";

import { Paper } from "@/lib/types";
import { useMemo } from "react";

interface ResultsTimelineProps {
  papers: Paper[];
  onSelect?: (paper: Paper) => void;
  selectedPaperId?: string;
}

export function ResultsTimeline({ papers, onSelect, selectedPaperId }: ResultsTimelineProps) {
  const { minYear, maxYear, buckets } = useMemo(() => {
    const years = papers.map((p) => p.year).filter((y): y is number => y != null && y > 1900);
    if (years.length === 0) return { minYear: 0, maxYear: 0, buckets: [] };

    const min = Math.min(...years);
    const max = Math.max(...years);
    const range = max - min || 1;

    // Group papers into ~10 buckets
    const numBuckets = Math.min(10, range);
    const bucketSize = Math.ceil(range / numBuckets);
    const grouped: { yearStart: number; yearEnd: number; papers: Paper[] }[] = [];

    for (let i = 0; i < numBuckets; i++) {
      const yearStart = min + i * bucketSize;
      const yearEnd = Math.min(yearStart + bucketSize - 1, max);
      grouped.push({ yearStart, yearEnd, papers: [] });
    }

    for (const paper of papers) {
      if (paper.year == null || paper.year < min) continue;
      const idx = Math.min(Math.floor((paper.year - min) / bucketSize), numBuckets - 1);
      grouped[idx].papers.push(paper);
    }

    return { minYear: min, maxYear: max, buckets: grouped };
  }, [papers]);

  if (!buckets.length) return null;

  const timelineHeight = 120;

  return (
    <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Publication Timeline</h3>
        <span className="text-xs text-slate-400">
          {minYear} – {maxYear}
        </span>
      </div>

      {/* Timeline track */}
      <div className="relative" style={{ height: timelineHeight }}>
        {/* Horizontal line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2" />

        {/* Year labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-400">
          <span>{minYear}</span>
          <span>{Math.round((minYear + maxYear) / 2)}</span>
          <span>{maxYear}</span>
        </div>

        {/* Paper circles */}
        {buckets.map((bucket, bi) => {
          if (bucket.papers.length === 0) return null;
          // Position buckets evenly across width, with some vertical jitter
          const leftPct = (bi / Math.max(buckets.length - 1, 1)) * 100;
          const jitter = ((bi * 37) % 11) - 5; // pseudo-random -5 to +5

          return bucket.papers.map((paper, pi) => {
            const topPct = 50 + jitter + (pi % 2 === 0 ? -1 : 1) * (pi * 3);
            const isSelected = paper.paperId === selectedPaperId;
            const hasConsensus = (paper as any).consensusScore !== undefined;
            const isAgree = (paper as any).consensusScore > 0.5;
            const isDisagree = (paper as any).consensusScore < -0.3;

            let dotColor = "bg-blue-500";
            if (hasConsensus && isAgree) dotColor = "bg-emerald-500";
            else if (hasConsensus && isDisagree) dotColor = "bg-red-400";
            else if (hasConsensus) dotColor = "bg-slate-400";

            return (
              <button
                key={paper.paperId}
                title={`${paper.title} (${paper.year})`}
                onClick={() => onSelect?.(paper)}
                className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-150 hover:z-10 ${dotColor} ${
                  isSelected ? "scale-150 ring-2 ring-blue-400 z-10" : ""
                }`}
                style={{
                  left: `calc(${leftPct}% + ${pi * 4}px)`,
                  top: `clamp(15%, ${topPct}%, 70%)`,
                }}
              />
            );
          });
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span>General</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Agreeing</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span>Disagreeing</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span>Mixed</span>
        </div>
      </div>
    </div>
  );
}
