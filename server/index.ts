/**
 * Consensus MCP Server runner
 *
 * Supports two transports:
 *  - stdio   : for local CLI use (Claude Desktop, cursor, etc.)
 *  - HTTP+SSE: for remote clients (set HTTP_MODE=1, defaults to port 3457)
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "http";
import { parse } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";

// ─── Semantic Scholar API helpers ─────────────────────────────────────────────

const SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1";

const PAPER_FIELDS = [
  "paperId", "title", "authors", "abstract", "year", "journal",
  "citationCount", "doi", "externalIds", "publicationTypes",
  "openAccessPdf", "fieldsOfStudy",
].join(",");

function getHeaders(): HeadersInit {
  const h: HeadersInit = { Accept: "application/json" };
  const k = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (k) h["x-api-key"] = k;
  return h;
}

async function searchPapers(
  query: string,
  limit = 10,
  yearFrom?: number,
  yearTo?: number,
  openAccessOnly?: boolean
) {
  const params = new URLSearchParams({
    query, offset: "0", limit: String(limit), fields: PAPER_FIELDS,
  });
  if (yearFrom !== undefined || yearTo !== undefined) {
    params.set("year", `${yearFrom ?? 0}-${yearTo ?? 9999}`);
  }
  if (openAccessOnly) params.set("openAccessPdf", "true");
  const res = await fetch(`${SEMANTIC_SCHOLAR_BASE}/paper/search?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Search error ${res.status}`);
  return res.json() as Promise<{ papers: any[]; total: number; offset: number }>;
}

async function getPaperDetails(paperId: string) {
  const res = await fetch(
    `${SEMANTIC_SCHOLAR_BASE}/paper/${paperId}?fields=${PAPER_FIELDS}`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`Paper fetch error ${res.status}`);
  return res.json() as Promise<any>;
}

async function getPaperCitations(paperId: string, limit = 10) {
  const params = new URLSearchParams({
    "fields[0]": "paperId",
    "fields[1]": "title",
    "fields[2]": "authors",
    "fields[3]": "year",
    "fields[4]": "journal",
    "fields[5]": "citationCount",
    limit: String(limit),
  });
  const res = await fetch(
    `${SEMANTIC_SCHOLAR_BASE}/paper/${paperId}/citations?${params}`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`Citations error ${res.status}`);
  const data = (await res.json()) as { data: Array<{ citingPaper: any }> };
  return data.data.map((c) => c.citingPaper);
}

async function getAutocomplete(query: string) {
  const res = await fetch(
    `${SEMANTIC_SCHOLAR_BASE}/paper/suggest?${new URLSearchParams({ query })}`,
    { headers: getHeaders() }
  );
  if (!res.ok) return [];
  const d = (await res.json()) as { suggestions?: string[] };
  return (d.suggestions || []).slice(0, 5);
}

// ─── LLM enrichment ───────────────────────────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function extractAIFinding(paper: any, query: string): Promise<string | undefined> {
  if (!GROQ_API_KEY) return paper.abstract?.slice(0, 200) + "...";
  const abstract = paper.abstract || "No abstract available.";
  const prompt = `You are a research assistant. Given a research paper abstract and a user query, extract the ONE key finding most relevant to the query.

Query: "${query}"

Abstract:
${abstract}

Respond with ONLY the key finding in 1-2 sentences. Be specific and quantitative when possible. If the paper is not relevant to the query, say "This paper may not directly address the query."`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a helpful research assistant." },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return undefined;
    const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return d.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}

// ─── Build MCP server ─────────────────────────────────────────────────────────

function buildServer() {
  const server = new Server(
    { name: "consensus-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_papers",
        description:
          "Search academic papers by query and optional filters. Returns papers with title, authors, year, journal, abstract, AI finding, and consensus score.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", description: "Max results (default 10)", default: 10 },
            year_from: { type: "number", description: "Start year" },
            year_to: { type: "number", description: "End year" },
            open_access_only: { type: "boolean", description: "Only open-access papers" },
            study_type: { type: "string", description: "Study type (RCT, Meta-Analysis, Review, etc.)" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_paper",
        description: "Get full details of a specific paper by its Semantic Scholar ID.",
        inputSchema: {
          type: "object",
          properties: {
            paper_id: { type: "string", description: "Semantic Scholar paper ID" },
          },
          required: ["paper_id"],
        },
      },
      {
        name: "get_paper_citations",
        description: "Get papers that cite a specific paper.",
        inputSchema: {
          type: "object",
          properties: {
            paper_id: { type: "string", description: "Semantic Scholar paper ID" },
            limit: { type: "number", description: "Max citations (default 10)", default: 10 },
          },
          required: ["paper_id"],
        },
      },
      {
        name: "autocomplete",
        description: "Get search suggestions for partial queries.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Partial search query" },
          },
          required: ["query"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "search_papers") {
        const { query, limit = 10, year_from, year_to, open_access_only, study_type } =
          z.object({
            query: z.string(),
            limit: z.number().optional().default(10),
            year_from: z.number().optional(),
            year_to: z.number().optional(),
            open_access_only: z.boolean().optional(),
            study_type: z.string().optional(),
          }).parse(args);

        const result = await searchPapers(query, limit, year_from, year_to, open_access_only);
        const enriched = await Promise.all(
          result.papers.map(async (paper) => {
            const aiFinding = await extractAIFinding(paper, query);
            const consensusScore = Math.min(
              100,
              Math.round(Math.log1p(paper.citationCount) * 15)
            );
            return {
              ...paper,
              authors: paper.authors.map((a: any) => a.name),
              ai_finding: aiFinding,
              consensus_score: consensusScore,
              study_type: (study_type || paper.publicationTypes?.[0]) ?? undefined,
            };
          })
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { papers: enriched, total: result.total, offset: result.offset },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === "get_paper") {
        const { paper_id } = z.object({ paper_id: z.string() }).parse(args);
        const paper = await getPaperDetails(paper_id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { ...paper, authors: paper.authors.map((a: any) => a.name) },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === "get_paper_citations") {
        const { paper_id, limit = 10 } = z
          .object({ paper_id: z.string(), limit: z.number().optional().default(10) })
          .parse(args);
        const citations = await getPaperCitations(paper_id, limit);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  citations: citations.map((p: any) => ({
                    ...p,
                    authors: p.authors.map((a: any) => a.name),
                  })),
                  count: citations.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === "autocomplete") {
        const { query } = z.object({ query: z.string() }).parse(args);
        const suggestions = await getAutocomplete(query);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ suggestions }, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// ─── HTTP+SSE server ───────────────────────────────────────────────────────────

async function runHttpServer(port = 3457) {
  const server = createServer();
  const mcpServer = buildServer();

  server.on("request", async (req, res) => {
    const { pathname } = parse(req.url || "");

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, MCP-Session-ID, MCP-Endpoint",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    // Health check
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "consensus-mcp-server" }));
      return;
    }

    // MCP HTTP+SSE endpoint
    if (pathname === "/mcp" && (req.method === "GET" || req.method === "POST")) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.error(`Consensus MCP Server running on http://localhost:${port}/mcp (HTTP+SSE)`);
      resolve();
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const httpMode = process.env.HTTP_MODE === "1" || process.env.HTTP_MODE === "true";

if (httpMode) {
  const port = parseInt(process.env.MCP_PORT ?? "3457", 10);
  runHttpServer(port).catch((err) => {
    console.error("Failed to start HTTP server:", err);
    process.exit(1);
  });
} else {
  const transport = new StdioServerTransport();
  const server = buildServer();
  server.connect(transport).catch((err) => {
    console.error("Failed to connect stdio transport:", err);
    process.exit(1);
  });
  console.error("Consensus MCP Server running on stdio");
}
