"use client";

import { useState, useEffect } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Paper } from "@/lib/types";

interface ProAnalysisData {
  steps: { action: string; status: string; result?: unknown; error?: string }[];
  papers: Paper[];
  claims: Record<string, string[]>;
  answer: string;
  totalClaimed: number;
}

interface ProAnalysisBlockProps {
  query: string;
  enabled: boolean;
}

/** Parse inline citations like [1], [2] in the answer text. */
function parseAnswerWithCitations(
  answer: string,
  papers: Paper[]
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const citationRegex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(answer)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>{answer.slice(lastIndex, match.index)}</span>
      );
    }

    const idx = parseInt(match[1], 10);
    const paper = papers[idx - 1]; // citations are 1-indexed

    if (paper) {
      const doi = paper.doi ? `https://doi.org/${paper.doi}` : undefined;
      const url = doi || `https://openalex.org/works/${paper.paperId}`;
      parts.push(
        <a
          key={`cite-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200 transition-colors align-super leading-none mx-0.5 no-underline"
          title={paper.title}
        >
          {idx}
        </a>
      );
    } else {
      parts.push(
        <span key={`cite-${match.index}`} className="text-slate-400">
          [{idx}]
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < answer.length) {
    parts.push(<span key={`text-${lastIndex}`}>{answer.slice(lastIndex)}</span>);
  }

  return parts;
}

function ProAnalysisSkeleton() {
  return (
    <Card className="p-5 border-cyan-100 bg-gradient-to-br from-cyan-50/50 to-white">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-cyan-500 animate-pulse" />
        <span className="text-sm font-semibold text-slate-800">Pro Analysis</span>
        <span className="text-xs text-slate-400 animate-pulse">Synthesizing...</span>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-full animate-pulse" />
        <div className="h-3 bg-slate-100 rounded w-5/6 animate-pulse" />
        <div className="h-3 bg-slate-100 rounded w-4/6 animate-pulse" />
      </div>
      <div className="mt-3 text-xs text-slate-400">
        Searching papers...
      </div>
    </Card>
  );
}

export function ProAnalysisBlock({ query, enabled }: ProAnalysisBlockProps) {
  const [data, setData] = useState<ProAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !query.trim()) {
      setData(null);
      return;
    }

    let cancelled = false;

    async function fetchProAnalysis() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query, depth: "deep" });
        const res = await fetch(`/api/pro-search?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const result: ProAnalysisData = await res.json();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Analysis failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProAnalysis();
    return () => { cancelled = true; };
  }, [query, enabled]);

  if (!enabled) return null;
  if (loading) return <ProAnalysisSkeleton />;
  if (error) return null; // graceful — don't show error block, just skip
  if (!data || !data.answer) return null;

  // Check if it's a fallback message (no Groq key)
  const isFallback =
    data.answer.includes("Add GROQ_API_KEY") ||
    data.answer.includes("GROQ_API_KEY");

  return (
    <Card className="p-5 border-cyan-100 bg-gradient-to-br from-cyan-50/50 to-white mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-cyan-500" />
        <span className="text-sm font-semibold text-slate-800">Pro Analysis</span>
      </div>

      {/* Answer with inline citations */}
      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
        {parseAnswerWithCitations(data.answer, data.papers)}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          Based on {data.papers.length} papers
        </span>
        {isFallback && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="w-3 h-3" />
            Enable GROQ_API_KEY for AI synthesis
          </span>
        )}
      </div>
    </Card>
  );
}
