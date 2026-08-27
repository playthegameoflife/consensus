"use client";

import { Logo } from "./Logo";
import { Plus, Home, PanelLeftClose, Clock, X, BookMarked } from "lucide-react";

interface LeftSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  recentSearches?: string[];
  onSelectSearch?: (q: string) => void;
  onClearSearches?: () => void;
  onOpenLibrary?: () => void;
  libraryCount?: number;
}

export function LeftSidebar({
  collapsed,
  onToggle,
  recentSearches = [],
  onSelectSearch,
  onClearSearches,
  onOpenLibrary,
  libraryCount = 0,
}: LeftSidebarProps) {
  if (collapsed) {
    return (
      <aside className="w-[68px] border-r border-slate-200 bg-white flex flex-col items-center pt-3 flex-shrink-0" data-testid="sidebar-container">
        <Logo size={24} />
        <button
          onClick={onToggle}
          className="mt-3 p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
          title="Open sidebar"
          aria-label="Open sidebar"
          data-testid="open-sidebar-button"
        >
          <PanelLeftClose className="w-4 h-4 rotate-180" />
        </button>
        {onOpenLibrary && (
          <button
            onClick={onOpenLibrary}
            className="mt-3 p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
            title="My Library"
            aria-label="My Library"
          >
            <BookMarked className="w-4 h-4" />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Logo size={24} />
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 space-y-1">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" />
          New Thread
        </button>
        <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
          <Home className="w-3.5 h-3.5" />
          Home
        </button>
        {onOpenLibrary && (
          <button
            onClick={onOpenLibrary}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="My Library"
          >
            <BookMarked className="w-3.5 h-3.5" />
            My Library
            {libraryCount > 0 && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 font-semibold">
                {libraryCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="px-5 py-6 flex-1">
        <h2 className="text-[15px] font-semibold text-slate-900 leading-tight mb-2">
          Research<br />starts here
        </h2>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          Consensus is the AI-powered academic search engine
        </p>
        <p className="text-[13px] text-slate-600 leading-relaxed mt-3">
          Search & analyze 220M+ peer reviewed research papers 📚
        </p>
        <p className="text-[13px] text-slate-600 leading-relaxed mt-3">
          Transparent, reliable, and built to{" "}
          <span className="text-cyan-600 underline decoration-cyan-300 underline-offset-2">
            save you time
          </span>{" "}
          ⏱️
        </p>
      </div>

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Recent
            </h3>
            {onClearSearches && (
              <button
                onClick={onClearSearches}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {recentSearches.slice(0, 8).map((q, i) => (
              <button
                key={i}
                onClick={() => onSelectSearch?.(q)}
                className="w-full text-left px-2 py-1 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded truncate transition-colors"
                title={q}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 space-y-2 border-t border-slate-100">
        <button className="w-full py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-full transition-colors">
          Sign in
        </button>
        <button className="w-full py-2 text-sm font-medium text-white bg-cyan-500 hover:bg-cyan-600 rounded-full transition-colors">
          Sign up
        </button>
      </div>
    </aside>
  );
}
