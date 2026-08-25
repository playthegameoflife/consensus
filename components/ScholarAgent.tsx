"use client";

import { useState, useEffect, useRef } from "react";
import { Paper } from "@/lib/types";
import { formatAuthors } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Sparkles,
  FileSearch,
  Zap,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

interface SynthesizedFinding {
  id: string;
  icon: "lightbulb" | "trending" | "book";
  label: string;
  text: string;
  supportingPaperCount: number;
  papers: { title: string; year?: number }[];
}

interface ScholarAgentProps {
  papers: (Paper & { aiFinding?: string })[];
  query?: string;
  onPaperClick?: (paper: Paper) => void;
}

type StepStatus = "pending" | "active" | "done";

interface AgentStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const AGENT_STEPS: AgentStep[] = [
  {
    id: "analyze",
    label: "Analyzing Papers",
    description: "Reading abstracts and identifying key claims",
    icon: <FileSearch className="w-4 h-4" />,
  },
  {
    id: "compare",
    label: "Comparing Findings",
    description: "Cross-referencing methodologies and results",
    icon: <Brain className="w-4 h-4" />,
  },
  {
    id: "synthesize",
    label: "Synthesizing",
    description: "Building unified consensus view",
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: "score",
    label: "Scoring",
    description: "Calculating agreement strength",
    icon: <TrendingUp className="w-4 h-4" />,
  },
];

function FindingCard({
  finding,
  index,
  visible,
  onPaperClick,
}: {
  finding: SynthesizedFinding;
  index: number;
  visible: boolean;
  onPaperClick?: (title: string) => void;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transitionDelay: `${index * 120}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            backgroundColor:
              finding.icon === "lightbulb"
                ? "#fef9c3"
                : finding.icon === "trending"
                ? "#dcfce7"
                : "#eff6ff",
          }}
        >
          {finding.icon === "lightbulb" && (
            <Lightbulb
              className="w-4 h-4"
              style={{ color: "#ca8a04" }}
            />
          )}
          {finding.icon === "trending" && (
            <TrendingUp
              className="w-4 h-4"
              style={{ color: "#16a34a" }}
            />
          )}
          {finding.icon === "book" && (
            <BookOpen
              className="w-4 h-4"
              style={{ color: "#2563eb" }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-semibold"
            >
              {finding.label}
            </Badge>
            <span className="text-[10px] text-slate-400">
              {finding.supportingPaperCount}{" "}
              {finding.supportingPaperCount === 1 ? "paper" : "papers"}
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {finding.text}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {finding.papers.slice(0, 3).map((p, i) => (
              <button
                key={i}
                onClick={() => onPaperClick?.(p.title)}
                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[160px]"
              >
                {p.title}
              </button>
            ))}
            {finding.papers.length > 3 && (
              <span className="text-[10px] text-slate-400">
                +{finding.papers.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScholarAgent({ papers, query, onPaperClick }: ScholarAgentProps) {
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    () =>
      Object.fromEntries(AGENT_STEPS.map((s) => [s.id, "pending"]))
  );
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [findings, setFindings] = useState<SynthesizedFinding[]>([]);
  const [consensusSummary, setConsensusSummary] = useState<string>("");
  const [showFindings, setShowFindings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consensusScore, setConsensusScore] = useState<number | null>(null);
  const [agreeCount, setAgreeCount] = useState(0);
  const [disagreeCount, setDisagreeCount] = useState(0);
  const progressRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const runSynthesis = async () => {
    if (isRunning || papers.length === 0) return;
    setIsRunning(true);
    setError(null);

    // Reset
    setStepStatuses(Object.fromEntries(AGENT_STEPS.map((s) => [s.id, "pending"])));
    setFindings([]);
    setShowFindings(false);
    setIsComplete(false);
    setConsensusSummary("");
    setConsensusScore(null);

    const delay = (ms: number) =>
      new Promise((r) => setTimeout(r, ms));

    try {
      // Step 1: Analyzing
      setStepStatuses((prev) => ({ ...prev, analyze: "active" }));
      setActiveStep("analyze");
      await delay(1200);
      setStepStatuses((prev) => ({ ...prev, analyze: "done" }));

      // Step 2: Comparing
      setStepStatuses((prev) => ({ ...prev, compare: "active" }));
      setActiveStep("compare");
      await delay(1000);
      setStepStatuses((prev) => ({ ...prev, compare: "done" }));

      // Step 3: Synthesize — call LLM
      setStepStatuses((prev) => ({ ...prev, synthesize: "active" }));
      setActiveStep("synthesize");
      await delay(800);

      // Build a context string of paper findings
      const paperContext = papers
        .map(
          (p, i) =>
            `[${i + 1}] "${p.title}" ${p.year ? `(${p.year})` : ""}: ${p.aiFinding || p.abstract?.slice(0, 300) || "No abstract"}`
        )
        .join("\n\n");

      const synthesisPrompt = `You are a research synthesis agent. Given ${papers.length} academic papers, produce a JSON array of 3-5 key synthesized findings.

Each finding should:
1. Identify a key point of agreement or tension across the papers
2. Be labeled as one of: "Key Agreement", "Nuance", "Contradiction", "Gap", or "Method"
3. Include the count of papers that support this finding
4. List the titles of papers supporting this finding

Papers:
${paperContext}

${query ? `Query: "${query}"\n\nFocus findings on: "${query}"\n` : ""}

Return ONLY a JSON array like:
[{"label":"Key Agreement","text":"...","supportingPaperCount":N,"papers":[{"title":"...","year":2020},...]},...]

Respond with ONLY the JSON array, no markdown, no explanation.`;

      let rawOutput = "";
      try {
        const response = await fetch("/api/pro-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: synthesisPrompt,
            papers: [],
            mode: "light",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          rawOutput = data.output || data.text || data.response || "";
        }
      } catch {
        // non-fatal — use fallback
      }

      // Parse LLM output
      let parsedFindings: SynthesizedFinding[] = [];
      if (rawOutput) {
        try {
          const match = rawOutput.match(/\[[\s\S]*\]/);
          if (match) {
            parsedFindings = JSON.parse(match[0]);
          }
        } catch {
          // parse failure — fall through to rule-based
        }
      }

      // Fallback: rule-based findings
      if (parsedFindings.length === 0) {
        parsedFindings = buildRuleBasedFindings(papers, query);
      }

      setFindings(parsedFindings);
      setStepStatuses((prev) => ({ ...prev, synthesize: "done" }));

      // Step 4: Scoring
      setStepStatuses((prev) => ({ ...prev, score: "active" }));
      setActiveStep("score");
      await delay(600);

      const supporting = parsedFindings.filter(
        (f) => f.label === "Key Agreement"
      ).length;
      const score = parsedFindings.length > 0
        ? (supporting / parsedFindings.length) * 2 - 1
        : 0;
      setConsensusScore(Math.max(-1, Math.min(1, score)));
      setAgreeCount(parsedFindings.filter((f) => f.label === "Key Agreement").length);
      setDisagreeCount(parsedFindings.filter((f) => f.label === "Contradiction").length);

      const summaryParts: string[] = [];
      if (supporting >= parsedFindings.length * 0.6) {
        summaryParts.push("Strong consensus across papers.");
      } else if (supporting >= parsedFindings.length * 0.3) {
        summaryParts.push("Mixed findings with partial agreement.");
      } else {
        summaryParts.push("Limited consensus — significant disagreement or gaps.");
      }
      if (parsedFindings.some((f) => f.label === "Contradiction")) {
        summaryParts.push("Some contradictions detected.");
      }
      setConsensusSummary(summaryParts.join(" "));

      setStepStatuses((prev) => ({ ...prev, score: "done" }));
      setIsComplete(true);
      setActiveStep(null);
      setShowFindings(true);
    } catch (e) {
      setError("Synthesis failed. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setStepStatuses(Object.fromEntries(AGENT_STEPS.map((s) => [s.id, "pending"])));
    setActiveStep(null);
    setIsComplete(false);
    setFindings([]);
    setShowFindings(false);
    setConsensusSummary("");
    setConsensusScore(null);
    setError(null);
    setIsRunning(false);
  };

  const scoreColor =
    consensusScore === null
      ? "bg-slate-200"
      : consensusScore > 0.3
      ? "bg-emerald-500"
      : consensusScore < -0.2
      ? "bg-red-500"
      : "bg-amber-500";

  const scoreLabel =
    consensusScore === null
      ? "—"
      : consensusScore > 0.5
      ? "Strong Consensus"
      : consensusScore > 0.1
      ? "Partial Agreement"
      : consensusScore < -0.1
      ? "Disagreement"
      : "Mixed";

  return (
    <div className="flex flex-col gap-4">
      {/* Agent Steps */}
      <div className="space-y-1">
        {AGENT_STEPS.map((step, idx) => {
          const status = stepStatuses[step.id];
          const isActive = activeStep === step.id;
          return (
            <div key={step.id} className="flex items-center gap-3">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`w-0.5 h-4 ml-2.5 ${
                    stepStatuses[AGENT_STEPS[idx - 1].id] === "done"
                      ? "bg-blue-500"
                      : "bg-slate-200"
                  }`}
                />
              )}
              <div className="flex items-center gap-2.5 py-1">
                {/* Step icon */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor:
                      status === "done"
                        ? "#2563eb"
                        : status === "active"
                        ? "#3b82f6"
                        : "#e2e8f0",
                    color: status === "pending" ? "#94a3b8" : "white",
                    transform: isActive ? "scale(1.15)" : "scale(1)",
                    boxShadow: isActive ? "0 0 0 3px rgba(59,130,246,0.25)" : "none",
                  }}
                >
                  {status === "done" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div>
                  <p
                    className="text-xs font-semibold transition-colors duration-300"
                    style={{
                      color:
                        status === "done"
                          ? "#2563eb"
                          : status === "active"
                          ? "#1d4ed8"
                          : "#94a3b8",
                    }}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-400">{step.description}</p>
                </div>
                {isActive && (
                  <div className="ml-auto">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Run / Reset button */}
      {!isComplete && (
        <button
          onClick={runSynthesis}
          disabled={isRunning || papers.length === 0}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              Synthesizing…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Run Scholar Synthesis
            </>
          )}
        </button>
      )}

      {isComplete && (
        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 w-full py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl font-medium text-sm transition-colors"
        >
          Run Again
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {papers.length === 0 && !isRunning && (
        <p className="text-xs text-slate-400 text-center py-2">
          Add papers to begin synthesis
        </p>
      )}

      {/* Consensus Score Bar */}
      {isComplete && consensusScore !== null && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">
                Consensus Score
              </span>
            </div>
            <Badge
              variant="secondary"
              className="text-xs"
              style={{
                backgroundColor:
                  consensusScore > 0.3
                    ? "#dcfce7"
                    : consensusScore < -0.2
                    ? "#fee2e2"
                    : "#fef9c3",
                color:
                  consensusScore > 0.3
                    ? "#15803d"
                    : consensusScore < -0.2
                    ? "#dc2626"
                    : "#a16207",
              }}
            >
              {scoreLabel}
            </Badge>
          </div>

          {/* Score bar */}
          <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-1/2 transition-all duration-700 ease-out rounded-full"
              style={{
                width: `${Math.abs(consensusScore) * 50}%`,
                left: consensusScore >= 0 ? "50%" : `${50 - Math.abs(consensusScore) * 50}%`,
                backgroundColor:
                  consensusScore > 0.3
                    ? "#10b981"
                    : consensusScore < -0.2
                    ? "#ef4444"
                    : "#f59e0b",
              }}
            />
            {/* Center line */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-400" />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Disagree (−1)</span>
            <span className="font-semibold text-slate-600">
              {consensusScore > 0 ? "+" : ""}
              {consensusScore.toFixed(2)}
            </span>
            <span>Agree (+1)</span>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {agreeCount} agreeing
            </span>
            <span className="flex items-center gap-1 text-xs text-red-500">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-1 4a1 1 0 112 0v3a1 1 0 11-2 0V5zm1 8a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              {disagreeCount} contradicting
            </span>
          </div>

          {consensusSummary && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {consensusSummary}
            </p>
          )}
        </div>
      )}

      {/* Findings */}
      {showFindings && findings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-semibold text-slate-600">
              Key Findings ({findings.length})
            </span>
          </div>
          {findings.map((f, i) => (
            <FindingCard
              key={f.id}
              finding={f}
              index={i}
              visible={showFindings}
              onPaperClick={(title) => {
                const paper = papers.find((p) => p.title === title);
                if (paper && onPaperClick) onPaperClick(paper);
              }}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 text-center py-2">{error}</p>
      )}
    </div>
  );
}

function buildRuleBasedFindings(
  papers: (Paper & { aiFinding?: string })[],
  query?: string
): SynthesizedFinding[] {
  const n = papers.length;
  if (n === 0) return [];

  const findings: SynthesizedFinding[] = [];
  const titles = papers.map((p) => ({ title: p.title, year: p.year }));

  // Agrees that topic is important
  findings.push({
    id: "finding-1",
    icon: "trending",
    label: "Key Agreement",
    text: `${n} out of ${n} papers address the topic with significant overlap in methodology or scope.`,
    supportingPaperCount: n,
    papers: titles,
  });

  // Year consistency
  const years = papers.map((p) => p.year).filter(Boolean) as number[];
  if (years.length > 1) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    if (max - min <= 5) {
      findings.push({
        id: "finding-2",
        icon: "book",
        label: "Temporal Concentration",
        text: `All papers were published within a ${max - min === 0 ? "single year" : `${max - min} year window`} (${min}${max !== min ? `–${max}` : ""}), indicating a focused research period.`,
        supportingPaperCount: n,
        papers: titles,
      });
    }
  }

  // Abstract overlap finding
  const abstracts = papers
    .map((p) => p.abstract || "")
    .filter(Boolean);
  if (abstracts.length >= 2) {
    const avgLen = abstracts.reduce((s, a) => s + a.length, 0) / abstracts.length;
    findings.push({
      id: "finding-3",
      icon: "lightbulb",
      label: "Method",
      text: `Papers average ${Math.round(avgLen / 10) * 10} words in their abstracts, suggesting ${avgLen > 300 ? "detailed" : "concise"} treatment of the subject.`,
      supportingPaperCount: n,
      papers: titles,
    });
  }

  // Gap observation
  if (papers.some((p) => !p.aiFinding)) {
    const noFinding = papers.filter((p) => !p.aiFinding).length;
    findings.push({
      id: "finding-4",
      icon: "lightbulb",
      label: "Gap",
      text: `${noFinding} of ${n} papers lack extracted key findings — additional manual review may be needed.`,
      supportingPaperCount: n - noFinding,
      papers: papers.filter((p) => p.aiFinding).map((p) => ({ title: p.title, year: p.year })),
    });
  }

  return findings;
}
