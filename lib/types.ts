// OpenAlex API types — consensus.app's data source

export interface Author {
  authorId?: string;
  name: string;
  orcid?: string;
}

export interface Paper {
  // Stable OpenAlex Work ID (e.g. "W3013463190")
  paperId: string;
  title: string;
  authors: Author[];
  abstract?: string;
  year: number;
  journal?: string;
  citationCount: number;
  doi?: string;
  // OpenAlex IDs (DOIs, PMIDs, PMCs, ArXiv IDs)
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PMID?: string;
    PMC?: string;
    MAG?: string;
    SemanticScholar?: string;
  };
  // "article" | "book-chapter" | "dissertation" | "paratext" | "dataset" | "review" | "letter" | "editorial" | "erratum" | "book" | "lib-genre" | "reference-entry" | "report" | "standard" | "other"
  publicationTypes?: string[];
  openAccessPdf?: {
    url: string;
  };
  // OpenAlex concept / topic slugs (best-effort)
  fieldsOfStudy?: string[];
  // OpenAlex open access status: "OA" | "closed" | "hybrid" | "bronze" | "green" | "gold"
  openAccessStatus?: string;
  // OpenAlex language code (e.g. "en")
  language?: string;
  // OpenAlex retraction flag — consensus.app shows ⚠️RETRACTED and never uses
  // retracted papers in analyses/summaries
  isRetracted?: boolean;
}

export interface SearchResult {
  papers: Paper[];
  total: number;
  offset: number;
}

export type SortOrder = "relevance" | "newest" | "cited" | "consensus";

export interface SearchFilters {
  year?: number;
  yearRange?: [number, number];
  publicationType?: string[];
  citationCountMin?: number;
  openAccessOnly?: boolean;
  corpus?: "all" | "medical";
  source?: "pubmed" | "arxiv" | "biorxiv" | "medrxiv";
  sort?: SortOrder;
}

export interface ProcessedPaper extends Paper {
  aiFinding?: string;
  studyType?: string;
  consensusScore?: number;
}

export interface PaperClaim {
  paperId: string;
  claim: string;
  supporting: number;
  contradicting: number;
}

export interface PaperWithClaims extends Paper {
  aiFinding?: string;
  claims: string[];
  consensusScore: number;
}
