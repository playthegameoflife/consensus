/**
 * Semantic Scholar API client.
 * https://api.semanticscholar.org/
 *
 * Free tier: 1000 requests/day, 10 requests/second.
 * No API key required for basic use (with rate limiting).
 */

const BASE_URL = "https://api.semanticscholar.org/graph/v1";
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;

// Fields to request per paper (avoid over-fetching)
const PAPER_FIELDS = [
  "paperId",
  "title",
  "abstract",
  "year",
  "authors",
  "venue",
  "citationCount",
  "openAccessPdf",
  "externalIds",
  "publicationTypes",
  "s2FieldsOfStudy",
].join(",");

export interface SSExternalIds {
  DOI?: string;
  PubMed?: string;
  PubMedCentral?: string;
  ArXiv?: string;
  MAG?: number;
  ACL?: string;
  PMID?: string;
}

export interface SSPaper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  authors?: Array<{ authorId?: string; name: string }>;
  venue?: string;
  citationCount?: number;
  openAccessPdf?: { url: string } | null;
  externalIds?: SSExternalIds;
  publicationTypes?: string[];
  s2FieldsOfStudy?: Array<{ category: string; subfield?: string }>;
}

export interface SSSearchResponse {
  total: number;
  papers: SSPaper[];
}

/** Map S2 paperId to our internal ID format. */
export function s2ToPaperId(s2Id: string): string {
  return `s2:${s2Id}`;
}

/** Map our internal ID back to S2 ID if applicable. */
export function paperIdToS2(paperId: string): string | null {
  return paperId.startsWith("s2:") ? paperId.slice(3) : null;
}

/** Search Semantic Scholar for papers matching a query. */
export async function searchSemanticScholar(
  query: string,
  offset = 0,
  limit = 10
): Promise<{ papers: import("./types").Paper[]; total: number }> {
  const params = new URLSearchParams({
    query,
    offset: String(offset),
    limit: String(limit),
    fields: PAPER_FIELDS,
    "year[year_offset]": "0",
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  const res = await fetch(`${BASE_URL}/paper/search?${params}`, {
    headers,
    next: { revalidate: 0 }, // Don't cache search results
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Semantic Scholar API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: {
    total: number;
    data: SSPaper[];
  } = await res.json();

  const papers: import("./types").Paper[] = data.data.map(mapSSPaper);

  return { papers, total: data.total };
}

/** Get a single paper by S2 ID. */
export async function getPaperByS2Id(
  s2Id: string
): Promise<import("./types").Paper | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(
    `${BASE_URL}/paper/${s2Id}?fields=${PAPER_FIELDS}`,
    { headers }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S2 paper fetch error ${res.status}`);

  const paper: SSPaper = await res.json();
  return mapSSPaper(paper);
}

/** Get multiple papers by their S2 IDs (batch). */
export async function getPapersByS2Ids(
  s2Ids: string[]
): Promise<import("./types").Paper[]> {
  if (s2Ids.length === 0) return [];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(`${BASE_URL}/paper/batch?fields=${PAPER_FIELDS}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ids: s2Ids }),
  });

  if (!res.ok) throw new Error(`S2 batch fetch error ${res.status}`);
  const papers: SSPaper[] = await res.json();
  return papers.map(mapSSPaper);
}

/** Map a Semantic Scholar paper to our internal Paper type. */
function mapSSPaper(ss: SSPaper): import("./types").Paper {
  const s2Id = ss.paperId;
  const magId = ss.externalIds?.MAG?.toString();

  return {
    paperId: s2ToPaperId(s2Id),
    title: ss.title || "Untitled",
    abstract: ss.abstract || undefined,
    year: ss.year || new Date().getFullYear(),
    authors: (ss.authors || []).map((a) => ({
      authorId: a.authorId || `anon-${Math.random().toString(36).slice(2)}`,
      name: a.name,
    })),
    journal: ss.venue || undefined,
    citationCount: ss.citationCount || 0,
    externalIds: {
      DOI: ss.externalIds?.DOI,
      PMID: ss.externalIds?.PubMed || ss.externalIds?.PMID,
      ArXiv: ss.externalIds?.ArXiv,
      PMC: ss.externalIds?.PubMedCentral,
      MAG: magId,
      SemanticScholar: s2Id,
    },
    publicationTypes: ss.publicationTypes || [],
    openAccessPdf: ss.openAccessPdf
      ? { url: ss.openAccessPdf.url }
      : undefined,
    fieldsOfStudy: ss.s2FieldsOfStudy?.map((f) => f.category) || [],
    language: "en", // S2 papers are mostly English
    isRetracted: false,
  };
}
