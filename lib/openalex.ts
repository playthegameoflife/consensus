/**
 * OpenAlex API client — consensus.app's data source.
 *
 * Docs: https://developers.openalex.org/api-reference/works
 * No auth required for polite pool. We send a User-Agent per their etiquette:
 *   https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication
 */

const BASE_URL = "https://api.openalex.org";
const MAILTO = process.env.OPENALEX_MAILTO || "hello@consensus-clone.app";

const WORK_FIELDS = [
  "id",
  "doi",
  "title",
  "abstract_inverted_index",
  "publication_year",
  "publication_date",
  "authorships",
  "primary_location",
  "cited_by_count",
  "open_access",
  "type",
  "language",
  "ids",
  "concepts",
  "is_retracted",
].join(",");

interface RawAuthor {
  author?: { id?: string; display_name?: string; orcid?: string };
}

interface RawLocation {
  source?: { display_name?: string } | null;
  license?: { url?: string } | null;
}

interface RawWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  publication_year?: number | null;
  publication_date?: string | null;
  authorships?: RawAuthor[];
  primary_location?: RawLocation | null;
  cited_by_count?: number | null;
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string | null;
  };
  type?: string | null;
  language?: string | null;
  ids?: {
    doi?: string;
    pmid?: string;
    pmcid?: string;
    mag?: string;
    openalex?: string;
  };
  concepts?: Array<{ display_name?: string; score?: number }>;
  is_retracted?: boolean;
}

interface RawSearchResponse {
  meta: { count: number };
  results: RawWork[];
}

/** Reconstruct abstract from inverted index: { word: [pos1, pos2] } → string. */
export function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string | undefined {
  if (!invertedIndex || typeof invertedIndex !== "object") return undefined;
  const positions: Array<{ word: string; pos: number }> = [];
  for (const [word, idxs] of Object.entries(invertedIndex)) {
    if (!Array.isArray(idxs)) continue;
    for (const pos of idxs) {
      if (typeof pos === "number") positions.push({ word, pos });
    }
  }
  if (positions.length === 0) return undefined;
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((p) => p.word).join(" ");
}

/** Map OpenAlex type / source to a consensus.app-style study-type label. */
function inferStudyType(work: RawWork): string {
  // OpenAlex `type` is one of: article, review, book-chapter, dissertation,
  // paratext, dataset, letter, editorial, erratum, book, lib-genre,
  // reference-entry, report, standard, other
  const type = work.type || "";
  const venue = work.primary_location?.source?.display_name || "";
  const title = work.title?.toLowerCase() || "";
  const venueLower = venue.toLowerCase();

  // Heuristics — consensus.app uses similar pattern (RCT, Meta-Analysis, etc.)
  if (title.includes("meta-analysis") || title.includes("meta analysis")) return "Meta-Analysis";
  if (title.includes("systematic review")) return "Systematic Review";
  if (type === "review") return "Review";
  if (
    title.includes("randomized controlled trial") ||
    title.includes("randomised controlled trial") ||
    title.includes(" rct ")
  )
    return "RCT";
  if (title.includes("clinical trial")) return "Clinical Trial";
  if (type === "dissertation") return "Dissertation";
  if (type === "dataset") return "Dataset";
  if (type === "book-chapter" || type === "book") return "Book";
  if (type === "report") return "Report";
  if (type === "editorial") return "Editorial";
  if (type === "letter") return "Letter";

  // Fallback: top concept
  const topConcept = work.concepts?.[0]?.display_name;
  return topConcept || "Study";
}

function mapWork(work: RawWork): import("./types").Paper {
  const paperId = work.id?.startsWith("https://openalex.org/")
    ? work.id.replace("https://openalex.org/", "")
    : work.id;

  const rawDoi =
    work.doi ||
    (work.ids?.doi ? `https://doi.org/${work.ids.doi}` : undefined) ||
    undefined;
  const cleanDoi = rawDoi?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");

  // ArXiv ID can come from external_ids (we'd need that field) or DOI prefix "10.48550/arXiv."
  let arxivId: string | undefined;
  if (cleanDoi?.startsWith("10.48550/arXiv.")) {
    arxivId = cleanDoi.replace("10.48550/arXiv.", "");
  }

  const authors =
    work.authorships?.map((a) => ({
      authorId: a.author?.id?.replace("https://openalex.org/", ""),
      name: a.author?.display_name || "Unknown",
      orcid: a.author?.orcid?.replace("https://orcid.org/", ""),
    })) || [];

  const fieldsOfStudy =
    work.concepts?.slice(0, 3).map((c) => c.display_name).filter(Boolean) as
      | string[]
      | undefined;

  return {
    paperId,
    title: work.title || "Untitled",
    authors,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    year: work.publication_year || 0,
    journal: work.primary_location?.source?.display_name || undefined,
    citationCount: work.cited_by_count || 0,
    doi: cleanDoi,
    externalIds: {
      DOI: cleanDoi,
      ArXiv: arxivId,
      PMID: work.ids?.pmid,
      PMC: work.ids?.pmcid,
      MAG: work.ids?.mag,
    },
    publicationTypes: work.type ? [work.type] : [],
    openAccessPdf: work.open_access?.oa_url
      ? { url: work.open_access.oa_url }
      : undefined,
    openAccessStatus: work.open_access?.oa_status,
    fieldsOfStudy,
    language: work.language || undefined,
    isRetracted: work.is_retracted || false,
  };
}

export async function searchPapers(
  query: string,
  offset = 0,
  limit = 10,
  filters?: import("./types").SearchFilters
): Promise<import("./types").SearchResult> {
  const params = new URLSearchParams({
    search: query,
    page: String(Math.floor(offset / limit) + 1),
    per_page: String(limit),
    select: WORK_FIELDS,
    mailto: MAILTO,
  });

  // Build filter list (OpenAlex takes comma-separated filters)
  const filterParts: string[] = [];

  // Year range — always cap the upper bound at the current year to filter out
  // OpenAlex's known bad-data with future publication_year values.
  const currentYear = new Date().getFullYear();
  if (filters?.yearRange) {
    const [start, end] = filters.yearRange;
    const safeEnd = Math.min(end, currentYear);
    filterParts.push(`publication_year:${start}-${safeEnd}`);
  } else if (filters?.year) {
    const safeYear = Math.min(filters.year, currentYear);
    filterParts.push(`publication_year:${safeYear}`);
  } else {
    filterParts.push(`publication_year:1900-${currentYear}`);
  }

  // Open access
  if (filters?.openAccessOnly) {
    filterParts.push("open_access.is_oa:true");
  }

  // Citation count minimum
  if (filters?.citationCountMin !== undefined) {
    filterParts.push(`cited_by_count:>${filters.citationCountMin}`);
  }

  // Study type → OpenAlex type filter. consensus.app's "RCT / Meta-Analysis /
  // Review" labels don't map 1:1 to OpenAlex `type`; we approximate by combining
  // the OpenAlex type filter with a title search for the canonical phrases.
  if (filters?.publicationType && filters.publicationType.length > 0) {
    const openAlexTypes: string[] = [];
    const titleSearches: string[] = [];
    for (const t of filters.publicationType) {
      switch (t) {
        case "Meta-Analysis":
          titleSearches.push('"meta-analysis" OR "meta analysis"');
          break;
        case "Systematic Review":
          titleSearches.push('"systematic review"');
          break;
        case "RCT":
          titleSearches.push(
            '"randomized controlled trial" OR "randomised controlled trial" OR "randomized clinical trial" OR "randomised clinical trial"'
          );
          break;
        case "Clinical Trial":
          titleSearches.push('"clinical trial"');
          break;
        case "Review":
          openAlexTypes.push("review");
          break;
        case "Cross-Sectional":
          titleSearches.push('"cross-sectional"');
          break;
        case "Cohort":
          titleSearches.push('"cohort study"');
          break;
        case "Case-Control":
          titleSearches.push('"case-control"');
          break;
        default:
          break;
      }
    }
    if (openAlexTypes.length) {
      filterParts.push(`type:${openAlexTypes.join("|")}`);
    }
    if (titleSearches.length) {
      // OpenAlex's title filter uses filter=title.search:<phrase>
      // We OR phrases by using a regex-like syntax with the pipe
      filterParts.push(`title.search:${titleSearches.join("|")}`);
    }
  }

  // Medical Mode — scope to a curated list of top-tier medical journals
  // (matches consensus.app's Medical Mode corpus). OpenAlex sources have
  // stable IDs we can use.
  if (filters?.corpus === "medical") {
    const topMedicalJournals = [
      // New England Journal of Medicine
      "S62468778",
      // The Lancet
      "S49861241",
      // JAMA
      "S172573765",
      // BMJ
      "S4393911389",
      // Annals of Internal Medicine
      "S119722071",
      // Nature Medicine
      "S203256638",
      // Cochrane Database of Systematic Reviews
      "S4210172715",
      // Circulation
      "S116251202",
      // European Heart Journal
      "S181568219",
      // Gastroenterology
      "S143352558",
      // Journal of Clinical Oncology
      "S15137598",
      // Diabetes Care
      "S49878492",
      // The Lancet Oncology / Neurology / Infectious Diseases
      "S116900674",
      "S70053155",
      "S23772524",
    ];
    // Use primary_location.source.id filter for top journals
    filterParts.push(
      `primary_location.source.id:${topMedicalJournals.join("|")}`
    );
  }

  if (filterParts.length) {
    params.set("filter", filterParts.join(","));
  }

  // Sort: relevance (default), newest → publication_year:desc, cited → cited_by_count:desc
  // (publication_year is more reliable than publication_date — OpenAlex has
  // many future-dated publication_date values.)
  if (filters?.sort === "newest") params.set("sort", "publication_year:desc");
  else if (filters?.sort === "cited")
    params.set("sort", "cited_by_count:desc");

  const res = await fetch(`${BASE_URL}/works?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": `consensus-clone (mailto:${MAILTO})`,
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAlex API error ${res.status}: ${errorText}`);
  }

  const data = (await res.json()) as RawSearchResponse;
  return {
    papers: data.results.map(mapWork),
    total: data.meta?.count || 0,
    offset,
  };
}

export async function getPaper(paperId: string): Promise<import("./types").Paper> {
  // Accept both raw OpenAlex ID ("W123") and full URL
  const id = paperId.startsWith("https://openalex.org/")
    ? paperId
    : `https://openalex.org/${paperId}`;

  const params = new URLSearchParams({
    select: WORK_FIELDS,
    mailto: MAILTO,
  });

  const res = await fetch(`${BASE_URL}/works/${id}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": `consensus-clone (mailto:${MAILTO})`,
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) throw new Error(`Failed to fetch paper: ${res.status}`);
  const data = (await res.json()) as RawWork;
  return mapWork(data);
}

/**
 * Autocomplete — OpenAlex has no native autocomplete endpoint. consensus.app
 * uses its own concept index for this; we mimic it by returning top works'
 * titles and concepts whose tokens begin with the query.
 */
export async function autocomplete(query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];

  const params = new URLSearchParams({
    search: query,
    per_page: "5",
    select: "title,concepts",
    mailto: MAILTO,
  });

  try {
    const res = await fetch(`${BASE_URL}/works?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": `consensus-clone (mailto:${MAILTO})`,
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string | null; concepts?: Array<{ display_name?: string }> }>;
    };
    const titles = (data.results || [])
      .map((r) => r.title)
      .filter((t): t is string => !!t && t.length > 0)
      .slice(0, 5);
    return titles;
  } catch {
    return [];
  }
}

/** Fetch works that cite a given work. */
export async function getCitations(
  paperId: string,
  limit = 10
): Promise<Array<{ paperId: string; title: string; year?: number; authors?: Array<{ name: string }> }>> {
  const params = new URLSearchParams({
    filter: `cites:${paperId.startsWith("W") ? `https://openalex.org/${paperId}` : paperId}`,
    per_page: String(limit),
    select: "id,title,publication_year,authorships",
    mailto: MAILTO,
  });

  try {
    const res = await fetch(`${BASE_URL}/works?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": `consensus-clone (mailto:${MAILTO})`,
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: RawWork[] };
    return (data.results || []).map((w) => ({
      paperId: w.id?.replace("https://openalex.org/", "") || "",
      title: w.title || "",
      year: w.publication_year || undefined,
      authors:
        w.authorships?.map((a) => ({
          name: a.author?.display_name || "Unknown",
        })) || [],
    }));
  } catch {
    return [];
  }
}

/** Fetch works referenced by a given work. */
export async function getReferences(
  paperId: string,
  limit = 20
): Promise<Array<{ paperId: string; title: string; year?: number; authors?: Array<{ name: string }> }>> {
  const id = paperId.startsWith("W") ? `https://openalex.org/${paperId}` : paperId;

  try {
    // Fetch the work's referenced_works list
    const params = new URLSearchParams({ select: "referenced_works", mailto: MAILTO });
    const res = await fetch(`${BASE_URL}/works/${id}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": `consensus-clone (mailto:${MAILTO})`,
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { referenced_works?: string[] };
    const refs = (data.referenced_works || []).slice(0, limit);
    if (refs.length === 0) return [];

    // Bulk-fetch their metadata
    const filterValue = refs.map((r) => r.replace("https://openalex.org/", "")).join("|");
    const metaRes = await fetch(
      `${BASE_URL}/works?${new URLSearchParams({
        filter: `openalex_id:${filterValue}`,
        per_page: String(refs.length),
        select: "id,title,publication_year,authorships",
        mailto: MAILTO,
      })}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": `consensus-clone (mailto:${MAILTO})`,
        },
      }
    );
    if (!metaRes.ok) return [];
    const metaData = (await metaRes.json()) as { results?: RawWork[] };
    return (metaData.results || []).map((w) => ({
      paperId: w.id?.replace("https://openalex.org/", "") || "",
      title: w.title || "",
      year: w.publication_year || undefined,
      authors:
        w.authorships?.map((a) => ({
          name: a.author?.display_name || "Unknown",
        })) || [],
    }));
  } catch {
    return [];
  }
}

/** Fetch related papers (OpenAlex "related works"). */
export async function getRelatedPapers(
  paperId: string,
  limit = 10
): Promise<Array<{ paperId: string; title: string; year?: number; authors?: Array<{ name: string }>; fieldsOfStudy?: string[] }>> {
  const id = paperId.startsWith("W") ? `https://openalex.org/${paperId}` : paperId;

  try {
    const params = new URLSearchParams({ select: "related_works", mailto: MAILTO });
    const res = await fetch(`${BASE_URL}/works/${id}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": `consensus-clone (mailto:${MAILTO})`,
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { related_works?: string[] };
    const related = (data.related_works || []).slice(0, limit);
    if (related.length === 0) return [];

    const filterValue = related.map((r) => r.replace("https://openalex.org/", "")).join("|");
    const metaRes = await fetch(
      `${BASE_URL}/works?${new URLSearchParams({
        filter: `openalex_id:${filterValue}`,
        per_page: String(related.length),
        select: "id,title,publication_year,authorships,concepts",
        mailto: MAILTO,
      })}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": `consensus-clone (mailto:${MAILTO})`,
        },
      }
    );
    if (!metaRes.ok) return [];
    const metaData = (await metaRes.json()) as { results?: RawWork[] };
    return (metaData.results || []).map((w) => ({
      paperId: w.id?.replace("https://openalex.org/", "") || "",
      title: w.title || "",
      year: w.publication_year || undefined,
      authors:
        w.authorships?.map((a) => ({
          name: a.author?.display_name || "Unknown",
        })) || [],
      fieldsOfStudy:
        w.concepts?.slice(0, 3).map((c) => c.display_name).filter(Boolean) as string[] | undefined,
    }));
  } catch {
    return [];
  }
}
