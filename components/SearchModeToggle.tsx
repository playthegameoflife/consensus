"use client";

import { useState, useEffect } from "react";
import { Sparkles, BookOpen, Zap } from "lucide-react";

export type SearchMode = "basic" | "pro" | "deep";

interface SearchModeToggleProps {
  onModeChange: (mode: SearchMode) => void;
  initialMode?: SearchMode;
}

export function SearchModeToggle({ onModeChange, initialMode = "basic" }: SearchModeToggleProps) {
  const [mode, setMode] = useState<SearchMode>(initialMode);

  useEffect(() => {
    const saved = localStorage.getItem("consensus_search_mode") as SearchMode | null;
    if (saved) {
      setMode(saved);
      onModeChange(saved);
    }
  }, [onModeChange]);

  const select = (m: SearchMode) => {
    setMode(m);
    localStorage.setItem("consensus_search_mode", m);
    onModeChange(m);
  };

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
      <ModeButton
        active={mode === "basic"}
        onClick={() => select("basic")}
        icon={<BookOpen className="w-3.5 h-3.5" />}
        label="Paper Search"
        description="Fast results"
      />
      <ModeButton
        active={mode === "pro"}
        onClick={() => select("pro")}
        icon={<Zap className="w-3.5 h-3.5" />}
        label="Pro"
        description="AI review (20 papers)"
        badge="25/mo"
      />
      <ModeButton
        active={mode === "deep"}
        onClick={() => select("deep")}
        icon={<Sparkles className="w-3.5 h-3.5" />}
        label="Deep"
        description="Full analysis (50 papers)"
        badge="3/mo"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  description,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <span className={active ? "text-blue-600" : "text-slate-400"}>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          active ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-500"
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
