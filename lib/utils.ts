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

export function getStudyType(paper: Paper): string {
  const types = paper.publicationTypes || [];
  if (types.includes("Meta-Analysis")) return "Meta-Analysis";
  if (types.includes("SystematicReview")) return "Systematic Review";
  if (types.includes("Review")) return "Review";
  if (types.includes("ClinicalTrial")) return "Clinical Trial";
  if (types.includes("RandomizedControlledTrial")) return "RCT";
  if (types.includes("CrossSectionalStudy")) return "Cross-Sectional";
  if (types.includes("CohortStudy")) return "Cohort";
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
