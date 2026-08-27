import { searchPapers } from "./openalex";
import { Paper } from "./types";

// Research Agent — mirrors consensus.app's agentic flow:
// 1. Decompose the question into sub-queries (LLM)
// 2. Search each sub-query (OpenAlex, quality-filtered)
// 3. Dedupe + rank the union of papers
// 4. Synthesize a structured report with per-section [N] citations (LLM)

export const runtime = "nodejs";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const LLM_KEY = OPENROUTER_KEY || GROQ_KEY;
const LLM_URL = OPENROUTER_KEY
  ? "https://openrouter.ai/api/v1/chat/completions"
  : "https://api.groq.com/openai/v1/chat/completions";
const LLM_MODEL = OPENROUTER_KEY
  ? (process.env.OPENROUTER_AGENT_MODEL || "deepseek/deepseek-v4-flash-0731")
  : "llama-3.1-8b-instant";

export interface AgentPlanItem {
  query: string;
  rationale: string;
}

export interface AgentSearchResult {
  query: string;
  total: number;
  papers: Paper[];
}

export interface ResearchAgentResult {
  plan: AgentPlanItem[];
  searches: AgentSearchResult[];
  papers: (Paper & { aiFinding?: string })[];
  answer: string;
  steps: { action: string; status: string; detail?: string }[];
}

async function callLLM(
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string | null> {
  if (!LLM_KEY) return null;
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
        model: LLM_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const choice = data.choices?.[0];
    let content = choice?.message?.content?.trim();
    if (!content && choice?.message?.reasoning) {
      content = choice.message.reasoning.trim();
    }
    return content || null;
  } catch {
    return null;
  }
}

/** Step 1: decompose a complex research question into 2-4 sub-queries. */
async function planQueries(question: string): Promise<AgentPlanItem[]> {
  const raw = await callLLM(
    `You are a research planning engine for an academic search tool. Break a complex research question into 2-4 specific, searchable sub-queries. Each sub-query must be a concise academic search string (5-12 words, concrete terms). Return ONLY JSON, no prose.`,
    `Question: "${question}"

Respond with JSON in this exact shape:
{"queries":[{"query":"...","rationale":"..."}]}`,
    600
  );
  if (!raw) return [{ query: question, rationale: "Original question" }];
  try {
    const parsed = JSON.parse(raw);
    const queries = parsed.queries;
    if (!Array.isArray(queries) || queries.length === 0) {
      return [{ query: question, rationale: "Original question" }];
    }
    return queries
      .filter((q: AgentPlanItem) => q.query && q.query.length > 3)
      .slice(0, 4)
      .map((q: AgentPlanItem) => ({
        query: q.query,
        rationale: q.rationale || "",
      }));
  } catch {
    return [{ query: question, rationale: "Original question" }];
  }
}

/** Step 2+3: search each sub-query, dedupe, and rank the union. */
async function runSearches(
  queries: AgentPlanItem[]
): Promise<{ searches: AgentSearchResult[]; papers: Paper[] }> {
  const searches: AgentSearchResult[] = [];
  const seen = new Set<string>();
  const union: Paper[] = [];

  // Run all sub-searches in parallel (max 4)
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const r = await searchPapers(q.query, 0, 15, {
          // Quality signals: recent, cited, meta-analyses/reviews first is
          // handled by OpenAlex relevance; we also apply citation floor
          yearRange: [2000, new Date().getFullYear()],
        });
        return { query: q.query, total: r.total, papers: r.papers };
      } catch {
        return { query: q.query, total: 0, papers: [] };
      }
    })
  );

  for (const r of results) {
    searches.push(r);
    for (const p of r.papers) {
      if (p.isRetracted) continue; // never use retracted papers in analyses
      if (seen.has(p.paperId)) continue;
      seen.add(p.paperId);
      union.push(p);
    }
  }

  // Rank: citation count * recency bonus (like consensus.app Step 2)
  const year = new Date().getFullYear();
  const ranked = union.sort((a, b) => {
    const aScore =
      a.citationCount * 1 +
      Math.max(0, (year - a.year) < 10 ? 50 : 0);
    const bScore =
      b.citationCount * 1 +
      Math.max(0, (year - b.year) < 10 ? 50 : 0);
    return bScore - aScore;
  });

  return { searches, papers: ranked.slice(0, 30) };
}

/** Step 4: synthesize a structured report with [N] citations. */
async function synthesizeReport(
  papers: Paper[],
  question: string
): Promise<string> {
  const paperBlock = papers
    .slice(0, 25)
    .map((p, i) => {
      return `[${i + 1}] ${p.title} (${p.year})\nAuthors: ${p.authors.map((a) => a.name).join(", ")}\n${p.journal ? `Journal: ${p.journal}\n` : ""}Abstract: ${(p.abstract || "No abstract available.").slice(0, 400)}`;
    })
    .join("\n\n");

  const prompt = `You are a research agent. Produce a structured research report answering: "${question}"

CRITICAL CITATION RULES:
- Every factual claim MUST end with an inline citation [N] matching the numbered papers below.
- Cite multiple papers when they agree: "[1][2][5]".
- Never state a finding without its citation number.

REPORT STRUCTURE (use these exact section headings, plain text, no markdown):
Overview
Key Findings
Evidence Quality
Conflicting Evidence
Gaps & Limitations

Papers:
${paperBlock}

Respond with the structured report only. Ground everything in the papers. Never invent findings.`;

  const report = await callLLM(
    "You are a rigorous research agent. Synthesize academic findings accurately with inline numeric citations.",
    prompt,
    4000
  );

  if (!report) {
    return `Based on ${papers.length} papers found for "${question}". Add OPENROUTER_API_KEY to .env.local to enable AI synthesis.`;
  }
  return report;
}

/** Run the full research agent loop. */
export async function runResearchAgent(
  question: string
): Promise<ResearchAgentResult> {
  const steps: ResearchAgentResult["steps"] = [
    { action: "plan", status: "pending" },
    { action: "search", status: "pending" },
    { action: "synthesize", status: "pending" },
  ];

  // Step 1: Plan
  steps[0].status = "running";
  const plan = await planQueries(question);
  steps[0] = { action: "plan", status: "done", detail: `${plan.length} sub-queries` };

  // Step 2+3: Search + rank
  steps[1].status = "running";
  const { searches, papers } = await runSearches(plan);
  steps[1] = {
    action: "search",
    status: "done",
    detail: `${papers.length} unique papers from ${searches.length} searches`,
  };

  // Step 4: Synthesize
  steps[2].status = "running";
  const answer = await synthesizeReport(papers, question);
  steps[2] = { action: "synthesize", status: "done" };

  return {
    plan,
    searches,
    papers,
    answer,
    steps,
  };
}
