import { Paper, SearchResult, SearchFilters, SortOrder } from "./types";

const BASE_URL = "https://api.semanticscholar.org/graph/v1";

const PAPER_FIELDS = [
  "paperId",
  "title",
  "authors",
  "abstract",
  "year",
  "journal",
  "citationCount",
  "doi",
  "externalIds",
  "publicationTypes",
  "openAccessPdf",
  "fieldsOfStudy",
].join(",");

const SEMANTIC_SCHOLAR_API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;

export async function searchPapers(
  query: string,
  offset = 0,
  limit = 10,
  filters?: SearchFilters
): Promise<SearchResult> {
  const params = new URLSearchParams({
    query,
    offset: String(offset),
    limit: String(limit),
    fields: PAPER_FIELDS,
  });

  if (filters?.year) {
    params.set("year", String(filters.year));
  }
  if (filters?.yearRange) {
    params.set("year", `${filters.yearRange[0]}-${filters.yearRange[1]}`);
  }
  if (filters?.openAccessOnly) {
    params.set("openAccessPdf", "true");
  }
  if (filters?.corpus === "medical") {
    // Filter to medical-related fields of study
    const medicalFields = "Medicine,Biochemistry,Neuroscience,Psychology,Pharmacology,Cell Biology,Genetics,Molecular Biology";
    params.set("fieldsOfStudy", medicalFields);
  }
  if (filters?.sort) {
    const sortMap: Record<SortOrder, string> = {
      relevance: "relevance",
      newest: "year:desc",
      cited: "citationCount:desc",
      consensus: "citationCount:desc", // consensus uses citation count as proxy before full scoring
    };
    params.set("sort", sortMap[filters.sort]);
  }

  const headers: HeadersInit = { Accept: "application/json" };
  if (SEMANTIC_SCHOLAR_API_KEY) {
    headers["x-api-key"] = SEMANTIC_SCHOLAR_API_KEY;
  }

  const res = await fetch(`${BASE_URL}/paper/search?${params}`, {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Semantic Scholar API error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  return {
    papers: data.papers as Paper[],
    total: data.total as number,
    offset: data.offset as number,
  };
}

export async function getPaper(paperId: string): Promise<Paper> {
  const res = await fetch(
    `${BASE_URL}/paper/${paperId}?fields=${PAPER_FIELDS}`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch paper: ${res.status}`);
  }

  return res.json();
}

export async function autocomplete(query: string): Promise<string[]> {
  const params = new URLSearchParams({ query });
  const res = await fetch(
    `${BASE_URL}/paper/suggest?${params}`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.suggestions || []).slice(0, 5);
}
