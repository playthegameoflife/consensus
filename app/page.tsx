"use client";

import { useState, useCallback, useEffect } from "react";
import { SearchBar } from "@/components/SearchBar";
import { PaperCard } from "@/components/PaperCard";
import { ConsensusMeter } from "@/components/ConsensusMeter";
import { FilterSidebar, Filters } from "@/components/FilterSidebar";
import { EnhancedPaperDetailPanel } from "@/components/EnhancedPaperDetailPanel";
import { SearchHistory, addToHistory } from "@/components/SearchHistory";
import { MedicalModeToggle, Corpus } from "@/components/MedicalModeToggle";
import { Paper } from "@/lib/types";
import { Loader2, Search, ArrowUp, ArrowDown, Minus, FileQuestion, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultsTimeline } from "@/components/ResultsTimeline";
import { RelatedSearches } from "@/components/RelatedSearches";

interface SearchResult {
  papers: (Paper & { aiFinding?: string; consensusScore?: number })[];
  total: number;
  offset: number;
}

function ConsensusSummary({ papers }: { papers: SearchResult["papers"] }) {
  if (!papers.length) return null;

  const scores = papers
    .map((p) => p.consensusScore)
    .filter((s): s is number => s !== undefined);

  if (!scores.length) return null;

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const agreeing = scores.filter((s) => s > 0.5).length;
  const disagreeing = scores.filter((s) => s < -0.3).length;

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
            <span>{scores.length - agreeing - disagreeing} mixed</span>
          </div>
        </div>
      </div>
    </div>
  );
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
  });
  const [corpus, setCorpus] = useState<Corpus>("all");
  const [selectedPaper, setSelectedPaper] = useState<(Paper & { aiFinding?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);

  // Medical mode default study types
  const medicalDefaultStudyTypes = ["Clinical Trial", "RCT", "Systematic Review", "Meta-Analysis"];

  const doSearch = useCallback(
    async (q: string, offset = 0) => {
      if (!q.trim()) return;
      const startTime = Date.now();
      if (offset === 0) {
        setQuery(q);
        setIsLoading(true);
        setSearchTime(null);
        // Add to search history
        addToHistory(q);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          q,
          offset: String(offset),
          limit: "10",
        });
        if (filters.yearRange[0] !== 1900 || filters.yearRange[1] !== 2026) {
          params.set("yearRange", filters.yearRange.join("-"));
        }
        if (filters.openAccessOnly) {
          params.set("openAccess", "true");
        }
        if (corpus === "medical") {
          params.set("corpus", "medical");
        }
        if (filters.sort && filters.sort !== "relevance") {
          params.set("sort", filters.sort);
        }

        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) throw new Error("Search failed");
        const data: SearchResult = await res.json();

        setSearchTime(Date.now() - startTime);

        setResults((prev) => {
          if (offset === 0) {
            return data;
          }
          return {
            ...data,
            papers: [...(prev?.papers || []), ...data.papers],
          };
        });
      } catch (err) {
        setError("Something went wrong. Please try again.");
        if (offset === 0) setResults(null);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filters, corpus]
  );

  const handleLoadMore = useCallback(() => {
    if (results && !isLoadingMore) {
      const nextOffset = results.offset + results.papers.length;
      doSearch(query, nextOffset);
    }
  }, [results, isLoadingMore, query, doSearch]);

  const handleCorpusChange = useCallback((newCorpus: Corpus) => {
    setCorpus(newCorpus);
    if (query) {
      doSearch(query, 0);
    }
  }, [query, doSearch]);

  useEffect(() => {
    if (query) doSearch(query, 0);
  }, [filters, corpus]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-[4.5rem] flex items-center gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <FileQuestion className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-semibold text-[17px] text-slate-800 tracking-tight">Consensus</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-3xl mx-auto">
            <SearchBar onSearch={(q) => doSearch(q, 0)} isLoading={isLoading} />
          </div>

          {/* Corpus toggle */}
          <div className="flex-shrink-0">
            <MedicalModeToggle onToggle={handleCorpusChange} />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {query && results && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-800">{results.total.toLocaleString()}</span> results for{" "}
                <span className="font-medium text-slate-700">"{query}"</span>
              </p>
              {searchTime !== null && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {searchTime < 1000 ? `${searchTime}ms` : `${(searchTime / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
            {corpus === "medical" && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                Medical Mode
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 space-y-3">
            <SearchHistory onSearch={(q) => doSearch(q, 0)} />
            <FilterSidebar
              onFilterChange={setFilters}
              totalResults={results?.total}
              defaultStudyTypes={corpus === "medical" ? medicalDefaultStudyTypes : []}
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
                  className="mt-2 text-blue-600 hover:underline text-sm"
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
                <RelatedSearches
                  query={query}
                  papers={results.papers}
                  onSearch={(q) => doSearch(q, 0)}
                />
                <ResultsTimeline
                  papers={results.papers}
                  onSelect={setSelectedPaper}
                  selectedPaperId={selectedPaper?.paperId}
                />
                <div className="space-y-3">
                  {results.papers.map((paper) => (
                    <PaperCard
                      key={paper.paperId}
                      paper={paper}
                      onSelect={setSelectedPaper}
                    />
                  ))}
                </div>

                {/* Load more button */}
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
                        `Load more results`
                      )}
                    </Button>
                  </div>
                )}

                {isLoadingMore && (
                  <div className="space-y-3 mt-3">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={`more-${i}`}
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

                {/* Showing count */}
                {results.papers.length < results.total && !isLoadingMore && (
                  <p className="text-center text-xs text-slate-400 mt-3">
                    Showing {results.papers.length} of {results.total.toLocaleString()} results
                  </p>
                )}
              </>
            )}

            {!isLoading && !query && !results && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  Ask anything. Get research answers.
                </h2>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Type a question above to search across 200M+ academic papers and see the consensus of the research.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Enhanced paper detail panel */}
      {selectedPaper && (
        <EnhancedPaperDetailPanel
          paper={selectedPaper}
          onClose={() => setSelectedPaper(null)}
        />
      )}
    </div>
  );
}
