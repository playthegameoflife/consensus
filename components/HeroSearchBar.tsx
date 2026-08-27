"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  ArrowRight,
  X,
} from "lucide-react";

interface HeroSearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  corpus?: string;
  onCorpusChange?: (corpus: string) => void;
  deep?: boolean;
  onDeepChange?: (deep: boolean) => void;
  onAgentChange?: (agent: boolean) => void;
}

export type QuickAction =
  | { type: "chat-library" }
  | { type: "method" }
  | { type: "comparison" }
  | { type: "research-agent" };

const CORPUS_OPTIONS = ["All papers", "Medical"];

const QUICK_ACTIONS: {
  icon: string;
  label: string;
  action: QuickAction;
  template: string;
}[] = [
  {
    icon: "💬",
    label: "Chat with My Library",
    action: { type: "chat-library" },
    template: "Summarize the key findings from my library about ",
  },
  {
    icon: "🔬",
    label: "Find studies by method",
    action: { type: "method" },
    template: "What are the studies using ",
  },
  {
    icon: "📊",
    label: "Build a comparison table",
    action: { type: "comparison" },
    template: "Create a comparison table of ",
  },
  {
    icon: "🤖",
    label: "Research Agent",
    action: { type: "research-agent" },
    template: "Research: ",
  },
];

export function HeroSearchBar({
  onSearch,
  isLoading = false,
  corpus: corpusProp = "All papers",
  onCorpusChange,
  deep: deepProp = false,
  onDeepChange,
  onAgentChange,
}: HeroSearchBarProps) {
  const [query, setQuery] = useState("");
  const [corpusOpen, setCorpusOpen] = useState(false);
  const [corpus, setCorpus] = useState(corpusProp);
  const [deep, setDeep] = useState(deepProp);
  const [agent, setAgent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state when the parent changes the prop (e.g. quick action
  // sets Deep mode via onDeepChange).
  useEffect(() => {
    setDeep(deepProp);
  }, [deepProp]);
  useEffect(() => {
    setCorpus(corpusProp);
  }, [corpusProp]);

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

  const handleQuickAction = (
    action: QuickAction,
    template: string
  ) => {
    // consensus.app behavior: a quick action pre-fills a prompt template and
    // enables the relevant mode — it does NOT run a literal search for the chip label.
    setQuery(template);
    if (action.type === "research-agent") {
      // Research Agent mode: planning + multi-search + cited report
      setAgent(true);
      setDeep(true);
      onAgentChange?.(true);
    } else {
      setDeep(true);
      onDeepChange?.(true);
    }
    inputRef.current?.focus();
  };

  const canSearch = query.trim().length > 0 && !isLoading;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search box — two-row layout matching consensus.app */}
      <div
        data-testid="search-input-form"
        className="flex flex-col w-full pl-4 pr-2 pb-2 pt-4 space-y-2 rounded-[20px] bg-slate-50/95 backdrop-blur-sm border border-slate-200 focus-within:border-slate-300 shadow-md shadow-slate-200/50 transition-colors"
      >
        {/* Row 1: multiline textarea */}
        <div className="relative flex items-center">
          <textarea
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask the research..."
            maxLength={10000}
            disabled={isLoading}
            rows={1}
            className="block w-full max-h-[200px] resize-none outline-none bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 py-1"
            style={{ overflowY: "auto" }}
          />
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex-shrink-0 w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: controls */}
        <div className="flex justify-between items-center pt-1">
          <div className="flex gap-2 items-center">
            {/* New thread + button */}
            <button
              type="button"
              title="New thread"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-cyan-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Corpus selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCorpusOpen((v) => !v)}
                data-testid="corpus-selector-button"
                className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="font-medium">Corpus</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    corpusOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {corpusOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                  {CORPUS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleCorpus(opt)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                        opt === corpus
                          ? "text-cyan-600 font-medium"
                          : "text-slate-700"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Deep+ switch (dashed border when off, like consensus.app) */}
            <button
              type="button"
              role="switch"
              aria-checked={deep}
              aria-label="Deep"
              disabled={!canSearch}
              onClick={handleDeep}
              className={`group relative flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium border border-dashed transition-colors ${
                deep
                  ? "bg-purple-50 text-purple-700 border-solid border-purple-300"
                  : "text-slate-500 border-slate-300"
              } ${
                canSearch
                  ? "hover:bg-slate-100 cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${deep ? "fill-current" : ""}`}
              />
              <span>Deep+</span>
              <span
                className={`relative inline-flex w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${
                  deep ? "bg-purple-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${
                    deep ? "left-[16px]" : "left-[2px]"
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="flex gap-2 items-center">
            {/* Filter button */}
            <button
              type="button"
              data-testid="filter-button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Filter results"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-medium">Filter</span>
            </button>

            {/* Submit button */}
            <button
              type="button"
              data-testid="search-button"
              aria-label="Submit search"
              onClick={handleSubmit}
              disabled={!canSearch}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick action chips — prefill prompt templates like consensus.app */}
      <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleQuickAction(action.action, action.template)}
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
