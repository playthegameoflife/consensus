import { NextRequest, NextResponse } from "next/server";
import { searchPapers } from "@/lib/openalex";
import { Paper } from "@/lib/types";

// Nodejs runtime: OpenRouter fetch needs full undici support
export const runtime = "nodejs";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash-0731";

interface FollowUpRequest {
  query: string; // the follow-up question
  threadHistory: { role: "user" | "assistant"; content: string }[];
  papers: Paper[]; // papers from the current thread context
}

/**
 * Threads follow-up API — mirrors consensus.app's context-preserving
 * follow-up questions. Synthesizes an answer grounded in the papers already
 * retrieved in this thread + conversation history.
 */
export async function POST(req: NextRequest) {
  try {
    const { query, threadHistory, papers } = (await req.json()) as FollowUpRequest;

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    // If LLM not configured, fall back to targeted re-search results only
    if (!OPENROUTER_KEY) {
      const result = await searchPapers(query, 0, 10);
      return NextResponse.json({
        answer:
          "Add OPENROUTER_API_KEY to .env.local to enable AI follow-up answers.",
        newPapers: result.papers,
        total: result.total,
      });
    }

    // Build paper context from the thread (limit for token budget)
    const paperContext = (papers || [])
      .slice(0, 20)
      .map(
        (p, i) =>
          `[${i + 1}] ${p.title} (${p.year})${p.journal ? ` — ${p.journal}` : ""}\nAbstract: ${(p.abstract || "No abstract available.").slice(0, 500)}`
      )
      .join("\n\n");

    const historyBlock = (threadHistory || [])
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 400)}`)
      .join("\n");

    const prompt = `You are a research assistant answering a FOLLOW-UP question in an ongoing research conversation. Ground every claim in the provided papers and cite them inline as [1], [2], etc.

CONVERSATION SO FAR:
${historyBlock || "(no prior messages)"}

PAPERS IN THIS THREAD'S CONTEXT:
${paperContext || "(none — you may note that the question extends beyond the current papers)"}

FOLLOW-UP QUESTION: ${query}

Respond with a focused answer (2-4 paragraphs). Use inline [N] citations matching the numbered papers above ONLY when a claim actually comes from that paper. If the papers don't contain the answer, say what's known and what isn't — never invent findings.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://consensus-clone.app",
        "X-Title": "Consensus Clone",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a rigorous research assistant. Synthesize findings from academic papers accurately with inline numeric citations.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Synthesis failed (${res.status}): ${errText.slice(0, 150)}`, answer: null },
        { status: 200 }
      );
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    let answer = choice?.message?.content?.trim();
    // DeepSeek reasoning models may put the answer in the reasoning field
    if (!answer && choice?.message?.reasoning) {
      answer = choice.message.reasoning.trim();
    }

    return NextResponse.json({
      answer: answer || "No synthesis available.",
      newPapers: [],
      total: papers?.length || 0,
    });
  } catch (err) {
    console.error("Follow-up error:", err);
    return NextResponse.json(
      { error: "Follow-up failed", answer: null },
      { status: 500 }
    );
  }
}
