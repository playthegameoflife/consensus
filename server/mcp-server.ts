import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ─── Semantic Scholar API types ────────────────────────────────────────────────

interface Author {
  authorId: string;
  name: string;
}

interface Paper {
  paperId: string;
  title: string;
  authors: Author[];
  abstract?: string;
  year: number;
  journal?: string;
  citationCount: number;
  doi?: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
  };
  publicationTypes?: string[];
  openAccessPdf?: {
    url: string;
  };
  fieldsOfStudy?: string[];
}

interface SearchResult {
  papers: Paper[];
  total: number;
  offset: number;
}

// ─── API helpers ───────────────────────────────────────────────────────────────

const SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1";

const PAPER_FIELDS = [
  "paperId",
  "title",
  "authors",
  "abstract",
  "year",
  "journal",
  "citationCount",
  "doi",
  "externalIds",
  "publicationTypes",
  "openAccessPdf",
  "fieldsOfStudy",
].join(",");

function getSemScholarHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

async function searchPapers(
  query: string,
  limit = 10,
  yearFrom?: number,
  yearTo?: number,
  openAccessOnly?: boolean
): Promise<SearchResult> {
  const params = new URLSearchParams({
    query,
    offset: "0",
    limit: String(limit),
    fields: PAPER_FIELDS,
  });

  if (yearFrom || yearTo) {
    const start = yearFrom ?? 0;
    const end = yearTo ?? 9999;
    params.set("year", `${start}-${end}`);
  }

  if (openAccessOnly) {
    params.set("openAccessPdf", "true");
  }

  const res = await fetch(
    `${SEMANTIC_SCHOLAR_BASE}/paper/search?${params}`,
    { headers: getSemScholarHeaders() }
  );

  if (!res.ok) {
    throw new Error(`Semantic Scholar search error ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<SearchResult>;
}

async function getPaperDetails(paperId: string): Promise<Paper> {
  const res = await fetch(
    `${SEMANTIC_SCHOLAR_BASE}/paper/${paperId}?fields=${PAPER_FIELDS}`,
    { headers: getSemScholarHeaders() }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch paper ${paperId}: ${res.status}`);
  }

  return res.json() as Promise<Paper>;
}

async function getPaperCitations(
  paperId: string,
  limit = 10
): Promise<Paper[]> {
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
    { headers: getSemScholarHeaders() }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch citations for ${paperId}: ${res.status}`);
  }

  const data = (await res.json()) as { data: Array<{ citingPaper: Paper }> };
  return data.data.map((c) => c.citingPaper);
}

async function getAutocomplete(query: string): Promise<string[]> {
  const params = new URLSearchParams({ query });
  const res = await fetch(
    `${SEMANTIC_SCHOLAR_BASE}/paper/suggest?${params}`,
    { headers: getSemScholarHeaders() }
  );

  if (!res.ok) return [];
  const data = (await res.json()) as { suggestions?: string[] };
  return (data.suggestions || []).slice(0, 5);
}

// ─── LLM enhancement ─────────────────────────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function extractAIFinding(paper: Paper, query: string): Promise<string | undefined> {
  if (!GROQ_API_KEY) {
    return paper.abstract?.slice(0, 200) + "...";
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
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const SearchPapersSchema = z.object({
  query: z.string().describe("Search query"),
  limit: z.number().optional().default(10).describe("Max results"),
  year_from: z.number().optional().describe("Start year"),
  year_to: z.number().optional().describe("End year"),
  open_access_only: z.boolean().optional().describe("Only open-access papers"),
  study_type: z.string().optional().describe("Study type filter (RCT, Meta-Analysis, Review, etc.)"),
});

const GetPaperSchema = z.object({
  paper_id: z.string().describe("Semantic Scholar paper ID"),
});

const GetPaperCitationsSchema = z.object({
  paper_id: z.string().describe("Semantic Scholar paper ID"),
  limit: z.number().optional().default(10).describe("Max citations"),
});

const AutocompleteSchema = z.object({
  query: z.string().describe("Partial search query"),
});

async function main() {
  const server = new Server(
    { name: "consensus-mcp-server", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ── Tool handlers ──────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_papers",
          description:
            "Search academic papers by query and optional filters. Returns papers with title, authors, year, journal, abstract, AI finding, and consensus score.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              limit: {
                type: "number",
                description: "Max results (default 10)",
                default: 10,
              },
              year_from: {
                type: "number",
                description: "Start year",
              },
              year_to: {
                type: "number",
                description: "End year",
              },
              open_access_only: {
                type: "boolean",
                description: "Only open-access papers",
              },
              study_type: {
                type: "string",
                description: "Study type filter (RCT, Meta-Analysis, Review, etc.)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "get_paper",
          description:
            "Get full details of a specific paper by its Semantic Scholar ID.",
          inputSchema: {
            type: "object",
            properties: {
              paper_id: {
                type: "string",
                description: "Semantic Scholar paper ID",
              },
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
              paper_id: {
                type: "string",
                description: "Semantic Scholar paper ID",
              },
              limit: {
                type: "number",
                description: "Max citations (default 10)",
                default: 10,
              },
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
              query: {
                type: "string",
                description: "Partial search query",
              },
            },
            required: ["query"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "search_papers") {
        const { query, limit, year_from, year_to, open_access_only, study_type } =
          SearchPapersSchema.parse(args);

        const result = await searchPapers(query, limit ?? 10, year_from, year_to, open_access_only);

        // Enrich with AI findings
        const enriched = await Promise.all(
          result.papers.map(async (paper) => {
            const aiFinding = await extractAIFinding(paper, query);
            // Simple consensus score: normalize citation count to 0-100
            const consensusScore = Math.min(
              100,
              Math.round(Math.log1p(paper.citationCount) * 15)
            );
            return {
              ...paper,
              authors: paper.authors.map((a) => a.name),
              ai_finding: aiFinding,
              consensus_score: consensusScore,
              // study_type from publicationTypes if available
              study_type:
                study_type ||
                (paper.publicationTypes?.[0] ?? undefined),
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
        const { paper_id } = GetPaperSchema.parse(args);
        const paper = await getPaperDetails(paper_id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ...paper,
                  authors: paper.authors.map((a) => a.name),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === "get_paper_citations") {
        const { paper_id, limit } = GetPaperCitationsSchema.parse(args);
        const citations = await getPaperCitations(paper_id, limit ?? 10);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  citations: citations.map((p) => ({
                    ...p,
                    authors: p.authors.map((a) => a.name),
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
        const { query } = AutocompleteSchema.parse(args);
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
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Consensus MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
