import { Paper } from "./types";
import { fetchPaperPDF, hasPDFSource } from "./pdf-fetch";
import { extractTextFromPDF } from "./pdf-extract";

/**
 * Full-text pipeline — mirrors consensus.app's full-text access:
 * fetch the paper's PDF (arXiv → OpenAlex OA URL → DOI/CrossRef), extract
 * text, and return the relevant portion. Falls back to abstract.
 *
 * Returns:
 * - text: the full text (or abstract fallback)
 * - usedFullText: true when the model read the actual paper, not just abstract
 * - source: where the full text came from ("arxiv" | "oa" | "doi" | null)
 */

export interface FullTextResult {
  text: string;
  usedFullText: boolean;
  source: "arxiv" | "oa" | "doi" | null;
  error?: string;
}

// Max characters to feed the model (fits within ~30k token context window).
const MAX_FULLTEXT_CHARS = 30000;
// Cache full-text extractions in-memory (keyed by paperId) to avoid
// re-fetching PDFs on repeated questions about the same paper.
const cache = new Map<string, FullTextResult>();

export async function getPaperFullText(paper: Paper): Promise<FullTextResult> {
  // Abstract-only short circuit
  const abstract = paper.abstract || "";
  const abstractFallback: FullTextResult = {
    text: abstract,
    usedFullText: false,
    source: null,
  };

  if (!hasPDFSource(paper)) return abstractFallback;

  // Cache hit
  const cached = cache.get(paper.paperId);
  if (cached) return cached;

  // Determine source order for diagnostics
  let source: FullTextResult["source"] = null;
  if (paper.externalIds?.ArXiv) source = "arxiv";
  else if (paper.openAccessPdf?.url) source = "oa";
  else if (paper.doi || paper.externalIds?.DOI) source = "doi";

  try {
    const pdfBuffer = await fetchPaperPDF(paper);
    if (!pdfBuffer) {
      cache.set(paper.paperId, abstractFallback);
      return abstractFallback;
    }

    const extracted = await extractTextFromPDF(pdfBuffer);
    if (!extracted.success || extracted.text.length === 0) {
      cache.set(paper.paperId, abstractFallback);
      return abstractFallback;
    }

    // Use full text, but keep it within context budget. Prefer the middle
    // (methods + findings) rather than just the intro when truncating.
    let text = extracted.text;
    if (text.length > MAX_FULLTEXT_CHARS) {
      // Take head (title/intro) + a broad middle window (methods/results)
      const head = text.slice(0, 6000);
      const midStart = Math.floor((text.length - 24000) / 2);
      const middle = text.slice(midStart, midStart + 24000);
      text = head + "\n\n[...]\n\n" + middle;
    }

    const result: FullTextResult = {
      text,
      usedFullText: true,
      source,
    };
    cache.set(paper.paperId, result);
    return result;
  } catch (err) {
    const result: FullTextResult = {
      ...abstractFallback,
      error: err instanceof Error ? err.message : "PDF fetch failed",
    };
    cache.set(paper.paperId, result);
    return result;
  }
}

/** True when a paper has a PDF source we can try (used for UI badges). */
export function canReadFullText(paper: Paper): boolean {
  return hasPDFSource(paper);
}

/** Clear the extraction cache (used in tests / memory hygiene). */
export function clearFullTextCache(): void {
  cache.clear();
}
