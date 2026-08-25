import { Paper } from "@/lib/types";
import { getStudyType, formatAuthors } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ExternalLink, Quote, ArrowUpRight } from "lucide-react";

interface PaperCardProps {
  paper: Paper & { aiFinding?: string; consensusScore?: number };
  onSelect?: (paper: Paper) => void;
}

const STUDY_COLORS: Record<string, string> = {
  "Meta-Analysis": "bg-purple-100 text-purple-700",
  "Systematic Review": "bg-indigo-100 text-indigo-700",
  "Clinical Trial": "bg-blue-100 text-blue-700",
  RCT: "bg-blue-100 text-blue-700",
  Review: "bg-slate-100 text-slate-700",
  "Cross-Sectional": "bg-teal-100 text-teal-700",
  Cohort: "bg-green-100 text-green-700",
  "Case-Control": "bg-amber-100 text-amber-700",
  Study: "bg-slate-100 text-slate-600",
};

export function PaperCard({ paper, onSelect }: PaperCardProps) {
  const studyType = getStudyType(paper);
  const colorClass = STUDY_COLORS[studyType] || STUDY_COLORS.Study;
  const doi = paper.doi ? `https://doi.org/${paper.doi}` : undefined;
  const arxivUrl = paper.externalIds?.ArXiv
    ? `https://arxiv.org/abs/${paper.externalIds.ArXiv}`
    : undefined;
  const pdfUrl = paper.openAccessPdf?.url;
  const linkUrl = doi || arxivUrl || pdfUrl;

  return (
    <Card
      className="p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer group"
      onClick={() => onSelect?.(paper)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-semibold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
            {paper.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1">{formatAuthors(paper.authors)}</p>
        </div>

        {/* Consensus dot */}
        {paper.consensusScore !== undefined && (
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
              paper.consensusScore > 0.5
                ? "bg-emerald-500"
                : paper.consensusScore < -0.3
                ? "bg-red-500"
                : "bg-slate-300"
            }`}
            title={`Consensus: ${paper.consensusScore.toFixed(2)}`}
          />
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variant="secondary" className={`text-xs font-medium ${colorClass}`}>
          {studyType}
        </Badge>
        {paper.journal && (
          <span className="text-xs text-slate-500 font-medium">{paper.journal}</span>
        )}
        {paper.year && <span className="text-xs text-slate-400">{paper.year}</span>}
        {paper.citationCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            {paper.citationCount.toLocaleString()}
          </span>
        )}
      </div>

      {/* AI Finding */}
      {paper.aiFinding && (
        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <Quote className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 leading-relaxed font-medium">
              {paper.aiFinding}
            </p>
          </div>
        </div>
      )}

      {/* Abstract snippet */}
      {paper.abstract && (
        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
          {paper.abstract}
        </p>
      )}

      {/* Links */}
      {linkUrl && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          {doi && (
            <a
              href={doi}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              DOI <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
          {arxivUrl && (
            <a
              href={arxivUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              arXiv <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              PDF <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
