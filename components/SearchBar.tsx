"use client";

import { useState, useCallback, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  initialQuery?: string;
}

export function SearchBar({ onSearch, isLoading, initialQuery = "" }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      setShowSuggestions(false);
      onSearch(q.trim());
    },
    [onSearch]
  );

  const handleInputChange = useCallback(async (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch(query);
    if (e.key === "Escape") {
      setShowSuggestions(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center bg-white rounded-full border border-slate-200/80 transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <Search className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Ask a research question..."
          className="pl-11 pr-12 h-14 text-[15px] border-0 shadow-none bg-transparent focus-visible:ring-0 focus-visible:outline-none placeholder:text-slate-400"
          disabled={isLoading}
        />
        {isLoading && (
          <Loader2 className="absolute right-4 w-4 h-4 text-slate-400 animate-spin" />
        )}
        {query && !isLoading && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
            }}
            className="absolute right-4 p-1 rounded-full hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden z-50">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => {
                setQuery(s);
                setShowSuggestions(false);
                handleSearch(s);
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
