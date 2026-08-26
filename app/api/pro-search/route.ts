import { NextRequest, NextResponse } from "next/server";
import { runProSearch } from "@/lib/pro-search";

// Using nodejs runtime for reliable OpenRouter API access
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const depth = (searchParams.get("depth") || "pro") as "pro" | "deep";

  if (!query.trim()) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const result = await runProSearch(query, depth);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Pro search error:", err);
    return NextResponse.json(
      { error: "Pro search failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
