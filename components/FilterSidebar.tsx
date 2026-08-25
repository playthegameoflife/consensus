"use client";

import { useState, useEffect } from "react";
import { ChevronDown, RotateCcw, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortOrder } from "@/lib/types";

interface FilterSidebarProps {
  onFilterChange: (filters: Filters) => void;
  totalResults?: number;
  defaultStudyTypes?: string[];
}

export interface Filters {
  yearRange: [number, number];
  studyTypes: string[];
  openAccessOnly: boolean;
  citationMin: number;
  sort?: SortOrder;
}

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest First" },
  { value: "cited", label: "Most Cited" },
  { value: "consensus", label: "Consensus" },
];

const STUDY_TYPES = [
  "Meta-Analysis",
  "Systematic Review",
  "Clinical Trial",
  "RCT",
  "Review",
  "Cross-Sectional",
  "Cohort",
  "Case-Control",
];

const YEAR_PRESETS = [
  { label: "Any year", value: [1900, 2026] as [number, number] },
  { label: "Last 5 years", value: [2021, 2026] as [number, number] },
  { label: "Last 10 years", value: [2016, 2026] as [number, number] },
  { label: "Last 20 years", value: [2006, 2026] as [number, number] },
];

export function FilterSidebar({ onFilterChange, totalResults, defaultStudyTypes }: FilterSidebarProps) {
  const [filters, setFilters] = useState<Filters>({
    yearRange: [1900, 2026],
    studyTypes: defaultStudyTypes || [],
    openAccessOnly: false,
    citationMin: 0,
    sort: "relevance",
  });

  const [openSections, setOpenSections] = useState({
    studyType: true,
    year: true,
    citations: false,
    access: false,
  });

  // Sync defaultStudyTypes changes (e.g., when Medical Mode is toggled)
  useEffect(() => {
    if (defaultStudyTypes && JSON.stringify(defaultStudyTypes) !== JSON.stringify(filters.studyTypes)) {
      setFilters((prev) => ({ ...prev, studyTypes: defaultStudyTypes }));
    }
  }, [defaultStudyTypes]);

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStudyType = (type: string) => {
    const next = filters.studyTypes.includes(type)
      ? filters.studyTypes.filter((t) => t !== type)
      : [...filters.studyTypes, type];
    update({ studyTypes: next });
  };

  const reset = () => {
    const def: Filters = { yearRange: [1900, 2026], studyTypes: [], openAccessOnly: false, citationMin: 0, sort: "relevance" };
    setFilters(def);
    onFilterChange(def);
  };

  return (
    <div className="w-64 flex-shrink-0">
      <div className="sticky top-4 space-y-3">
        {totalResults !== undefined && (
          <div className="text-sm text-slate-500 font-medium px-1">
            {totalResults.toLocaleString()} results
          </div>
        )}

        {/* Sort Dropdown */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" />
            Sort
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5 cursor-pointer">
              {SORT_OPTIONS.find((o) => o.value === filters.sort)?.label || "Relevance"}
              <ChevronDown className="w-3 h-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => update({ sort: opt.value })}
                  className={`text-xs cursor-pointer ${filters.sort === opt.value ? "text-blue-700 font-medium" : ""}`}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          onClick={reset}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1 px-1"
        >
          <RotateCcw className="w-3 h-3" /> Reset filters
        </button>

        <Card className="p-4 space-y-4">
          {/* Study Type */}
          <div>
            <button
              onClick={() => toggleSection("studyType")}
              className="flex items-center justify-between w-full text-sm font-semibold text-slate-800"
            >
              Study Type
              <ChevronDown
                className={`w-4 h-4 transition-transform ${openSections.studyType ? "rotate-180" : ""}`}
              />
            </button>
            {openSections.studyType && (
              <div className="mt-3 space-y-2">
                {STUDY_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={type}
                      checked={filters.studyTypes.includes(type)}
                      onCheckedChange={() => toggleStudyType(type)}
                    />
                    <Label htmlFor={type} className="text-sm text-slate-600 cursor-pointer">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Year */}
          <div>
            <button
              onClick={() => toggleSection("year")}
              className="flex items-center justify-between w-full text-sm font-semibold text-slate-800"
            >
              Publication Year
              <ChevronDown
                className={`w-4 h-4 transition-transform ${openSections.year ? "rotate-180" : ""}`}
              />
            </button>
            {openSections.year && (
              <div className="mt-3 space-y-2">
                {YEAR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => update({ yearRange: preset.value })}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                      filters.yearRange[0] === preset.value[0] &&
                      filters.yearRange[1] === preset.value[1]
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="pt-2">
                  <Slider
                    value={filters.yearRange}
                    onValueChange={(v) => update({ yearRange: v as [number, number] })}
                    min={1950}
                    max={2026}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{filters.yearRange[0]}</span>
                    <span>{filters.yearRange[1]}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Open Access */}
          <div>
            <button
              onClick={() => toggleSection("access")}
              className="flex items-center justify-between w-full text-sm font-semibold text-slate-800"
            >
              Access
              <ChevronDown
                className={`w-4 h-4 transition-transform ${openSections.access ? "rotate-180" : ""}`}
              />
            </button>
            {openSections.access && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="openAccess"
                    checked={filters.openAccessOnly}
                    onCheckedChange={(v) => update({ openAccessOnly: !!v })}
                  />
                  <Label htmlFor="openAccess" className="text-sm text-slate-600 cursor-pointer">
                    Open Access only
                  </Label>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
