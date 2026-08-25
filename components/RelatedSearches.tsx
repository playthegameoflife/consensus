"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";

interface RelatedSearchesProps {
  query: string;
  papers: { title: string; abstract?: string }[];
  onSearch: (q: string) => void;
}

// Simple keyword-based follow-up query generator
function generateRelatedQueries(query: string, papers: { title: string; abstract?: string }[]): string[] {
  // Extract meaningful words from the query
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "can", "have", "has", "had", "what", "which", "who", "whom", "this",
    "that", "these", "those", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "or", "and", "but", "if", "than", "so", "no", "not",
    "effect", "effects", "impact", "influence", "role", "use", "using", "based",
  ]);

  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Extract keywords from paper titles and abstracts
  const allText = papers
    .slice(0, 5)
    .map((p) => `${p.title} ${p.abstract || ""}`)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const titleWords = new Set(
    allText
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.has(w) && queryWords.every((qw) => !w.includes(qw)))
  );

  const suggestions: string[] = [];

  // 1. Add "mechanism of" variant
  if (queryWords.length >= 1) {
    suggestions.push(`${queryWords[0]} mechanism of action`);
  }

  // 2. Add "systematic review" variant
  if (queryWords.length >= 1) {
    suggestions.push(`systematic review ${query}`);
  }

  // 3. Add a "recent" variant
  if (queryWords.length >= 1) {
    suggestions.push(`recent ${queryWords.slice(0, 2).join(" ")} research 2024`);
  }

  // 4. Add meta-analysis variant
  if (queryWords.length >= 1) {
    suggestions.push(`meta-analysis ${queryWords[0]} efficacy`);
  }

  // 5. Add a keyword from papers
  const topKeyword = Array.from(titleWords).sort((a, b) => b.length - a.length)[0];
  if (topKeyword && topKeyword.length > 4) {
    suggestions.push(`${topKeyword} ${queryWords[queryWords.length - 1] || queryWords[0]}`);
  }

  // Deduplicate and limit
  return [...new Set(suggestions)].slice(0, 5);
}

export function RelatedSearches({ query, papers, onSearch }: RelatedSearchesProps) {
  const suggestions = useMemo(() => generateRelatedQueries(query, papers), [query, papers]);

  if (!suggestions.length) return null;

  return (
    <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Related Searches</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSearch(s)}
            className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition-colors text-left"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
