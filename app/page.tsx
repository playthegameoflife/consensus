"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Logo } from "@/components/Logo";
import { LeftSidebar } from "@/components/LeftSidebar";
import { FilterSidebar, Filters } from "@/components/FilterSidebar";
import { EnhancedPaperDetailPanel } from "@/components/EnhancedPaperDetailPanel";
import { SearchHistory, addToHistory } from "@/components/SearchHistory";
import { Corpus as CorpusType } from "@/components/MedicalModeToggle";
import { SearchMode as SearchModeType } from "@/components/SearchModeToggle";
import { HeroSearchBar } from "@/components/HeroSearchBar";
import {
  ThreadView,
  FollowUpMessage,
} from "@/components/ThreadView";
import {
  MeterVerdict,
  classifyVerdict,
} from "@/components/ConsensusMeter4Way";
import { Paper } from "@/lib/types";
import { HelpCircle, Search, RefreshCw, SlidersHorizontal } from "lucide-react";

interface SearchResult {
  papers: (Paper & { aiFinding?: string; consensusScore?: number })[];
  total: number;
  offset: number;
}

interface SynthesisResult {
  answer: string;
  steps?: { action: string; status: string }[];
  papers?: Paper[];
  error?: string;
}

interface AgentResult {
  plan: { query: string; rationale: string }[];
  searches: { query: string; total: number; papers: Paper[] }[];
  papers: (Paper & { aiFinding?: string })[];
  answer: string;
  steps: { action: string; status: string; detail?: string }[];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    yearRange: [1900, 2026],
    studyTypes: [],
    openAccessOnly: false,
    citationMin: 0,
    sort: "relevance",
  });
  const [corpus, setCorpus] = useState<CorpusType>("all");
  const [searchMode, setSearchMode] = useState<SearchModeType>("basic");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<
    (Paper & { aiFinding?: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Pro synthesis + Threads state
  const [synthesis, setSynthesis] = useState("");
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [searchCount, setSearchCount] = useState(1);
  const [followUps, setFollowUps] = useState<FollowUpMessage[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Research Agent state (🤖 Research Agent mode)
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Multi-select for "ask these papers"
  const [selectedPapers, setSelectedPapers] = useState<Map<string, { title: string; author: string; year: number }>>(new Map());

  // Load saved searches + search history
  useEffect(() => {
    try {
      const stored = localStorage.getItem("consensus_saved_searches");
      if (stored) setSavedSearches(JSON.parse(stored));
      const hist = localStorage.getItem("consensus_search_history");
      if (hist) setSearchHistory(JSON.parse(hist));
    } catch {}
  }, []);

  function toggleSaveSearch(q: string) {
    let next: string[];
    if (savedSearches.includes(q)) {
      next = savedSearches.filter((s) => s !== q);
    } else {
      next = [q, ...savedSearches.filter((s) => s !== q)].slice(0, 20);
    }
    setSavedSearches(next);
    try {
      localStorage.setItem("consensus_saved_searches", JSON.stringify(next));
    } catch {}
  }

  const isCurrentSaved = query ? savedSearches.includes(query) : false;

  /** Fetch the Pro synthesis for a query in the background. */
  const fetchSynthesis = useCallback(async (q: string, mode: SearchModeType) => {
    if (mode === "basic") {
      setSynthesis("");
      return;
    }
    setSynthesisLoading(true);
    setSynthesis("");
    try {
      const depth = mode === "deep" ? "deep" : "pro";
      const res = await fetch(
        `/api/pro-search?q=${encodeURIComponent(q)}&depth=${depth}`
      );
      if (!res.ok) throw new Error("synthesis failed");
      const data: SynthesisResult = await res.json();
      setSynthesis(data.answer || "No synthesis available.");
    } catch {
      setSynthesis("Synthesis unavailable — showing papers below.");
    } finally {
      setSynthesisLoading(false);
    }
  }, []);

  /** Fetch the Research Agent result for a query. */
  const fetchAgent = useCallback(async (q: string) => {
    setAgentLoading(true);
    setAgentResult(null);
    try {
      const res = await fetch(
        `/api/research-agent?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error("agent failed");
      const data: AgentResult = await res.json();
      setAgentResult(data);
    } catch {
      setAgentResult(null);
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const doSearch = useCallback(
    async (q: string, offset = 0) => {
      if (!q.trim()) return;
      if (offset === 0) {
        setQuery(q);
        setIsLoading(true);
        setError(null);
        setResults(null);
        // Reset thread state
        setFollowUps([]);
        setSelectedPapers(new Map());
        setSearchCount(1);
        // Add to local history
        const next = [q, ...searchHistory.filter((h) => h !== q)].slice(0, 12);
        setSearchHistory(next);
        try {
          localStorage.setItem("consensus_search_history", JSON.stringify(next));
        } catch {}
        addToHistory(q);
        // Kick off Pro synthesis or Research Agent in parallel (non-blocking)
        if (searchMode === "agent") {
          fetchAgent(q);
        } else {
          fetchSynthesis(q, searchMode);
        }
      } else {
        setIsLoadingMore(true);
      }

      try {
        const limit =
          searchMode === "deep" ? 20 : searchMode === "pro" ? 15 : 10;
        const params = new URLSearchParams({
          q,
          offset: String(offset),
          limit: String(limit),
        });
        if (
          filters.yearRange[0] !== 1900 ||
          filters.yearRange[1] !== 2026
        ) {
          params.set("yearRange", filters.yearRange.join("-"));
        }
        if (filters.openAccessOnly) {
          params.set("openAccess", "true");
        }
        if (filters.studyTypes.length > 0) {
          params.set("studyTypes", filters.studyTypes.join(","));
        }
        if (filters.citationMin > 0) {
          params.set("citationMin", String(filters.citationMin));
        }
        if (filters.sort && filters.sort !== "relevance") {
          params.set("sort", filters.sort);
        }
        if (corpus === "medical") {
          params.set("corpus", "medical");
        }

        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) throw new Error("Search failed");
        const data: SearchResult = await res.json();

        setResults((prev) => {
          const merged =
            offset === 0
              ? data
              : {
                  ...data,
                  papers: [...(prev?.papers || []), ...data.papers],
                };
          return merged;
        });
      } catch (err) {
        setError("Something went wrong. Please try again.");
        if (offset === 0) setResults(null);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filters, corpus, searchMode, searchHistory, fetchSynthesis, fetchAgent]
  );

  const handleCorpusChange = useCallback(
    (newCorpus: CorpusType) => {
      setCorpus(newCorpus);
      if (query) {
        doSearch(query, 0);
      }
    },
    [query, doSearch]
  );

  const handleModeChange = useCallback(
    (newMode: SearchModeType) => {
      setSearchMode(newMode);
      if (query && !results) {
        doSearch(query, 0);
      } else if (query) {
        // Re-fetch synthesis/agent when mode changes mid-thread
        if (newMode === "agent") {
          fetchAgent(query);
        } else {
          fetchSynthesis(query, newMode);
        }
      }
    },
    [query, results, doSearch, fetchSynthesis, fetchAgent]
  );

  // Refetch on filter changes only when there's already a query
  useEffect(() => {
    if (query && results) doSearch(query, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, corpus]);

  /** Build meter verdicts from current papers (retracted papers excluded — consensus.app never uses them in analyses) */
  const verdicts: MeterVerdict[] = useMemo(() => {
    const sourcePapers = searchMode === "agent" && agentResult
      ? agentResult.papers
      : results?.papers;
    if (!sourcePapers) return [];
    return sourcePapers
      .filter((p) => !p.isRetracted)
      .slice(0, 20)
      .map((p) => ({
        paperId: p.paperId,
        title: p.title,
        year: p.year,
        journal: p.journal,
        verdict: classifyVerdict(p.aiFinding),
        keyFinding: p.aiFinding,
      }));
  }, [results, agentResult, searchMode]);

  /** Ask a follow-up question within this thread (Threads). */
  const handleAskFollowUp = useCallback(
    async (question: string) => {
      if (!question.trim() || !query) return;
      setFollowUps((prev) => [...prev, { role: "user", content: question }]);
      setFollowUpLoading(true);

      try {
        // Selected papers become the focused context; otherwise whole thread
        const contextPapers = selectedPapers.size > 0
          ? (results?.papers || []).filter((p) => selectedPapers.has(p.paperId))
          : results?.papers || [];

        const history = followUps.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/follow-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: question,
            threadHistory: history,
            papers: contextPapers,
          }),
        });
        const data = await res.json();
        const answer =
          data.answer ||
          data.error ||
          "Could not generate an answer — try rephrasing.";

        // Merge any sub-search papers into the thread (consensus.app "2 queries")
        if (data.newPapers?.length) {
          setResults((prev) =>
            prev
              ? {
                  ...prev,
                  papers: [
                    ...prev.papers,
                    ...data.newPapers.filter(
                      (np: Paper) => !prev.papers.some((p) => p.paperId === np.paperId)
                    ),
                  ],
                }
              : prev
          );
          setSearchCount((c) => c + 1);
        }

        setFollowUps((prev) => [
          ...prev,
          {
            role: "assistant",
            content: answer,
            papers: data.newPapers || [],
          },
        ]);
      } catch {
        setFollowUps((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Something went wrong. Please try again.",
          },
        ]);
      } finally {
        setFollowUpLoading(false);
        // Clear selection after asking (like consensus.app)
        setSelectedPapers(new Map());
      }
    },
    [followUps, query, results, selectedPapers]
  );

  const toggleSelectPaper = useCallback(
    (paperId: string, title: string, year: number, author: string) => {
      setSelectedPapers((prev) => {
        const next = new Map(prev);
        if (next.has(paperId)) {
          next.delete(paperId);
        } else {
          next.set(paperId, { title, year, author });
        }
        return next;
      });
    },
    []
  );

  const handleLoadMore = useCallback(() => {
    if (results && !isLoadingMore) {
      const nextOffset = results.offset + results.papers.length;
      doSearch(query, nextOffset);
    }
  }, [results, isLoadingMore, query, doSearch]);

  return (
    <div className="h-screen overflow-hidden bg-white flex">
      {/* Left sidebar */}
      <LeftSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        recentSearches={searchHistory}
        onSelectSearch={(q) => doSearch(q, 0)}
        onClearSearches={() => {
          setSearchHistory([]);
          try {
            localStorage.removeItem("consensus_search_history");
          } catch {}
        }}
      />

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Top right sign-up pill */}
        {!query && (
          <div className="absolute top-4 right-4 z-30">
            <button className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-full transition-colors shadow-sm">
              Sign up
            </button>
          </div>
        )}

        <main className="flex-1 flex flex-col min-h-0">
          {!query ? (
            // Landing page (no query yet)
            <div className="flex-1 flex flex-col items-center justify-center px-8 pb-12">
              <div className="flex items-center gap-2 mb-3">
                <Logo size={28} />
                <span className="font-semibold text-[15px] text-slate-800 tracking-tight">
                  Consensus
                </span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-10 text-center">
                Research starts here
              </h1>

              <HeroSearchBar
                onSearch={(q) => doSearch(q, 0)}
                isLoading={isLoading}
                corpus={corpus === "medical" ? "Medical" : "All papers"}
                onCorpusChange={(c) =>
                  handleCorpusChange(c === "Medical" ? "medical" : "all")
                }
                deep={searchMode !== "basic"}
                onDeepChange={(d) =>
                  handleModeChange(d ? "deep" : "basic")
                }
                onAgentChange={(a) =>
                  handleModeChange(a ? "agent" : "basic")
                }
              />

              <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-slate-500">
                The new standard for academic research
              </p>

              {/* Help button */}
              <a
                href="https://help.consensus.app"
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md flex items-center justify-center text-slate-500 transition-all"
                title="Help"
                aria-label="Open support chat"
              >
                <HelpCircle className="w-4 h-4" />
              </a>
            </div>
          ) : (
            // Results page — ChatGPT-style thread layout
            <>
              {/* Compact top bar with new-thread + filter sidebar toggle */}
              <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-white via-white/90 to-transparent h-14 pointer-events-none flex items-center justify-between px-6 lg:px-10">
                <button
                  onClick={() => {
                    setQuery("");
                    setResults(null);
                    setSynthesis("");
                    setFollowUps([]);
                  }}
                  className="pointer-events-auto flex items-center gap-2 text-sm text-slate-500 hover:text-cyan-600 transition-colors"
                  title="New thread"
                >
                  <Logo size={18} />
                  New thread
                </button>
                {isCurrentSaved ? (
                  <button
                    onClick={() => toggleSaveSearch(query)}
                    className="pointer-events-auto text-xs px-3 py-1.5 rounded-full bg-cyan-100 text-cyan-600"
                  >
                    Saved ✓
                  </button>
                ) : (
                  <button
                    onClick={() => toggleSaveSearch(query)}
                    className="pointer-events-auto text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 transition-colors"
                  >
                    Save search
                  </button>
                )}
                <button
                  onClick={() => setFilterOpen((v) => !v)}
                  className={`pointer-events-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${
                    filterOpen
                      ? "bg-cyan-100 text-cyan-600"
                      : "bg-slate-100 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600"
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Filter
                  {filters.studyTypes.length > 0 ||
                  filters.openAccessOnly ||
                  filters.citationMin > 0 ||
                  filters.yearRange[0] !== 1900 ||
                  filters.yearRange[1] !== 2026 ? (
                    <span className="ml-0.5 w-4 h-4 rounded-full bg-cyan-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {(filters.studyTypes.length > 0 ? 1 : 0) +
                        (filters.openAccessOnly ? 1 : 0) +
                        (filters.citationMin > 0 ? 1 : 0) +
                        (filters.yearRange[0] !== 1900 || filters.yearRange[1] !== 2026 ? 1 : 0)}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="flex-1 flex min-h-0">
                {/* Filter sidebar (toggle from Filter button) */}
                {filterOpen && (
                  <div className="w-72 flex-shrink-0 border-r border-slate-100 overflow-y-auto p-4">
                    <FilterSidebar
                      onFilterChange={setFilters}
                      totalResults={results?.total}
                      defaultStudyTypes={filters.studyTypes}
                    />
                  </div>
                )}
                {/* Thread view */}
                <ThreadView
                  query={query}
                  mode={searchMode}
                  searchCount={searchCount}
                  agentResult={agentResult}
                  agentLoading={agentLoading}
                  synthesis={
                    synthesis ||
                    `Found ${results?.total.toLocaleString() || "matching"} papers for your question. ${
                      searchMode !== "basic"
                        ? "AI synthesis loading…"
                        : "Turn on Pro for a synthesized answer."
                    }`
                  }
                  synthesisLoading={synthesisLoading || isLoading}
                  verdicts={verdicts}
                  meterLoading={isLoading}
                  papers={searchMode === "agent" && agentResult ? agentResult.papers : (results?.papers || [])}
                  isLoadingPapers={isLoading}
                  onAskFollowUp={handleAskFollowUp}
                  followUps={followUps}
                  followUpLoading={followUpLoading}
                  onSelectPaper={setSelectedPaper}
                  selectedPaperIds={new Set(selectedPapers.keys())}
                  onToggleSelectPaper={(id, author, year, title) =>
                    toggleSelectPaper(id, title, year, author)
                  }
                />
              </div>

              {/* Load more (inline at bottom of thread scroll) handled inside ThreadView; keep button here for parity */}
              {results && results.papers.length < results.total && (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="hidden"
                />
              )}
            </>
          )}
        </main>

        {/* Paper detail panel */}
        {selectedPaper && (
          <EnhancedPaperDetailPanel
            paper={selectedPaper}
            onClose={() => setSelectedPaper(null)}
          />
        )}

        {/* Floating error toast */}
        {error && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
            <span>{error}</span>
            <button onClick={() => query && doSearch(query, 0)}>
              <RefreshCw className="w-3.5 h-3.5 hover:text-red-900" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
