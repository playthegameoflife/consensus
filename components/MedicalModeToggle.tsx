"use client";

import { useState, useEffect } from "react";
import { Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "consensus_corpus";

export type Corpus = "all" | "medical";

interface MedicalModeToggleProps {
  onToggle: (corpus: Corpus) => void;
}

export function MedicalModeToggle({ onToggle }: MedicalModeToggleProps) {
  const [corpus, setCorpus] = useState<Corpus>("all");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Corpus | null;
      if (stored === "medical") {
        setCorpus("medical");
        onToggle("medical");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = (value: Corpus) => {
    setCorpus(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    onToggle(value);
  };

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
      <button
        onClick={() => toggle("all")}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
          corpus === "all"
            ? "bg-white text-slate-700 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        All Papers
      </button>
      <button
        onClick={() => toggle("medical")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
          corpus === "medical"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-500 hover:text-blue-600"
        }`}
      >
        <Stethoscope className="w-3.5 h-3.5" />
        Medical
        {corpus === "medical" && (
          <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px] bg-blue-500 text-white border-0">
            ON
          </Badge>
        )}
      </button>
    </div>
  );
}

export function getCorpus(): Corpus {
  if (typeof window === "undefined") return "all";
  try {
    return (localStorage.getItem(STORAGE_KEY) as Corpus) || "all";
  } catch {
    return "all";
  }
}
