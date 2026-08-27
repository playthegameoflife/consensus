import { NextRequest, NextResponse } from "next/server";
import { runResearchAgent } from "@/lib/research-agent";

export const runtime = "nodejs";

/**
 * Research Agent API — decomposes a complex question, runs multiple
 * quality-filtered sub-searches, and synthesizes a cited report.
 * Mirrors consensus.app's 🤖 Research Agent.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const result = await runResearchAgent(q.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("Research agent error:", err);
    return NextResponse.json(
      { error: "Research agent failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
