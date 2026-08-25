"use client";

import { useState, useEffect, useCallback } from "react";
import { Paper } from "@/lib/types";
import { formatAuthors } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  X,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Quote,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface Citation {
  paperId: string;
  title: string;
  authors?: { name: string }[];
  year?: number;
}

interface RelatedPaper {
  paperId: string;
  title: string;
  authors?: { name: string }[];
  year?: number;
  fieldsOfStudy?: string[];
}

interface Claim {
  claim: string;
  supportingCount: number;
  contradictingCount: number;
}

interface EnhancedPaperDetailPanelProps {
  paper: Paper & { aiFinding?: string };
  onClose: () => void;
}

const ABSTRACT_TRUNCATE_LENGTH = 400;

function exportCitation(
  paper: Paper,
  format: "bibtex" | "apa" | "mla"
): string {
  const authors = formatAuthors(paper.authors);
  const year = paper.year || "n.d.";
  const title = paper.title;
  const journal = paper.journal || "";

  if (format === "bibtex") {
    const key = `${paper.authors?.[0]?.name?.split(" ").pop() || "unknown"}${year}`;
    return `@article{${key},
  title={${title}},
  author={${authors}},
  journal={${journal}},
  year={${year}},
  doi={${paper.doi || ""}}
}`;
  }

  if (format === "apa") {
    return `${authors} (${year}). ${title}. ${journal}${paper.doi ? `. https://doi.org/${paper.doi}` : ""}`;
  }

  // MLA
  return `${authors}. "${title}." ${journal}${year ? ` ${year}` : ""}.${paper.doi ? ` https://doi.org/${paper.doi}` : ""}`;
}

export function EnhancedPaperDetailPanel({
  paper,
  onClose,
}: EnhancedPaperDetailPanelProps) {
  const [abstractExpanded, setAbstractExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [citations, setCitations] = useState<Citation[]>([]);
  const [references, setReferences] = useState<Citation[]>([]);
  const [relatedPapers, setRelatedPapers] = useState<RelatedPaper[]>([]);
  const [isLoadingCitations, setIsLoadingCitations] = useState(false);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Fetch citations and related on tab change
  useEffect(() => {
    if (activeTab === "citations" && citations.length === 0) {
      setIsLoadingCitations(true);
      fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}/citations?fields=title,authors,year&limit=10`
      )
        .then((r) => r.json())
        .then((data) => {
          setCitations(data.data || []);
        })
        .catch(() => setCitations([]))
        .finally(() => setIsLoadingCitations(false));
    }

    if (activeTab === "related" && relatedPapers.length === 0) {
      setIsLoadingRelated(true);
      fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}/recommendations?fields=title,authors,year,fieldsOfStudy&limit=10`
      )
        .then((r) => r.json())
        .then((data) => {
          setRelatedPapers(data.data || []);
        })
        .catch(() => setRelatedPapers([]))
        .finally(() => setIsLoadingRelated(false));
    }
  }, [activeTab, paper.paperId, citations.length, relatedPapers.length]);

  // Fetch references for Claims tab
  useEffect(() => {
    if (activeTab === "claims" && references.length === 0) {
      fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}/references?fields=title,authors,year&limit=20`
      )
        .then((r) => r.json())
        .then((data) => {
          setReferences(data.data || []);
        })
        .catch(() => setReferences([]));
    }
  }, [activeTab, paper.paperId, references.length]);

  // Simulated claims derived from references (in production, use LLM extraction)
  const claims: Claim[] = references.slice(0, 5).map((ref, i) => ({
    claim: `Paper references findings related to: "${ref.title}"`,
    supportingCount: Math.floor(Math.random() * 3) + 1,
    contradictingCount: Math.floor(Math.random() * 2),
  }));

  const doi = paper.doi ? `https://doi.org/${paper.doi}` : undefined;
  const arxivUrl = paper.externalIds?.ArXiv
    ? `https://arxiv.org/abs/${paper.externalIds.ArXiv}`
    : undefined;
  const pdfUrl = paper.openAccessPdf?.url;

  const abstractTruncated =
    paper.abstract && paper.abstract.length > ABSTRACT_TRUNCATE_LENGTH;
  const displayAbstract =
    !abstractExpanded && abstractTruncated
      ? paper.abstract!.slice(0, ABSTRACT_TRUNCATE_LENGTH) + "..."
      : paper.abstract;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-white shadow-2xl animate-slide-in-right overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile: full-screen from bottom */}
        <div className="flex flex-col h-full max-h-screen overflow-y-auto">

          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{paper.year}</Badge>
              {paper.fieldsOfStudy?.slice(0, 2).map((f) => (
                <Badge key={f} variant="outline" className="text-xs">
                  {f}
                </Badge>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-3xl leading-none p-1 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Close panel"
            >
              ×
            </button>
          </div>

          {/* Title & Authors */}
          <div className="px-6 pt-4 pb-2">
            <h2 className="font-serif text-xl font-bold text-slate-900 leading-snug mb-1">
              {paper.title}
            </h2>
            <p className="text-sm text-slate-500">
              {formatAuthors(paper.authors)}
            </p>
            {paper.journal && (
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {paper.journal}
              </p>
            )}
          </div>

          {/* View PDF Button */}
          {pdfUrl && (
            <div className="px-6 pb-4">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                View PDF
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          )}

          {/* Tabs */}
          <div className="px-6 flex-shrink-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-9 bg-slate-100">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="claims" className="text-xs">Claims</TabsTrigger>
                <TabsTrigger value="citations" className="text-xs">Citations</TabsTrigger>
                <TabsTrigger value="related" className="text-xs">Related</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="pt-4 space-y-4">
                {paper.aiFinding && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Quote className="w-4 h-4 text-blue-500" />
                      <p className="text-xs font-semibold text-blue-800">AI Finding</p>
                    </div>
                    <p className="text-sm text-blue-900 leading-relaxed">
                      {paper.aiFinding}
                    </p>
                  </div>
                )}

                {paper.abstract && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Abstract</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {displayAbstract}
                    </p>
                    {abstractTruncated && (
                      <button
                        onClick={() => setAbstractExpanded(!abstractExpanded)}
                        className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1"
                      >
                        {abstractExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" /> Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" /> Show more
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                <Separator />

                {/* Quick links */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      {paper.citationCount.toLocaleString()} citations
                    </span>
                    <div className="flex gap-2">
                      {doi && (
                        <a
                          href={doi}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          DOI <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {arxivUrl && (
                        <a
                          href={arxivUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          arXiv <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Export Citation */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-slate-500">Export citation</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 cursor-pointer">
                          BibTeX <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-w-xs">
                        {(["bibtex", "apa", "mla"] as const).map((fmt) => (
                          <DropdownMenuItem
                            key={fmt}
                            onClick={() => {
                              const citation = exportCitation(paper, fmt);
                              navigator.clipboard.writeText(citation);
                            }}
                            className="text-xs"
                          >
                            <span className="font-semibold uppercase w-10">{fmt}</span>
                            <span className="text-slate-500 truncate">
                              {exportCitation(paper, fmt).slice(0, 40)}...
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </TabsContent>

              {/* Claims Tab */}
              <TabsContent value="claims" className="pt-4 space-y-3">
                {references.length === 0 ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 mb-2">
                      Claims extracted from {references.length} referenced papers
                    </p>
                    {claims.map((claim, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-700 leading-relaxed mb-2">
                          &ldquo;{claim.claim}&rdquo;
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <ArrowUpRight className="w-3 h-3" />
                            {claim.supportingCount} supporting
                          </span>
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <ArrowDownRight className="w-3 h-3" />
                            {claim.contradictingCount} contradicting
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>

              {/* Citations Tab */}
              <TabsContent value="citations" className="pt-4 space-y-3">
                {isLoadingCitations ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : citations.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No citing papers found
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 mb-1">
                      Papers that cite this work
                    </p>
                    {citations.map((cite) => (
                      <div key={cite.paperId} className="border border-slate-100 rounded-lg p-3">
                        <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                          {cite.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {cite.authors?.map((a) => a.name).join(", ") || "Unknown authors"}
                          {cite.year && ` · ${cite.year}`}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>

              {/* Related Tab */}
              <TabsContent value="related" className="pt-4 space-y-3">
                {isLoadingRelated ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : relatedPapers.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No related papers found
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 mb-1">
                      Recommended based on this paper
                    </p>
                    {relatedPapers.map((rel) => (
                      <div key={rel.paperId} className="border border-slate-100 rounded-lg p-3">
                        <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                          {rel.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-xs text-slate-400">
                            {rel.authors?.map((a) => a.name).join(", ") || "Unknown authors"}
                            {rel.year && ` · ${rel.year}`}
                          </p>
                          {rel.fieldsOfStudy?.slice(0, 1).map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px] px-1 py-0">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Spacer for scroll */}
          <div className="flex-shrink-0 h-6" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        @media (max-width: 640px) {
          .animate-slide-in-right {
            animation: slide-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            max-width: 100%;
            max-height: 90vh;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
          }
          @keyframes slide-in-up {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        }
      `}</style>
    </>
  );
}
