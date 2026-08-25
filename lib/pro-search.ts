import { NextRequest, NextResponse } from "next/server";
import { searchPapers } from "@/lib/semantic-scholar";
import { extractAIFinding } from "@/lib/llm";
import { Paper } from "@/lib/types";

export const runtime = "edge";

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

  // Step 1: Search
  state.steps[0].status = "running";
  try {
    const result = await searchPapers(query, 0, paperLimit);
    state.papers = result.papers;
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
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return `Based on ${papers.length} papers found for "${query}". Add GROQ_API_KEY to .env.local to enable AI synthesis.`;
  }

  const paperSummaries = papers
    .map((p) => {
      const pClaims = claims.get(p.paperId) || [];
      return `## ${p.title} (${p.year})\n${p.authors.map((a) => a.name).join(", ")}\n${p.journal ? p.journal + "\n" : ""}Finding: ${pClaims.join("; ") || "No AI finding extracted."}`;
    })
    .join("\n\n");

  const prompt = `You are a research assistant. Based on the following papers and their AI-extracted findings, synthesize a comprehensive answer to the query: "${query}"

Focus on:
- What the overall consensus is across papers
- Key agreements and disagreements
- Specific numbers/statistics mentioned
- Caveats or limitations noted

Papers:
${paperSummaries}

Respond with a well-structured answer (3-5 paragraphs) grounded ONLY in the papers above. Do not invent findings.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content:
              "You are a rigorous research assistant. Synthesize findings from academic papers accurately.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return `Synthesis failed (${res.status}).`;

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "No synthesis available.";
  } catch {
    return "Synthesis unavailable.";
  }
}
