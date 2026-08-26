"use client";

import { useState, useCallback, useEffect } from "react";
import { Logo } from "@/components/Logo";
import { LeftSidebar } from "@/components/LeftSidebar";
import { SearchBar } from "@/components/SearchBar";
import { PaperCard } from "@/components/PaperCard";
import { ConsensusMeter } from "@/components/ConsensusMeter";
import { FilterSidebar, Filters } from "@/components/FilterSidebar";
import { EnhancedPaperDetailPanel } from "@/components/EnhancedPaperDetailPanel";
import { SearchHistory, addToHistory } from "@/components/SearchHistory";
import { Corpus as CorpusType } from "@/components/MedicalModeToggle";
import { SearchMode as SearchModeType } from "@/components/SearchModeToggle";
import { HeroSearchBar } from "@/components/HeroSearchBar";
import { Paper } from "@/lib/types";
import { Loader2, Search, ArrowUp, ArrowDown, Minus, Clock, Bookmark, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SearchResult {
  papers: (Paper & { aiFinding?: string; consensusScore?: number })[];
  total: number;
  offset: number;
}

function ConsensusSummary({ papers }: { papers: SearchResult["papers"] }) {
  if (!papers.length) return null;

  // Compute consensus scores client-side if not provided (uses Jaccard
  // similarity over AI findings / abstracts to mirror consensus.app's meter).
  const scores = (
    papers[0].consensusScore !== undefined
      ? papers.map((p) => p.consensusScore!)
      : computeLocalConsensusScores(papers)
  ).filter((s): s is number => s !== undefined && Number.isFinite(s));

  if (!scores.length) return null;

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const agreeing = scores.filter((s) => s > 0.3).length;
  const disagreeing = scores.filter((s) => s < -0.15).length;
  const mixed = scores.length - agreeing - disagreeing;
  const verdict =
    avg > 0.4 ? "Mostly agree" : avg < -0.15 ? "Mostly disagree" : "Mixed evidence";

  return (
    <div className="mb-5 p-4 bg-white rounded-2xl border border-slate-200">
      <div className="flex items-center gap-5">
        <ConsensusMeter score={avg} total={scores.length} />
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <ArrowUp className="w-4 h-4" />
            <span className="font-medium">{agreeing} agreeing</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-500">
            <ArrowDown className="w-4 h-4" />
            <span className="font-medium">{disagreeing} disagreeing</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Minus className="w-4 h-4" />
            <span>{mixed} mixed</span>
          </div>
          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {verdict}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Client-side Jaccard consensus score (cheap, no LLM). */
function computeLocalConsensusScores(
  papers: SearchResult["papers"]
): number[] {
  const texts = papers.map((p) =>
    (p.aiFinding || p.abstract || "").toLowerCase()
  );
  const tokenSets = texts.map((t) => new Set(t.split(/\W+/).filter((w) => w.length > 3)));
  const scores: number[] = [];

  for (let i = 0; i < papers.length; i++) {
    if (!tokenSets[i].size) {
      scores.push(0);
      continue;
    }
    let totalSim = 0;
    let count = 0;
    for (let j = 0; j < papers.length; j++) {
      if (i === j) continue;
      const inter = new Set([...tokenSets[i]].filter((w) => tokenSets[j].has(w)));
      const union = new Set([...tokenSets[i], ...tokenSets[j]]);
      totalSim += union.size > 0 ? inter.size / union.size : 0;
      count++;
    }
    scores.push(count > 0 ? (totalSim - 0.5) * 2 : 0); // remap to ~-1..1
  }
  return scores;
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
  const [selectedPaper, setSelectedPaper] = useState<(Paper & { aiFinding?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

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

  const doSearch = useCallback(
    async (q: string, offset = 0) => {
      if (!q.trim()) return;
      const startTime = Date.now();
      if (offset === 0) {
        setQuery(q);
        setIsLoading(true);
        setSearchTime(null);
        // Add to local history
        const next = [q, ...searchHistory.filter((h) => h !== q)].slice(0, 12);
        setSearchHistory(next);
        try {
          localStorage.setItem("consensus_search_history", JSON.stringify(next));
        } catch {}
        addToHistory(q);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

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

        setSearchTime(Date.now() - startTime);

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
    [filters, corpus, searchMode, searchHistory]
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
      if (query) {
        doSearch(query, 0);
      }
    },
    [query, doSearch]
  );

  useEffect(() => {
    if (query) doSearch(query, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, corpus, searchMode]);

  const handleLoadMore = useCallback(() => {
    if (results && !isLoadingMore) {
      const nextOffset = results.offset + results.papers.length;
      doSearch(query, nextOffset);
    }
  }, [results, isLoadingMore, query, doSearch]);

  return (
    <div className="min-h-screen bg-white flex">
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
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top right sign-up pill */}
        {!query && (
          <div className="absolute top-4 right-4 z-30">
            <button className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-full transition-colors shadow-sm">
              Sign up
            </button>
          </div>
        )}

        {/* Centered content */}
        <main className="flex-1 flex flex-col">
          {!query ? (
            // Landing page (no query yet)
            <div className="flex-1 flex flex-col items-center justify-center px-8 pb-12">
              {/* Logo + heading */}
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
                corpus={corpus === "medical" ? "Medical" : "All research"}
                onCorpusChange={(c) =>
                  handleCorpusChange(c === "Medical" ? "medical" : "all")
                }
                deep={searchMode !== "basic"}
                onDeepChange={(d) =>
                  handleModeChange(d ? "deep" : "basic")
                }
              />

              <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-slate-500">
                The new standard for academic research
              </p>

              {/* Help button */}
              <button
                className="fixed bottom-6 right-6 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md flex items-center justify-center text-slate-500 transition-all"
                title="Help"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            // Results page
            <div className="flex-1 px-8 py-6">
              {results && (
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {results.total.toLocaleString()}
                      </span>{" "}
                      results for{" "}
                      <span className="font-medium text-slate-700">"{query}"</span>
                    </p>
                    {searchTime !== null && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {searchTime < 1000 ? `${searchTime}ms` : `${(searchTime / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-64 flex-shrink-0 space-y-3">
                  <SearchHistory onSearch={(q) => doSearch(q, 0)} />
                  <FilterSidebar
                    onFilterChange={setFilters}
                    totalResults={results?.total}
                  />
                </div>

                {/* Results */}
                <div className="flex-1 min-w-0">
                  {isLoading && (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse"
                        >
                          <div className="h-5 bg-slate-100 rounded w-3/4 mb-3" />
                          <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
                          <div className="h-12 bg-slate-50 rounded mb-3" />
                          <div className="h-3 bg-slate-100 rounded w-5/6" />
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="text-center py-12 text-slate-500">
                      <p>{error}</p>
                      <button
                        onClick={() => query && doSearch(query, 0)}
                        className="mt-2 text-cyan-600 hover:underline text-sm"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {!isLoading && !error && results && results.papers.length === 0 && (
                    <div className="text-center py-16">
                      <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        No papers found
                      </h3>
                      <p className="text-slate-500 text-sm">
                        Try different keywords or remove some filters
                      </p>
                    </div>
                  )}

                  {!isLoading && results && results.papers.length > 0 && (
                    <>
                      <ConsensusSummary papers={results.papers} />

                      <div className="space-y-3">
                        {results.papers.map((paper) => (
                          <PaperCard
                            key={paper.paperId}
                            paper={paper}
                            onSelect={setSelectedPaper}
                          />
                        ))}
                      </div>

                      {results.papers.length < results.total && (
                        <div className="mt-6 flex justify-center">
                          <Button
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            variant="outline"
                            className="px-8"
                          >
                            {isLoadingMore ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Loading...
                              </>
                            ) : (
                              "Load more results"
                            )}
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        {results.papers.length < results.total && !isLoadingMore && (
                          <p className="text-xs text-slate-400">
                            Showing {results.papers.length} of{" "}
                            {results.total.toLocaleString()} results
                          </p>
                        )}
                        {query && (
                          <button
                            onClick={() => toggleSaveSearch(query)}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ml-auto ${
                              isCurrentSaved
                                ? "bg-cyan-100 text-cyan-600"
                                : "bg-slate-100 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600"
                            }`}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isCurrentSaved ? "fill-current" : ""}`} />
                            {isCurrentSaved ? "Saved" : "Save search"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Paper detail panel */}
        {selectedPaper && (
          <EnhancedPaperDetailPanel
            paper={selectedPaper}
            onClose={() => setSelectedPaper(null)}
          />
        )}
      </div>
    </div>
  );
}
