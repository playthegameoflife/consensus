"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Copy,
  Share2,
  Bookmark,
  ArrowUp,
} from "lucide-react";
import { Paper } from "@/lib/types";
import { PaperRow } from "./PaperRow";
import { ConsensusMeter4Way, MeterVerdict } from "./ConsensusMeter4Way";
import { CitationChip } from "./CitationChip";
import { RelatedSearches } from "./RelatedSearches";
import { ResultsTimeline } from "./ResultsTimeline";
import { GateOverlay } from "./GateOverlay";


export interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
  papers?: Paper[];
}

export interface AgentResult {
  plan: { query: string; rationale: string }[];
  searches: { query: string; total: number; papers: Paper[] }[];
  papers: (Paper & { aiFinding?: string })[];
  answer: string;
  steps: { action: string; status: string; detail?: string }[];
}

interface ThreadViewProps {
  query: string;
  mode: "basic" | "pro" | "deep" | "agent";
  searchCount: number;
  agentResult?: AgentResult | null;
  agentLoading?: boolean;
  synthesis: string;
  synthesisLoading: boolean;
  verdicts: MeterVerdict[];
  meterLoading: boolean;
  papers: (Paper & { aiFinding?: string })[];
  isLoadingPapers: boolean;
  onAskFollowUp: (question: string) => Promise<void>;
  followUps: FollowUpMessage[];
  followUpLoading: boolean;
  onSelectPaper: (paper: Paper) => void;
  selectedPaperIds: Set<string>;
  onToggleSelectPaper: (paperId: string, title: string, year: number, author: string) => void;
  savedPaperIds?: Set<string>;
  onToggleSavePaper?: (paper: Paper) => void;
  onSearch?: (q: string) => void;
  devGate?: boolean;
}

const MODE_LABEL: Record<string, string> = {
  basic: "Quick Search",
  pro: "Pro",
  deep: "Deep",
  agent: "Research Agent",
};

const LOADING_STAGES = [
  "Scoping...",
  "Researching...",
  "Scholaring...",
  "Bibliomining...",
  "Catalyzing...",
  "Mapping...",
  "Hypothesizing...",
  "Theorizing...",
  "Discovering...",
  "Distilling...",
  "Elucidating...",
  "Science-ing...",
  "Eureka-ing...",
];

function renderSynthesisWithCitations(
  text: string,
  papers: (Paper & { aiFinding?: string })[],
  onOpenDetails?: (paper: Paper) => void
): React.ReactNode[] {
  const regex = /\[(\d{1,2})\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const paragraphs = text.split(/\n\n+/);
  const parts: React.ReactNode[] = [];

  paragraphs.forEach((para, pIdx) => {
    // Check if this looks like a markdown header
    if (/^#{1,3}\s/.test(para)) {
      parts.push(
        <p key={`h-${pIdx}`} className="mt-4 mb-2 first:mt-0">
          {para}
        </p>
      );
      return;
    }

    const nodes: React.ReactNode[] = [];
    lastIdx = 0;
    while ((match = regex.exec(para)) !== null) {
      const n = parseInt(match[1], 10);
      const citedPaper = papers[n - 1];
      if (citedPaper) {
        if (match.index > lastIdx) {
          nodes.push(para.slice(lastIdx, match.index));
        }
        nodes.push(
          <CitationChip
            key={`cite-${key++}`}
            number={n}
            paper={citedPaper}
            onOpenDetails={onOpenDetails}
          />
        );
        lastIdx = match.index + match[0].length;
      }
    }
    if (lastIdx < para.length) nodes.push(para.slice(lastIdx));
    parts.push(
      <p key={`p-${pIdx}`} className="mb-3 last:mb-0 leading-relaxed text-[15px] text-slate-700">
        {nodes}
      </p>
    );
  });

  return parts;
}

export function ThreadView({
  query,
  mode,
  searchCount,
  agentResult,
  agentLoading,
  synthesis,
  synthesisLoading,
  verdicts,
  meterLoading,
  papers,
  isLoadingPapers,
  onAskFollowUp,
  followUps,
  followUpLoading,
  onSelectPaper,
  selectedPaperIds,
  onToggleSelectPaper,
  savedPaperIds,
  onToggleSavePaper,
  onSearch,
  devGate = false,
}: ThreadViewProps) {
  const [followInput, setFollowInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!synthesisLoading) return;
    setStageIdx(0);
    const id = setInterval(() => {
      setStageIdx((i) => (i + 1) % LOADING_STAGES.length);
    }, 2000);
    return () => clearInterval(id);
  }, [synthesisLoading]);

  // Scroll to top on mount
  useEffect(() => {
    const scrollContainer = document.querySelector('[class*="overflow-y-auto"]') as HTMLElement | null;
    if (scrollContainer) {
      requestAnimationFrame(() => { scrollContainer.scrollTop = 0; });
    }
    window.scrollTo(0, 0);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!bottomRef.current) return;
    let el: HTMLElement | null = bottomRef.current.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflow === "auto") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        return;
      }
      el = el.parentElement;
    }
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [followUps.length, followUpLoading]);

  const submitFollowUp = async () => {
    if (!followInput.trim() || followUpLoading) return;
    const q = followInput.trim();
    setFollowInput("");
    await onAskFollowUp(q);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* ─────────────────────────────────────────────────────────────────────────
          STICKY HEADER — question button + Share (matches consensus.app)
      ───────────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-bg-base border-b border-slate-200/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          {/* Question button in sticky header */}
          <button
            className="flex-1 overflow-hidden px-3 py-2 rounded-xl transition-colors max-w-96 hover:bg-bg-faint text-left"
            onClick={() => {
              // Scroll to top of content
              contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            aria-label={`Question: ${query}`}
          >
            <span className="text-[15px] font-medium text-fg-base truncate block">
              {query}
            </span>
          </button>

          {/* Share button */}
          <button
            className="p-2 rounded-xl hover:bg-bg-faint text-slate-500 transition-colors flex-shrink-0"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          SCROLLABLE MAIN CONTENT
      ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6" ref={contentRef}>
        <div className="max-w-3xl mx-auto">

          {/* H1 question (plain text, not a button) */}
          <h1 className="text-[22px] font-semibold text-fg-base mb-5 leading-snug">
            {query}
          </h1>

          {/* Mode badge + search count + steps */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-500 text-white text-xs font-semibold">
              {MODE_LABEL[mode]}
            </span>
            <span className="text-xs text-fg-muted">·</span>
            <span className="text-xs text-fg-muted">
              {searchCount} {searchCount === 1 ? "search" : "searches"}
            </span>
            <span className="text-xs text-fg-muted">·</span>
            <span className="text-xs text-fg-muted">3 steps</span>
          </div>

          {/* Query topic pills */}
          {papers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {Array.from(new Set(
                papers
                  .slice(0, 5)
                  .map((p) => p.title.split(" ").slice(0, 4).join(" "))
              )).slice(0, 4).map((tag, i) => (
                <button
                  key={i}
                  onClick={() => onSearch?.(tag)}
                  className="px-3 py-1 rounded-full bg-bg-muted hover:bg-bg-faint text-xs text-fg-base transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* ─── ConsensusMeter — always visible, above synthesis ─── */}
          {(mode === "pro" || mode === "deep") && (
            devGate ? (
              <div className="mb-6">
                <GateOverlay feature={mode === "deep" ? "deep" : "pro"} />
              </div>
            ) : (
              <div className="mb-6">
                <ConsensusMeter4Way
                  verdicts={verdicts}
                  query={query}
                  loading={meterLoading}
                />
              </div>
            )
          )}

          {/* ─── Synthesis block — always visible ─── */}
          <div className="mb-8">
            {devGate && (mode === "pro" || mode === "deep") ? (
              <GateOverlay feature={mode === "deep" ? "deep" : "pro"} />
            ) : synthesisLoading ? (
              /* Loading skeleton */
              <div className="animate-pulse space-y-3">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-11/12" />
                <div className="h-3 bg-slate-100 rounded w-9/12" />
                <div className="h-3 bg-slate-100 rounded w-10/12" />
                <div className="h-3 bg-slate-100 rounded w-8/12" />
                <p className="text-sm text-slate-400 pt-2">
                  {MODE_LABEL[mode]} · {LOADING_STAGES[stageIdx]}
                </p>
              </div>
            ) : synthesis ? (
              <>
                {/* Synthesis text with inline citation chips */}
                <div className="text-[15px] text-fg-base whitespace-pre-line leading-relaxed">
                  {renderSynthesisWithCitations(synthesis, papers, onSelectPaper)}
                </div>

                {/* Copy / Bookmark / Share bar */}
                <div className="flex items-center gap-1 mt-4">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(synthesis).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="p-1.5 rounded-lg hover:bg-bg-faint text-fg-muted transition-colors"
                    title={copied ? "Copied!" : "Copy answer"}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-bg-faint text-fg-muted transition-colors"
                    title="Bookmark"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-bg-faint text-fg-muted transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {/* ─── Research Agent block ─── */}
          {mode === "agent" && (
            <div className="mb-8">
              {devGate ? (
                <GateOverlay feature="agent" />
              ) : agentLoading && !agentResult ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <p className="text-xs text-slate-400 pt-1">
                    Research Agent · {LOADING_STAGES[stageIdx]}
                  </p>
                </div>
              ) : agentResult ? (
                <div className="bg-gradient-to-br from-indigo-50/60 to-white border border-indigo-100 rounded-2xl p-4">
                  {/* Plan */}
                  <div className="mb-3">
                    <p className="text-[11px] font-bold tracking-wide text-indigo-500 uppercase mb-2">
                      Research Plan
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {agentResult.plan.map((item, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-indigo-100 text-xs text-slate-700"
                        >
                          <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          {item.query}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Searches summary */}
                  <div className="mb-3 text-xs text-slate-500">
                    {agentResult.searches.map((s, i) => (
                      <span key={i} className="mr-3">
                        <span className="text-slate-400">{s.total.toLocaleString()}</span> results for "{s.query}"
                      </span>
                    ))}
                  </div>

                  {/* Report */}
                  <p className="text-[11px] font-bold tracking-wide text-indigo-500 uppercase mb-2">
                    Research Report
                  </p>
                  <div className="text-[14px] text-slate-700 leading-relaxed">
                    {renderSynthesisWithCitations(agentResult.answer, agentResult.papers, onSelectPaper)}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ─── Results section ─── */}
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-fg-base">
              {papers.length > 0 ? `${papers.length} Results` : ""}
            </h3>
            {selectedPaperIds.size > 0 && (
              <p className="text-xs text-fg-muted">
                {selectedPaperIds.size} selected — ask these papers below
              </p>
            )}
          </div>

          {/* Filter bar above results */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span>Sources</span>
              <span className="text-fg-base">Corpus</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span>Filter</span>
              <span className="text-fg-base">References</span>
            </div>
          </div>

          {isLoadingPapers && papers.length === 0 ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {papers.map((paper, idx) => (
                <PaperRow
                  key={paper.paperId}
                  number={idx + 1}
                  paper={paper}
                  onSelect={() => onSelectPaper(paper)}
                  selected={selectedPaperIds.has(paper.paperId)}
                  onToggleSelect={() =>
                    onToggleSelectPaper(
                      paper.paperId,
                      paper.authors?.[0]?.name?.split(" ").pop() || "Unknown",
                      paper.year,
                      paper.title
                    )
                  }
                  saved={savedPaperIds?.has(paper.paperId) ?? false}
                  onToggleSave={onToggleSavePaper ? () => onToggleSavePaper(paper) : undefined}
                />
              ))}
            </div>
          )}

          {/* ─── Follow-up messages ─── */}
          {followUps.map((msg, i) => (
            <div key={i} className="mt-8">
              {msg.role === "user" ? (
                <div className="flex justify-end mb-4">
                  <div className="bg-indigo-500 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-[15px] max-w-[80%] leading-snug">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-[15px] text-slate-700 whitespace-pre-line leading-relaxed">
                    {renderSynthesisWithCitations(msg.content, papers, onSelectPaper)}
                  </div>
                </div>
              )}
            </div>
          ))}

          {followUpLoading && (
            <div className="mt-8 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="text-sm text-slate-400 pt-1.5">Thinking…</div>
            </div>
          )}

          {/* Results timeline */}
          {papers.length > 0 && !isLoadingPapers && (
            <div className="mt-10">
              <ResultsTimeline papers={papers} onSelect={onSelectPaper} />
            </div>
          )}

          {/* Related searches */}
          {papers.length > 0 && !isLoadingPapers && onSearch && (
            <div className="mt-8">
              <RelatedSearches query={query} papers={papers} onSearch={onSearch} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ─── Pinned follow-up input ─── */}
      <div className="border-t border-slate-200 bg-white/95 backdrop-blur px-6 lg:px-10 py-4 sticky bottom-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-slate-50 border border-slate-200 focus-within:border-slate-300 rounded-[20px] shadow-sm transition-colors">
            <textarea
              value={followInput}
              onChange={(e) => setFollowInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitFollowUp();
                }
              }}
              placeholder={
                selectedPaperIds.size > 0
                  ? `Ask these ${selectedPaperIds.size} papers...`
                  : "Ask a follow-up..."
              }
              className="w-full bg-transparent px-4 py-3 pr-12 text-[15px] text-slate-700 placeholder:text-slate-400 resize-none rounded-[20px] outline-none"
              rows={1}
            />
            <button
              onClick={submitFollowUp}
              disabled={!followInput.trim() || followUpLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-indigo-500 text-white disabled:opacity-30 hover:bg-indigo-600 transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
