import { Paper } from "./types";

/**
 * Fetch PDF for a paper using arXiv ID or DOI
 * Returns Buffer or null if no PDF available
 */
export async function fetchPaperPDF(paper: Paper): Promise<Buffer | null> {
  // Try arXiv first (most reliable for open-access)
  if (paper.externalIds?.ArXiv) {
    const pdfBuffer = await tryArXivPDF(paper.externalIds.ArXiv);
    if (pdfBuffer) return pdfBuffer;
  }

  // Try openAccessPdf from Semantic Scholar
  if (paper.openAccessPdf?.url) {
    const pdfBuffer = await tryPDFUrl(paper.openAccessPdf.url);
    if (pdfBuffer) return pdfBuffer;
  }

  // Try DOI resolution via CrossRef
  if (paper.doi || paper.externalIds?.DOI) {
    const doi = paper.doi || paper.externalIds?.DOI;
    if (doi) {
      const pdfBuffer = await tryDOIPDF(doi);
      if (pdfBuffer) return pdfBuffer;
    }
  }

  return null;
}

/**
 * Fetch PDF from arXiv
 */
async function tryArXivPDF(arxivId: string): Promise<Buffer | null> {
  // arXiv IDs may have version suffix (e.g., 2301.00001v1)
  // Strip version suffix if present for URL construction
  const cleanId = arxivId.replace(/v\d+$/, "");
  const url = `https://arxiv.org/pdf/${cleanId}.pdf`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/pdf")) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Fetch PDF from a direct URL
 */
async function tryPDFUrl(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/pdf")) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Fetch PDF via DOI using CrossRef API to find open-access PDF URL
 */
async function tryDOIPDF(doi: string): Promise<Buffer | null> {
  try {
    // First try CrossRef for open-access link
    const crossRefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const crossRefResponse = await fetch(crossRefUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (crossRefResponse.ok) {
      const data = await crossRefResponse.json();
      const link = data.message?.["link"]?.find(
        (l: { "content-type": string; "content-version": string; "intent-source": string; URL: string }) =>
          l["content-type"] === "application/pdf" && l["content-version"] === "vor"
      );

      if (link?.URL) {
        const pdfBuffer = await tryPDFUrl(link.URL);
        if (pdfBuffer) return pdfBuffer;
      }
    }

    // Fallback: try doi.org redirect
    const doiUrl = `https://doi.org/${doi}`;
    const response = await fetch(doiUrl, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/pdf")) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Check if a paper has a fetchable PDF source
 */
export function hasPDFSource(paper: Paper): boolean {
  return !!(
    paper.externalIds?.ArXiv ||
    paper.openAccessPdf?.url ||
    paper.doi ||
    paper.externalIds?.DOI
  );
}
