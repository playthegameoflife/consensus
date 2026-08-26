import { Paper } from "./types";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function extractAIFinding(paper: Paper, query: string): Promise<string | undefined> {
  if (!GROQ_API_KEY) {
    // Fallback: return a generic finding from abstract
    return paper.abstract ? paper.abstract.slice(0, 200) + "..." : undefined;
  }

  const abstract = paper.abstract || "No abstract available.";
  const prompt = `You are a research assistant. Given a research paper abstract and a user query, extract the ONE key finding most relevant to the query.

Query: "${query}"

Abstract:
${abstract}

Respond with ONLY the key finding in 1-2 sentences. Be specific and quantitative when possible. If the paper is not relevant to the query, say "This paper may not directly address the query."`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful research assistant. Extract key findings from academic papers.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return undefined;

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}

export async function extractClaimsFromFullText(
  paper: Paper,
  query: string,
  fullText: string
): Promise<string[]> {
  if (!GROQ_API_KEY || !fullText || fullText.length < 100) {
    return [];
  }

  // Use first 8000 chars to stay within context limits
  const truncatedText = fullText.slice(0, 8000);

  const prompt = `From this research paper, extract 3-5 key findings relevant to the query.

Query: "${query}"

Paper Title: ${paper.title}
Paper Abstract: ${paper.abstract || "No abstract available"}

Paper Content (excerpt):
${truncatedText}

List each finding on a new line, starting with "- ". Be specific and include numbers and statistics when available. Focus on findings directly related to the query.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful research assistant. Extract key findings from academic papers.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const claims = text
      .split("\n")
      .map((l: string) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean)
      .filter((l: string) => l.length > 10);

    return claims.slice(0, 5);
  } catch {
    return [];
  }
}

export async function extractClaimsFromAbstract(
  paper: Paper,
  query: string
): Promise<string[]> {
  if (!GROQ_API_KEY) return [];

  const abstract = paper.abstract || "";
  if (!abstract) return [];

  const prompt = `From this research paper, extract 3-5 key findings relevant to the query.

Query: "${query}"

Title: ${paper.title}
Abstract: ${abstract}

List each finding on a new line, starting with "- ". Be specific and include numbers when available.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful research assistant. Extract key findings from academic papers.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const claims = text
      .split("\n")
      .map((l: string) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean)
      .filter((l: string) => l.length > 10);

    return claims.slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Master function that tries full text first, falls back to abstract
 * Returns claims for each paper
 */
export async function extractAllClaims(
  papers: Paper[],
  query: string,
  fullTextProvider?: (paper: Paper) => Promise<string | null>
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  // Process papers with full text first, then abstract fallback
  const withFullText: Paper[] = [];
  const abstractOnly: Paper[] = [];

  if (fullTextProvider) {
    // Separate papers that have PDF sources
    for (const paper of papers) {
      const hasArxiv = !!paper.externalIds?.ArXiv;
      const hasOAPdf = !!paper.openAccessPdf?.url;
      if (hasArxiv || hasOAPdf) {
        withFullText.push(paper);
      } else {
        abstractOnly.push(paper);
      }
    }
  } else {
    abstractOnly.push(...papers);
  }

  // Process full text papers
  await Promise.all(
    withFullText.map(async (paper) => {
      try {
        const fullText = await fullTextProvider!(paper);
        if (fullText) {
          const claims = await extractClaimsFromFullText(paper, query, fullText);
          results.set(paper.paperId, claims);
        } else {
          // Fallback to abstract
          const claims = await extractClaimsFromAbstract(paper, query);
          results.set(paper.paperId, claims);
        }
      } catch {
        const claims = await extractClaimsFromAbstract(paper, query);
        results.set(paper.paperId, claims);
      }
    })
  );

  // Process abstract-only papers
  await Promise.all(
    abstractOnly.map(async (paper) => {
      try {
        const claims = await extractClaimsFromAbstract(paper, query);
        results.set(paper.paperId, claims);
      } catch {
        results.set(paper.paperId, []);
      }
    })
  );

  return results;
}
