'use client'

import { useState, useEffect } from 'react'
import { History, X, Search, Bookmark, BookmarkCheck } from 'lucide-react'
import { ChevronDown } from 'lucide-react'

const HISTORY_KEY = 'consensus_history'
const SAVED_KEY = 'consensus_saved_searches'
const MAX_HISTORY = 20
const MAX_SAVED = 20

interface SearchHistoryProps {
  onSearch: (query: string) => void
}

export function SearchHistory({ onSearch }: SearchHistoryProps) {
  const [history, setHistory] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [historyOpen, setHistoryOpen] = useState(true)
  const [savedOpen, setSavedOpen] = useState(true)

  useEffect(() => {
    try {
      const h = localStorage.getItem(HISTORY_KEY)
      const s = localStorage.getItem(SAVED_KEY)
      if (h) setHistory(JSON.parse(h))
      if (s) setSaved(JSON.parse(s))
    } catch {}
  }, [])

  function clearHistory() {
    setHistory([])
    try { localStorage.removeItem(HISTORY_KEY) } catch {}
  }

  function toggleSaved(query: string) {
    let next: string[]
    if (saved.includes(query)) {
      next = saved.filter(q => q !== query)
    } else {
      next = [query, ...saved.filter(q => q !== query)].slice(0, MAX_SAVED)
    }
    setSaved(next)
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch {}
  }

  function handleSearch(query: string) {
    onSearch(query)
  }

  const hasHistory = history.length > 0
  const hasSaved = saved.length > 0

  if (!hasHistory && !hasSaved) {
    return (
      <div className="text-xs text-slate-400 px-1 py-2">
        <History className="w-3 h-3 inline mr-1" />
        No searches yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Saved Searches */}
      {hasSaved && (
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <button
              onClick={() => setSavedOpen(!savedOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-500" />
              Saved
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${savedOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {savedOpen && (
            <div className="space-y-0.5">
              {saved.map((item, i) => (
                <div key={i} className="flex items-center gap-1 group">
                  <button
                    onClick={() => handleSearch(item)}
                    className="flex-1 flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-xs text-slate-600 rounded-lg transition-colors truncate"
                  >
                    <Search className="w-3 h-3 flex-shrink-0 opacity-50" />
                    <span className="truncate">{item}</span>
                  </button>
                  <button
                    onClick={() => toggleSaved(item)}
                    className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                    title="Remove from saved"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Searches */}
      {hasHistory && (
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              Recent
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={clearHistory}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear
            </button>
          </div>
          {historyOpen && (
            <div className="space-y-0.5">
              {history.map((item, i) => (
                <div key={i} className="flex items-center gap-1 group">
                  <button
                    onClick={() => handleSearch(item)}
                    className="flex-1 flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-xs text-slate-600 rounded-lg transition-colors truncate"
                  >
                    <Search className="w-3 h-3 flex-shrink-0 opacity-50" />
                    <span className="truncate">{item}</span>
                  </button>
                  <button
                    onClick={() => toggleSaved(item)}
                    className="p-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all"
                    title="Save this search"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function addToHistory(query: string) {
  try {
    const stored = localStorage.getItem(HISTORY_KEY)
    let current: string[] = stored ? JSON.parse(stored) : []
    current = [query, ...current.filter(q => q !== query)].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(current))
  } catch {}
}
