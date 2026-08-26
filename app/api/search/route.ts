import { NextRequest, NextResponse } from "next/server";
import { searchPapers } from "@/lib/openalex";
import { extractAIFinding as extractAIFindingFromLib, extractAllClaims } from "@/lib/llm";
import { fetchPaperPDF, hasPDFSource } from "@/lib/pdf-fetch";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import { scoreConsensus } from "@/lib/consensus";
import { Paper, SortOrder, SearchFilters } from "@/lib/types";

export const runtime = "edge";

// Wrapper for extractAIFinding to maintain compatibility
async function extractAIFinding(paper: Paper, query: string): Promise<string | undefined> {
  return extractAIFindingFromLib(paper, query);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const yearRange = searchParams.get("yearRange");
  const openAccess = searchParams.get("openAccess") === "true";
  const mode = searchParams.get("mode") || "fast"; // "fast" or "deep"
  const corpus = searchParams.get("corpus") as "all" | "medical" | null;
  const sortParam = searchParams.get("sort") as SortOrder | null;
  const studyTypesParam = searchParams.get("studyTypes"); // comma-separated
  const citationMin = parseInt(searchParams.get("citationMin") || "0", 10);

  if (!query.trim()) {
    return NextResponse.json({ papers: [], total: 0, offset: 0 });
  }

  try {
    const filters: SearchFilters = {};
    if (yearRange) {
      const [start, end] = yearRange.split("-").map(Number);
      filters.yearRange = [start, end];
    }
    if (openAccess) filters.openAccessOnly = true;
    if (corpus === "medical") filters.corpus = "medical";
    if (sortParam && ["relevance", "newest", "cited", "consensus"].includes(sortParam)) {
      filters.sort = sortParam as SortOrder;
    }
    if (studyTypesParam) {
      filters.publicationType = studyTypesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (citationMin > 0) filters.citationCountMin = citationMin;

    const result = await searchPapers(query, offset, limit, filters);

    if (mode === "deep") {
      return handleDeepMode(result.papers, query);
    }

    // Fast mode: extract AI finding for each paper in parallel
    const papersWithFindings = await Promise.all(
      result.papers.map(async (paper: Paper) => {
        try {
          const finding = await extractAIFinding(paper, query);
          return { ...paper, aiFinding: finding };
        } catch {
          return { ...paper, aiFinding: undefined };
        }
      })
    );

    return NextResponse.json({
      papers: papersWithFindings,
      total: result.total,
      offset: result.offset,
    });
  } catch (err) {
    console.error("Search error:", err);

    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("429") || errorMessage.includes("rate") || errorMessage.includes("Too Many Requests")) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "OpenAlex is rate-limited. Try again in a few seconds.",
          papers: [],
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Search failed", papers: [], total: 0, offset: 0 },
      { status: 500 }
    );
  }
}

async function handleDeepMode(papers: Paper[], query: string) {
  async function getFullText(paper: Paper): Promise<string | null> {
    if (!hasPDFSource(paper)) return null;

    try {
      const pdfBuffer = await fetchPaperPDF(paper);
      if (!pdfBuffer) return null;

      const result = await extractTextFromPDF(pdfBuffer);
      if (!result.success) return null;

      return result.text;
    } catch {
      return null;
    }
  }

  const claimsMap = await extractAllClaims(papers, query, getFullText);
  const consensusResult = await scoreConsensus(claimsMap);

  const papersWithClaims = await Promise.all(
    papers.map(async (paper) => {
      const claims = claimsMap.get(paper.paperId) || [];
      const consensusScore = consensusResult.perPaperScores.get(paper.paperId) || 0;
      const aiFinding = await extractAIFinding(paper, query).catch(() => undefined);

      return {
        ...paper,
        aiFinding,
        claims,
        consensusScore,
      };
    })
  );

  return NextResponse.json({
    papers: papersWithClaims,
    total: papers.length,
    offset: 0,
    aggregateConsensus: consensusResult.aggregateScore,
  });
}
