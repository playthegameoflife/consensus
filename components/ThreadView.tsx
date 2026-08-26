"use client";

import { useState, useRef, useEffect } from "react";
import {
  User,
  Sparkles,
  ChevronDown,
  Copy,
  Share2,
  Bookmark,
  ArrowUp,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Paper } from "@/lib/types";
import { PaperRow } from "./PaperRow";
import { ConsensusMeter4Way, MeterVerdict, classifyVerdict } from "./ConsensusMeter4Way";

export interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
  papers?: Paper[]; // new papers added by this follow-up
}

interface ThreadViewProps {
  query: string;
  mode: "basic" | "pro" | "deep";
  searchCount: number;
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
}

/**
 * Parse inline [N] citations in the synthesis and render them as
 * clickable green chips like consensus.app.
 */
function renderSynthesisWithCitations(
  text: string,
  paperCount: number
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
      if (n >= 1 && n <= paperCount + 30) {
        if (match.index > lastIdx) {
          nodes.push(para.slice(lastIdx, match.index));
        }
        nodes.push(
          <button
            key={`cite-${key++}`}
            className="inline-flex items-center justify-center align-super mx-0.5 w-4 h-4 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[10px] font-bold transition-colors"
            title={`Citation ${n}`}
          >
            {n}
          </button>
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
};

export function ThreadView({
  query,
  mode,
  searchCount,
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
}: ThreadViewProps) {
  const [followInput, setFollowInput] = useState("");
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [followUps.length, followUpLoading]);

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
          {/* User query as chat bubble */}
          <div className="flex justify-end mb-6">
            <div className="flex items-start gap-2.5 max-w-[80%]">
              <div className="bg-cyan-500 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-[15px] leading-snug">
                {query}
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Assistant block */}
          <div className="flex items-start gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
              <Sparkles className="w-4 h-4 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Thread header row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">
                  {MODE_LABEL[mode]}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-400">
                  {searchCount} searches
                </span>
                <div className="ml-auto flex items-center gap-1">
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
              </div>

              {/* Synthesis */}
              {synthesisLoading ? (
                <div className="animate-pulse space-y-2 mb-5">
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-11/12" />
                  <div className="h-3 bg-slate-100 rounded w-9/12" />
                  <p className="text-xs text-slate-400 pt-1">
                    Analyzing top papers (this can take a minute with Deep
                    models)...
                  </p>
                </div>
              ) : (
                <div className="text-[15px] text-slate-700 mb-5">
                  {renderSynthesisWithCitations(synthesis, papers.length)}
                </div>
              )}

              {/* 4-way Consensus Meter */}
              {(mode === "pro" || mode === "deep") && (
                <ConsensusMeter4Way
                  verdicts={verdicts}
                  query={query}
                  loading={meterLoading}
                />
              )}
            </div>
          </div>

          {/* Numbered paper list */}
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
                />
              ))}
            </div>
          )}

          {/* Follow-up messages (Threads) */}
          {followUps.map((msg, i) => (
            <div key={i} className="mt-8">
              {msg.role === "user" ? (
                <div className="flex justify-end mb-4">
                  <div className="bg-cyan-500 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-[15px] max-w-[80%]">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-[15px] text-slate-700">
                    {renderSynthesisWithCitations(msg.content, papers.length)}
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

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Pinned follow-up input (consensus.app Threads bar) */}
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
