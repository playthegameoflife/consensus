import { Paper } from "./types";

// LLM provider detection: OpenRouter → Groq → abstract-only fallback
// Two model tiers: fast model for per-paper extraction, big model for synthesis
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_FAST_MODEL =
  process.env.OPENROUTER_FAST_MODEL || "meta-llama/llama-3.1-8b-instruct";
const GROQ_KEY = process.env.GROQ_API_KEY;

const LLM_URL = OPENROUTER_KEY
  ? "https://openrouter.ai/api/v1/chat/completions"
  : "https://api.groq.com/openai/v1/chat/completions";

const LLM_KEY = OPENROUTER_KEY || GROQ_KEY;

function hasLLM() {
  return !!LLM_KEY;
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  model?: string
): Promise<string | undefined> {
  if (!LLM_KEY) return undefined;

  const useModel = model || (OPENROUTER_KEY ? OPENROUTER_FAST_MODEL : "llama-3.1-8b-instant");

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (OPENROUTER_KEY) {
      headers["Authorization"] = `Bearer ${OPENROUTER_KEY}`;
      headers["HTTP-Referer"] = "https://consensus-clone.app";
      headers["X-Title"] = "Consensus Clone";
    } else {
      headers["Authorization"] = `Bearer ${GROQ_KEY}`;
    }

    const res = await fetch(LLM_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return undefined;
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    // DeepSeek puts answer in reasoning field when content is empty
    if (!content && data.choices?.[0]?.message?.reasoning) {
      content = data.choices[0].message.reasoning.trim();
    }
    return content;
  } catch {
    return undefined;
  }
}

export async function extractAIFinding(
  paper: Paper,
  query: string
): Promise<string | undefined> {
  if (!hasLLM()) {
    return paper.abstract ? paper.abstract.slice(0, 200) + "..." : undefined;
  }

  const abstract = paper.abstract || "No abstract available.";
  const prompt = `You are a research assistant. Given a research paper abstract and a user query, extract the ONE key finding most relevant to the query.

Query: "${query}"

Abstract:
${abstract}

Respond with ONLY the key finding in 1-2 sentences. Be specific and quantitative when possible. If the paper is not relevant to the query, say "This paper may not directly address the query."`;

  const result = await callLLM(
    "You are a helpful research assistant. Extract key findings from academic papers. Respond with the finding only, never mention access or availability.",
    prompt,
    150
  );
  // Filter out common LLM deflection responses
  if (
    !result ||
    /don't have (access|an abstract)|cannot access|no abstract|not available|please provide/i.test(result)
  ) {
    return undefined;
  }
  return result;
}

export async function extractClaimsFromFullText(
  paper: Paper,
  query: string,
  fullText: string
): Promise<string[]> {
  if (!hasLLM() || !fullText || fullText.length < 100) return [];

  const truncatedText = fullText.slice(0, 8000);
  const prompt = `From this research paper, extract 3-5 key findings relevant to the query.

Query: "${query}"
Paper Title: ${paper.title}
Paper Abstract: ${paper.abstract || "No abstract available"}

Paper Content (excerpt):
${truncatedText}

List each finding on a new line, starting with "- ". Be specific and include numbers and statistics when available. Focus on findings directly related to the query.`;

  const text = await callLLM(
    "You are a helpful research assistant. Extract key findings from academic papers.",
    prompt,
    400
  );

  if (!text) return [];
  return text
    .split("\n")
    .map((l: string) => l.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .filter((l: string) => l.length > 10)
    .slice(0, 5);
}

export async function extractClaimsFromAbstract(
  paper: Paper,
  query: string
): Promise<string[]> {
  if (!hasLLM()) return [];

  const abstract = paper.abstract || "";
  if (!abstract) return [];

  const prompt = `From this research paper, extract 3-5 key findings relevant to the query.

Query: "${query}"
Title: ${paper.title}
Abstract: ${abstract}

List each finding on a new line, starting with "- ". Be specific and include numbers when available.`;

  const text = await callLLM(
    "You are a helpful research assistant. Extract key findings from academic papers.",
    prompt,
    300
  );

  if (!text) return [];
  return text
    .split("\n")
    .map((l: string) => l.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .filter((l: string) => l.length > 10)
    .slice(0, 5);
}

/**
 * Master function that tries full text first, falls back to abstract.
 * Returns claims for each paper.
 */
export async function extractAllClaims(
  papers: Paper[],
  query: string,
  fullTextProvider?: (paper: Paper) => Promise<string | null>
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  const withFullText: Paper[] = [];
  const abstractOnly: Paper[] = [];

  if (fullTextProvider) {
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

  await Promise.all(
    withFullText.map(async (paper) => {
      try {
        const fullText = await fullTextProvider!(paper);
        if (fullText) {
          const claims = await extractClaimsFromFullText(paper, query, fullText);
          results.set(paper.paperId, claims);
        } else {
          const claims = await extractClaimsFromAbstract(paper, query);
          results.set(paper.paperId, claims);
        }
      } catch {
        const claims = await extractClaimsFromAbstract(paper, query);
        results.set(paper.paperId, claims);
      }
    })
  );

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
