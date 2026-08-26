import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Paper, ProcessedPaper } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SearchResponse {
  papers: ProcessedPaper[];
  total: number;
  offset: number;
}

export async function searchPapers(
  query: string,
  offset = 0,
  limit = 10,
  yearRange?: string,
  openAccess = false
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, offset: String(offset), limit: String(limit) });
  if (yearRange) params.set("yearRange", yearRange);
  if (openAccess) params.set("openAccess", "true");

  const res = await fetch(`/api/search?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

/** Map OpenAlex publication type + content heuristics to consensus.app study-type label. */
export function getStudyType(paper: Paper): string {
  const types = paper.publicationTypes || [];
  const title = paper.title || "";
  const titleLower = title.toLowerCase();

  if (titleLower.includes("meta-analysis") || titleLower.includes("meta analysis"))
    return "Meta-Analysis";
  if (titleLower.includes("systematic review")) return "Systematic Review";
  if (types.includes("review") || titleLower.startsWith("review:"))
    return "Review";
  if (
    titleLower.includes("randomized controlled trial") ||
    titleLower.includes("randomised controlled trial") ||
    /\brct\b/.test(titleLower)
  )
    return "RCT";
  if (titleLower.includes("clinical trial")) return "Clinical Trial";
  if (types.includes("dissertation")) return "Dissertation";
  if (types.includes("dataset")) return "Dataset";
  if (types.includes("book") || types.includes("book-chapter")) return "Book";
  if (types.includes("report")) return "Report";
  if (types.includes("editorial")) return "Editorial";
  if (types.includes("letter")) return "Letter";

  return paper.fieldsOfStudy?.[0] || "Study";
}

export function getConsensusColor(score: number): "agree" | "disagree" | "mixed" {
  if (score >= 0.6) return "agree";
  if (score <= -0.3) return "disagree";
  return "mixed";
}

export function formatAuthors(authors: Paper["authors"]): string {
  if (!authors?.length) return "Unknown authors";
  if (authors.length <= 3) return authors.map((a) => a.name).join(", ");
  return `${authors[0].name} et al.`;
}
