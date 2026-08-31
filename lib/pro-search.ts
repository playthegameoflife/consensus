import { NextRequest, NextResponse } from "next/server";
import { searchPapers } from "@/lib/openalex";
import { unifiedSearch } from "@/lib/unified-search";
import { extractAIFinding } from "@/lib/llm";
import { Paper } from "@/lib/types";
import { getPaperFullText } from "@/lib/fulltext";

// NOTE: consumed by app/api/pro-search/route.ts which runs on nodejs runtime
// (full-text PDF extraction needs Node APIs).

interface Step {
  action: "search" | "extract" | "synthesize" | "finalize";
  query?: string;
  paperIds?: string[];
  status: "pending" | "running" | "done";
  result?: unknown;
  error?: string;
}

interface AgentState {
  steps: Step[];
  papers: Paper[];
  claims: Map<string, string[]>;
  query: string;
}

/**
 * Pro Search Agent
 *
 * Given a complex query, the agent:
 * 1. Breaks it into sub-questions
 * 2. Searches for papers for each sub-question
 * 3. Extracts claims from the union of papers
 * 4. Synthesizes a final answer grounded in the papers
 *
 * For consensus.app parity: Pro Search uses 20 papers, Deep uses up to 50.
 * We use the first 10-20 papers for now (expandable).
 */
export async function runProSearch(query: string, depth: "pro" | "deep" = "pro") {
  const paperLimit = depth === "deep" ? 20 : 10;
  const state: AgentState = {
    steps: [
      { action: "search", status: "pending", query },
      { action: "extract", status: "pending" },
      { action: "synthesize", status: "pending" },
      { action: "finalize", status: "pending" },
    ],
    papers: [],
    claims: new Map(),
    query,
  };

  // Step 1: Search — exclude retracted papers (consensus.app never uses them in analyses)
  state.steps[0].status = "running";
  try {
    const result = await unifiedSearch(query, 0, paperLimit);
    state.papers = result.papers.filter((p) => !p.isRetracted);
    state.steps[0] = { action: "search", status: "done", result: { total: result.total } };
  } catch (err) {
    state.steps[0] = {
      action: "search",
      status: "done",
      error: err instanceof Error ? err.message : "Search failed",
    };
    throw err;
  }

  // Step 2: Extract claims from each paper
  state.steps[1].status = "running";
  const claimResults = await Promise.allSettled(
    state.papers.map(async (paper) => {
      const finding = await extractAIFinding(paper, query);
      return { paperId: paper.paperId, finding };
    })
  );

  for (const result of claimResults) {
    if (result.status === "fulfilled") {
      state.claims.set(result.value.paperId, result.value.finding ? [result.value.finding] : []);
    }
  }
  state.steps[1] = { action: "extract", status: "done", result: { papersProcessed: state.papers.length } };

  // Step 3: Synthesize — generate a final grounded answer
  state.steps[2].status = "running";
  const synthesized = await synthesizeAnswer(state.papers, state.claims, query, depth);
  state.steps[2] = { action: "synthesize", status: "done", result: synthesized };

  // Step 4: Finalize
  state.steps[3] = { action: "finalize", status: "done" };

  return {
    steps: state.steps,
    papers: state.papers,
    claims: Object.fromEntries(state.claims),
    answer: synthesized,
    totalClaimed: state.papers.length,
  };
}

async function synthesizeAnswer(
  papers: Paper[],
  claims: Map<string, string[]>,
  query: string,
  depth: string
): Promise<string> {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const LLM_KEY = OPENROUTER_KEY || GROQ_KEY;

  console.log("[ProSearch] OPENROUTER_KEY present:", !!OPENROUTER_KEY);

  if (!LLM_KEY) {
    return `Based on ${papers.length} papers found for "${query}". Add OPENROUTER_API_KEY to .env.local to enable AI synthesis.`;
  }

  const paperSummaries = papers
    .map((p, i) => {
      const pClaims = claims.get(p.paperId) || [];
      return `[${i + 1}] ${p.title} (${p.year})\nAuthors: ${p.authors.map((a) => a.name).join(", ")}\n${p.journal ? `Journal: ${p.journal}\n` : ""}Finding: ${pClaims.join("; ") || "No AI finding extracted."}`;
    })
    .join("\n\n");

  // Enrich with full text for the top papers (consensus.app reads full papers
  // when available, not just abstracts). Limit to top 5 for token budget.
  let fullTextBlock = "";
  const topForFullText = papers.slice(0, 5);
  const fullTexts = await Promise.allSettled(
    topForFullText.map((p) => getPaperFullText(p))
  );
  const ftParts: string[] = [];
  fullTexts.forEach((r, idx) => {
    if (r.status === "fulfilled" && r.value.usedFullText) {
      ftParts.push(
        `[${idx + 1}] FULL TEXT (${r.value.source || "pdf"}):\n${r.value.text.slice(0, 6000)}`
      );
    }
  });
  if (ftParts.length > 0) {
    fullTextBlock = `\n\nADDITIONAL FULL-TEXT CONTENT (use for depth on methods/results when relevant):\n${ftParts.join("\n\n")}`;
  }

  const prompt = `You are a research assistant. Based on the following numbered papers and their findings, synthesize a comprehensive answer to the query: "${query}"

CRITICAL CITATION RULES:
- Every factual claim MUST end with an inline citation in brackets matching the paper number, e.g. "...improved sleep quality [3]." or "29 of 34 studies showed benefit [1]."
- Cite MULTIPLE papers when they agree: "[1][2][5]"
- Never state a finding without its citation number.

Focus on:
- What the overall consensus is across papers
- Key agreements and disagreements
- Specific numbers/statistics mentioned
- Caveats or limitations noted

Papers:
${paperSummaries}
${fullTextBlock}

Respond with a well-structured answer (3-5 paragraphs, plain text with [N] citations, no markdown headers) grounded ONLY in the papers above. Do not invent findings.`;

  const model = OPENROUTER_KEY
    ? (process.env.OPENROUTER_SYNTH_MODEL || "deepseek/deepseek-v4-flash-0731")
    : "llama-3.1-8b-instant";
  const url = OPENROUTER_KEY
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";

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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a rigorous research assistant. Synthesize findings from academic papers accurately.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    console.log("[ProSearch] LLM status:", res.status);
    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      return `Synthesis failed (${res.status}): ${errText.slice(0, 200)}.`;
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    let content = choice?.message?.content?.trim();
    // DeepSeek puts answer in reasoning field when content is empty
    if (!content && choice?.message?.reasoning) {
      content = choice.message.reasoning.trim();
    }
    return content || "No synthesis available.";
  } catch (err) {
    console.log("[ProSearch] LLM catch error:", err);
    return "Synthesis unavailable.";
  }
}
