// Semantic Scholar API types
export interface Paper {
  paperId: string;
  title: string;
  authors: Author[];
  abstract?: string;
  year: number;
  journal?: string;
  citationCount: number;
  doi?: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
  };
  publicationTypes?: string[];
  openAccessPdf?: {
    url: string;
  };
  fieldsOfStudy?: string[];
}

export interface Author {
  authorId: string;
  name: string;
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
