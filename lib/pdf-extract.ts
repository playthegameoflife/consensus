/**
 * PDF Text Extraction using pdf-parse
 * Extracts text from PDF Buffer and chunks into ~2000 token segments
 */

interface ExtractResult {
  text: string;
  chunks: string[];
  success: boolean;
  error?: string;
}

// Approximate tokens per chunk (rough estimate: 4 chars per token)
const CHUNK_SIZE_TOKENS = 2000;
const CHUNK_OVERLAP_TOKENS = 200;
const CHARS_PER_TOKEN = 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPdfParse(): Promise<any> {
  const mod: any = await import("pdf-parse");
  return mod.default || mod;
}

/**
 * Extract text from PDF Buffer and split into chunks
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<ExtractResult> {
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(pdfBuffer);

    if (!data.text || data.text.trim().length === 0) {
      return {
        text: "",
        chunks: [],
        success: false,
        error: "No text extracted from PDF",
      };
    }

    // Clean up text: normalize whitespace
    const text = data.text
      .replace(/\f/g, "\n")
      .replace(/\s+/g, " ")
      .trim();

    // Split into chunks
    const chunks = chunkText(text, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS);

    return {
      text,
      chunks,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      text: "",
      chunks: [],
      success: false,
      error: message,
    };
  }
}

/**
 * Split text into overlapping chunks of approximately target token count
 */
function chunkText(
  text: string,
  targetTokens: number,
  overlapTokens: number
): string[] {
  if (!text || text.length === 0) return [];

  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  // If text is short enough, return as single chunk
  if (text.length <= targetChars) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    // Find a good break point (prefer sentence/paragraph boundaries)
    let endIndex = startIndex + targetChars;

    if (endIndex >= text.length) {
      // Last chunk - just take rest of text
      chunks.push(text.slice(startIndex).trim());
      break;
    }

    // Try to break at sentence end (. ! ?) or paragraph break
    const breakChars = [". ", ".\n", "!\n", "?\n", "\n\n", ".  "];
    let foundBreak = false;

    for (const breakChar of breakChars) {
      const lastBreak = text.lastIndexOf(breakChar, endIndex);
      if (lastBreak > startIndex + targetChars * 0.7) {
        endIndex = lastBreak + breakChar.length;
        foundBreak = true;
        break;
      }
    }

    // If no good break point found, try to break at word boundary
    if (!foundBreak) {
      const lastSpace = text.lastIndexOf(" ", endIndex);
      if (lastSpace > startIndex + targetChars * 0.7) {
        endIndex = lastSpace + 1;
      }
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Move start with overlap
    startIndex = endIndex - overlapChars;
    if (startIndex <= 0) {
      startIndex = endIndex;
    }
  }

  return chunks.filter((c) => c.length > 0);
}
