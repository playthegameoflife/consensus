import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  searchPapers as openalexSearch,
  getPaper as openalexGetPaper,
  autocomplete as openalexAutocomplete,
  getCitations as openalexGetCitations,
  reconstructAbstract,
} from "../lib/openalex.js";
import { extractAIFinding } from "../lib/llm.js";
import type { Paper } from "../lib/types.js";

// ─── Re-export shared OpenAlex-backed client ──────────────────────────────────

async function searchPapers(
  query: string,
  limit = 10,
  yearFrom?: number,
  yearTo?: number,
  openAccessOnly?: boolean
) {
  const filters: Parameters<typeof openalexSearch>[3] = {};
  if (yearFrom || yearTo) {
    filters.yearRange = [yearFrom ?? 0, yearTo ?? new Date().getFullYear()];
  }
  if (openAccessOnly) filters.openAccessOnly = true;
  return openalexSearch(query, 0, limit, filters);
}

async function getPaperDetails(paperId: string): Promise<Paper> {
  return openalexGetPaper(paperId);
}

async function getPaperCitations(paperId: string, limit = 10): Promise<Paper[]> {
  const cites = await openalexGetCitations(paperId, limit);
  // MCP consumers expect full Paper[] — fetch metadata per ID
  return Promise.all(cites.map((c) => openalexGetPaper(c.paperId).catch(() => null as unknown as Paper))).then((arr) => arr.filter(Boolean));
}

async function getAutocomplete(query: string): Promise<string[]> {
  return openalexAutocomplete(query);
}

// Suppress unused import warning while keeping the shared client
void reconstructAbstract;

// ─── LLM enhancement ─────────────────────────────────────────────────────────
// extractAIFinding is imported from lib/llm.js above — no local copy needed.

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
  paper_id: z.string().describe("OpenAlex Work ID (e.g. W3013463190)"),
});

const GetPaperCitationsSchema = z.object({
  paper_id: z.string().describe("OpenAlex Work ID (e.g. W3013463190)"),
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
            "Get full details of a specific paper by its OpenAlex Work ID.",
          inputSchema: {
            type: "object",
            properties: {
              paper_id: {
                type: "string",
                description: "OpenAlex Work ID (e.g. W3013463190)",
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
                description: "OpenAlex Work ID (e.g. W3013463190)",
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
