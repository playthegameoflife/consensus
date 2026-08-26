"use client";

import { useState, useRef } from "react";
import { Plus, ChevronDown, Sparkles, SlidersHorizontal, ArrowRight, Mic } from "lucide-react";

interface HeroSearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  corpus?: string;
  onCorpusChange?: (corpus: string) => void;
  deep?: boolean;
  onDeepChange?: (deep: boolean) => void;
}

const CORPUS_OPTIONS = ["All research", "Medical"];
const QUICK_ACTIONS = [
  { icon: "📊", label: "Draft a report" },
  { icon: "✦", label: "Find the Consensus" },
  { icon: "🔬", label: "Find studies by method" },
];

export function HeroSearchBar({
  onSearch,
  isLoading = false,
  corpus: corpusProp = "All research",
  onCorpusChange,
  deep: deepProp = false,
  onDeepChange,
}: HeroSearchBarProps) {
  const [query, setQuery] = useState("");
  const [corpusOpen, setCorpusOpen] = useState(false);
  const [corpus, setCorpus] = useState(corpusProp);
  const [deep, setDeep] = useState(deepProp);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!query.trim() || isLoading) return;
    onSearch(query.trim());
  };

  const handleCorpus = (c: string) => {
    setCorpus(c);
    setCorpusOpen(false);
    onCorpusChange?.(c);
  };

  const handleDeep = () => {
    const next = !deep;
    setDeep(next);
    onDeepChange?.(next);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search bar */}
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-slate-300 transition-all">
        <div className="flex items-center gap-1 pl-2 pr-2 py-2">
          {/* Plus button */}
          <button
            type="button"
            className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            title="New thread"
            onClick={() => inputRef.current?.focus()}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Corpus dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCorpusOpen((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="font-medium">{corpus}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${corpusOpen ? "rotate-180" : ""}`} />
            </button>
            {corpusOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                {CORPUS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleCorpus(opt)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                      opt === corpus ? "text-cyan-600 font-medium" : "text-slate-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deep pill */}
          <button
            type="button"
            onClick={handleDeep}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg transition-all ${
              deep
                ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                : "text-slate-700 hover:bg-slate-100 border border-transparent"
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${deep ? "fill-current" : ""}`} />
            <span className="font-medium">Deep</span>
            <span className={`text-xs ${deep ? "text-cyan-500" : "text-slate-400"}`}>✦</span>
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Ask the research..."
            disabled={isLoading}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 px-1"
          />

          {/* Filter button */}
          <button
            type="button"
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Filter results"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="font-medium">Filter</span>
          </button>

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!query.trim() || isLoading}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
            title="Search"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick action pills */}
      <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onSearch(action.label)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-full text-sm text-slate-700 transition-all shadow-sm"
          >
            <span>{action.icon}</span>
            <span className="font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
