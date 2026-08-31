"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Copy,
  Share2,
  Bookmark,
  ArrowUp,
  SlidersHorizontal,
} from "lucide-react";
import { Paper } from "@/lib/types";
import { PaperRow } from "./PaperRow";
import { ConsensusMeter4Way, MeterVerdict, classifyVerdict } from "./ConsensusMeter4Way";
import { CitationChip } from "./CitationChip";
import { RelatedSearches } from "./RelatedSearches";
import { ResultsTimeline } from "./ResultsTimeline";
import { GateOverlay } from "./GateOverlay";

export interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
  papers?: Paper[]; // new papers added by this follow-up
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
  synthesis: string; // Pro Analysis answer (may be fallback text)
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

/**
 * Parse inline [N] citations in the synthesis and render them as
 * hover-card citation chips like consensus.app.
 */
function renderSynthesisWithCitations(
  text: string,
  papers: (Paper & { aiFinding?: string })[],
  onOpenDetails?: (paper: Paper) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\[(\d{1,2})\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  // Split into paragraphs first for proper spacing
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((para, pIdx) => {
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
      <p key={`p-${pIdx}`} className="mb-3 last:mb-0 leading-relaxed">
        {nodes}
      </p>
    );
  });

  return parts;
}

const MODE_LABEL: Record<string, string> = {
  basic: "Quick Search",
  pro: "Pro",
  deep: "Deep",
  agent: "Research Agent",
};

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
  const bottomRef = useRef<HTMLDivElement>(null);

  // consensus.app's animated loading stages — verified LIVE via Scrapling
  // (13 unique stages observed across repeated requests):
  // Scoping, Researching, Scholaring, Bibliomining, Catalyzing, Mapping,
  // Hypothesizing, Theorizing, Discovering, Distilling, Elucidating,
  // Science-ing, Eureka-ing
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
  const [stageIdx, setStageIdx] = useState(0);
  const [synthesisExpanded, setSynthesisExpanded] = useState(true); // show synthesis by default
  useEffect(() => {
    if (!synthesisLoading) return;
    setStageIdx(0);
    const id = setInterval(() => {
      setStageIdx((i) => (i + 1) % LOADING_STAGES.length);
    }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synthesisLoading]);

  // Scroll to bottom when new messages arrive or loading state changes
  useEffect(() => {
    if (!bottomRef.current) return;
    // Find the nearest ancestor scrollable div (overflow-y-auto)
    let el: HTMLElement | null = bottomRef.current.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflow === "auto") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        return;
      }
      el = el.parentElement;
    }
    // Fallback: scroll window
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [followUps.length, followUpLoading]);

  // On mount, scroll the thread area to top so question bubble is visible
  useEffect(() => {
    // Find the overflow-y-auto container and reset its scroll to 0
    const scrollContainer = document.querySelector('[class*="overflow-y-auto"]') as HTMLElement | null;
    if (scrollContainer) {
      // Use requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = 0;
      });
    }
    // Also scroll window to top as fallback
    window.scrollTo(0, 0);
  }, []);

  const submitFollowUp = async () => {
    if (!followInput.trim() || followUpLoading) return;
    const q = followInput.trim();
    setFollowInput("");
    await onAskFollowUp(q);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Scrollable thread area */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
        <div className="max-w-3xl mx-auto">

          {/* ──────────────────────────────────────────────────────────────────
              consensus.app verified structure (Scrapling SSR, Aug 2026):
              1. Question bubble (right-aligned) is the expand/collapse TOGGLE
              2. When expanded: synthesis revealed below, inside the same area
              3. Results come AFTER the synthesis block
              4. ConsensusMeter appears between synthesis and results
          ─────────────────────────────────────────────────────────────────── */}

          {/* Question bubble — right-aligned, is the expand/collapse toggle */}
          <div className="flex justify-end mb-6">
            <div className="relative inline-block">
              <button
                onClick={() => setSynthesisExpanded((e) => !e)}
                aria-expanded={synthesisExpanded}
                className="px-4 py-2.5 rounded-tl-[22px] rounded-tr-[22px] rounded-bl-[22px] rounded-br-[8px] cursor-pointer bg-slate-100 hover:bg-slate-200 text-left transition-colors"
              >
                <p className="text-[15px] text-slate-700 whitespace-pre-line break-words hyphens-auto leading-snug line-clamp-3">
                  {query}
                </p>
              </button>
            </div>
          </div>

          {/* Synthesis + ConsensusMeter block — revealed when question is expanded.
              This replaces the old user/assistant chat bubble layout. */}
          {synthesisExpanded && (
            <div className="mb-8">
              {/* Synthesis text — shown in all modes */}
              <div className="flex items-start gap-2.5 mb-6">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Thread header */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">
                        {MODE_LABEL[mode]}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-400">
                        {searchCount} {searchCount === 1 ? "search" : "searches"}
                      </span>
                    </div>

                    {devGate && (mode === "pro" || mode === "deep") ? (
                      <GateOverlay feature={mode === "deep" ? "deep" : "pro"} />
                    ) : synthesisLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-3 bg-slate-100 rounded w-full" />
                        <div className="h-3 bg-slate-100 rounded w-11/12" />
                        <div className="h-3 bg-slate-100 rounded w-9/12" />
                        <p className="text-sm text-slate-500 pt-1 text-shimmer">
                          {MODE_LABEL[mode]} · {LOADING_STAGES[stageIdx]}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[15px] text-slate-700 whitespace-pre-line leading-relaxed">
                        {renderSynthesisWithCitations(synthesis, papers, onSelectPaper)}
                      </div>
                    )}
                  </div>
                </div>

              {/* Copy / Bookmark / Share bar */}
              {!synthesisLoading && synthesis && (
                <div className="flex items-center gap-1 mb-4 pl-10">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(synthesis).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                    title={copied ? "Copied!" : "Copy answer"}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                    title="Bookmark thread"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                    title="Share thread"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Research Agent block — plan, searches, cited report */}
              {mode === "agent" && (
                <div className="mb-5">
                  {devGate ? (
                    <GateOverlay feature="agent" />
                  ) : agentLoading && !agentResult ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                      <div className="h-3 bg-slate-100 rounded w-2/3" />
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <p className="text-xs text-slate-400 pt-1">
                        🤖 Research Agent · {LOADING_STAGES[stageIdx]}
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
                        {renderSynthesisWithCitations(
                          agentResult.answer,
                          agentResult.papers,
                          onSelectPaper
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* ConsensusMeter 4-way — between synthesis and results, for Pro/Deep only */}
              {(mode === "pro" || mode === "deep") && (
                devGate ? (
                  <GateOverlay feature={mode === "deep" ? "deep" : "pro"} compact />
                ) : (
                  <ConsensusMeter4Way
                    verdicts={verdicts}
                    query={query}
                    loading={meterLoading}
                  />
                )
              )}
            </div>
          )}

          {/* Results section — shown regardless of expand state */}
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-slate-700">
              {papers.length > 0 ? `${papers.length} Results` : ""}
            </h3>
            {selectedPaperIds.size > 0 && (
              <p className="text-xs text-slate-500">
                {selectedPaperIds.size} selected — ask these papers below
              </p>
            )}
          </div>

          {isLoadingPapers && papers.length === 0 ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse"
                >
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

          {/* Follow-up messages (consensus.app Threads) */}
          {followUps.map((msg, i) => (
            <div key={i} className="mt-8">
              {msg.role === "user" ? (
                <div className="flex justify-end mb-4">
                  <div className="bg-cyan-500 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-[15px] max-w-[80%] leading-snug">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
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
              <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
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

      {/* Pinned follow-up input */}
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
              rows={1}
              disabled={followUpLoading}
              className="block w-full resize-none outline-none bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 pl-4 pr-28 py-3.5 max-h-[140px]"
              style={{ overflowY: "auto" }}
            />
            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
              <button
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                title="Filter results"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={submitFollowUp}
                disabled={!followInput.trim() || followUpLoading}
                aria-label="Send follow-up"
                className="w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 flex items-center justify-center text-white transition-colors"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Consensus can make mistakes. Every answer is grounded in the papers
            shown above.
          </p>
        </div>
      </div>
    </div>
  );
}
