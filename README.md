This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## MCP Server

A standalone MCP (Model Context Protocol) server that exposes Consensus search capabilities to any MCP-compatible AI assistant (Claude Desktop, Cursor, etc.).

### Setup

```bash
# Install the required package (already in dependencies)
npm install @modelcontextprotocol/sdk
```

### Start the server

**Stdio mode** (for Claude Desktop, Cursor, etc.):

```bash
npm run mcp
```

**HTTP+SSE mode** (for remote clients):

```bash
HTTP_MODE=1 npm run mcp
# Server runs on http://localhost:3457/mcp
```

### Connect from Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "consensus": {
      "command": "npx",
      "args": ["tsx", "/path/to/consensus/server/index.ts"]
    }
  }
}
```

For HTTP+SSE mode:

```json
{
  "mcpServers": {
    "consensus": {
      "url": "http://localhost:3457/mcp"
    }
  }
}
```

### Available tools

| Tool | Description |
|------|-------------|
| `search_papers` | Search academic papers by query with optional filters (year range, open-access, study type) |
| `get_paper` | Get full details of a specific paper by OpenAlex Work ID |
| `get_paper_citations` | Get papers that cite a specific paper |
| `autocomplete` | Get search suggestions for partial queries |

### Example usage

```
Search for papers about vitamin D and covid:
- Tool: search_papers
- Arguments: {"query": "vitamin D covid", "limit": 5, "year_from": 2020}

Get details for a specific paper:
- Tool: get_paper
- Arguments: {"paper_id": "W3013463190"}  (OpenAlex Work ID)

Get papers that cite a paper:
- Tool: get_paper_citations
- Arguments: {"paper_id": "abc123...", "limit": 10}
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `OPENALEX_MAILTO` | Contact email sent in `User-Agent` / `mailto=` for OpenAlex "polite pool" (recommended for production) |
| `GROQ_API_KEY` | Optional Groq API key for AI-generated paper summaries |
| `HTTP_MODE` | Set to `1` to enable HTTP+SSE transport instead of stdio |
| `MCP_PORT` | Port for HTTP+SSE server (default: 3457) |

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
