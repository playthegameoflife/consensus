/**
 * Unified search — merges results from OpenAlex and Semantic Scholar.
 * Deduplicates by DOI, falling back to title similarity.
 *
 * Order: fetch both in parallel → normalize to Paper[] → merge → dedupe → sort by citationCount.
 */

import { Paper, SearchResult } from "./types";
import { searchPapers as searchOpenAlex } from "./openalex";
import { searchSemanticScholar } from "./semantic-scholar";

interface SourceResult {
  papers: Paper[];
  total: number;
  source: "openalex" | "semantic-scholar";
}

/**
 * Normalize a paper ID to a dedupe key.
 * Prefers DOI (most reliable), then tries externalIds.SemanticScholar, then OpenAlex ID.
 */
function dedupeKey(paper: Paper): string {
  if (paper.externalIds?.DOI) return `doi:${paper.externalIds.DOI.toLowerCase()}`;
  if (paper.externalIds?.SemanticScholar) return `s2:${paper.externalIds.SemanticScholar}`;
  return `oa:${paper.paperId}`;
}

/**
 * Title similarity for fuzzy dedupe (when no DOI match).
 * Strip articles, normalize whitespace, compare first 80 chars.
 */
function titleKey(paper: Paper): string {
  const t = paper.title
    .toLowerCase()
    .replace(/^(the|a|an|of|on|for|in|with|to|and|or|is|are|was|were)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return t;
}

/** Merge two paper lists, deduplicating by DOI/title. */
function mergePapers(oa: Paper[], s2: Paper[]): Paper[] {
  const seen = new Map<string, Paper>();

  // Add OpenAlex papers first (they tend to have better abstract text)
  for (const p of oa) {
    const key = dedupeKey(p);
    if (key && !seen.has(key)) {
      seen.set(key, p);
    } else if (!key) {
      const tk = titleKey(p);
      seen.set(`title:${tk}`, p);
    }
  }

  // Add Semantic Scholar papers — prefer S2 if it has better abstract
  for (const p of s2) {
    const key = dedupeKey(p);
    if (key && !seen.has(key)) {
      seen.set(key, p);
    } else if (!key) {
      const tk = titleKey(p);
      const existing = seen.get(`title:${tk}`);
      if (!existing) {
        seen.set(`title:${tk}`, p);
      } else if (p.abstract && p.abstract.length > (existing.abstract?.length || 0)) {
        // S2 has better abstract — replace
        seen.set(`title:${tk}`, p);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Unified search across OpenAlex and Semantic Scholar.
 * Parallel fetches, merged + deduplicated results.
 */
export async function unifiedSearch(
  query: string,
  offset = 0,
  limit = 10,
  filters?: import("./types").SearchFilters
): Promise<SearchResult> {
  // Fetch both sources in parallel
  const [oaResult, s2Result] = await Promise.allSettled([
    searchOpenAlex(query, offset, limit * 3, filters), // Fetch extra OA to account for dupes
    searchSemanticScholar(query, offset, limit * 3),
  ]);

  const oaPapers: Paper[] =
    oaResult.status === "fulfilled" ? oaResult.value.papers : [];
  const s2Papers: Paper[] =
    s2Result.status === "fulfilled" ? s2Result.value.papers : [];

  const oaTotal =
    oaResult.status === "fulfilled" ? oaResult.value.total : 0;
  const s2Total =
    s2Result.status === "fulfilled" ? s2Result.value.total : 0;

  // Merge and dedupe
  const merged = mergePapers(oaPapers, s2Papers);

  // Sort by citation count (descending) — same as consensus.app
  merged.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));

  // Apply pagination
  const papers = merged.slice(offset, offset + limit);

  return {
    papers,
    total: Math.max(oaTotal, s2Total),
    offset,
  };
}
