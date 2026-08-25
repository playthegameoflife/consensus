"use client";

import { useState, useEffect } from "react";
import { History, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

const STORAGE_KEY = "consensus_history";
const MAX_HISTORY = 20;

interface SearchHistoryProps {
  onSearch: (query: string) => void;
}

export function SearchHistory({ onSearch }: SearchHistoryProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleSearch = (query: string) => {
    onSearch(query);
  };

  if (history.length === 0) {
    return (
      <div className="text-xs text-slate-400 px-1 py-2">
        <History className="w-3 h-3 inline mr-1" />
        No recent searches
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          Recent
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={clearHistory}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Clear
        </button>
      </div>

      {isOpen && (
        <div className="flex flex-wrap gap-1.5">
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => handleSearch(item)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-xs text-slate-600 rounded-full transition-colors max-w-[180px] truncate"
            >
              <Search className="w-3 h-3 flex-shrink-0 opacity-60" />
              <span className="truncate">{item}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Export a function to add to history (call this from SearchBar or page)
export function addToHistory(query: string) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let current: string[] = stored ? JSON.parse(stored) : [];

    // De-dupe and add to front
    current = [query, ...current.filter((q) => q !== query)].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}
