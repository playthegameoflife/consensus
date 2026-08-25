# Consensus Clone — SPEC.md

## 1. Concept & Vision

A 1-to-1 functional clone of consensus.app — an AI-powered academic search engine that lets users search peer-reviewed research, see AI-extracted key findings per paper, and understand the scholarly consensus on any question. Clean, research-tool aesthetic: authoritative but approachable, built for people who need answers fast.

## 2. Design Language

- **Aesthetic:** Academic/research tool — clean white, high information density, subtle blue accents, card-based results
- **Colors:**
  - Background: `#f8fafc` (slate-50)
  - Card bg: `#ffffff`
  - Primary: `#2563eb` (blue-600)
  - Accent: `#10b981` (emerald-500 — for consensus meter)
  - Text primary: `#0f172a` (slate-900)
  - Text secondary: `#64748b` (slate-500)
  - Border: `#e2e8f0` (slate-200)
- **Typography:** Inter (body), Source Serif 4 (paper titles/headings)
- **Spacing:** 8px grid, cards with 16px padding, section gaps 24px
- **Motion:** Subtle fade-in on results (200ms), smooth filter transitions

## 3. Layout & Structure

```
┌─────────────────────────────────────────────────────┐
│  [Logo]  [Search Bar ...................]  [Pro?]  │  ← Header
├─────────────────────────────────────────────────────┤
│  [Filters Sidebar]  │  [Results Feed]               │
│  - Query context    │  - Search summary             │
│  - Study Type      │  - Paper cards                 │
│  - Publication Date │  - Infinite scroll             │
│  - Sample Size     │                               │
│  - More filters     │                               │
└─────────────────────────────────────────────────────┘
```

- **Header:** Fixed, logo left, search bar center-expanded, account right
- **Sidebar:** 260px fixed left, collapsible on mobile
- **Results:** Single column, max-width 720px, centered
- **Paper Cards:** Full-width within results column

## 4. Features & Interactions

### Search
- Large centered search bar with placeholder: "Ask a research question..."
- Live autocomplete from Semantic Scholar API as user types (debounced 300ms)
- Submit on Enter or click magnifying glass
- Shows result count + query time after search

### Paper Cards
Each card shows:
- Paper title (Source Serif 4, clickable)
- Authors, journal, year, citation count
- "AI Finding" — bold extracted key finding relevant to query
- Study type badge (RCT, Meta-Analysis, Review, etc.)
- Green/red/gray consensus indicator dot
- Hover: subtle shadow lift

### Consensus Meter
- Horizontal bar per card or aggregate at top
- Green = papers agree, Red = papers disagree, Gray = mixed/unclear
- Shows % of papers supporting the claim

### Filters (Left Sidebar)
- Study Type: RCT, Meta-Analysis, Review, Cross-Sectional, etc.
- Publication Date: slider or presets (Last 5y, Last 10y, Any)
- Sample Size: <100, 100-1000, >1000
- Citation Count: any threshold
- Journal quality indicators

### Paper Detail
- Click card → slide-in panel or new page
- Full abstract
- Extracted claims highlighted
- Link to original DOI
- "Cited by" section

### Empty / Edge States
- No results: "No papers found for X — try different keywords"
- Loading: skeleton cards with shimmer animation
- Error: "Something went wrong — retry"

## 5. Component Inventory

| Component | States |
|---|---|
| `SearchBar` | idle, focused, loading, error |
| `PaperCard` | default, hover, loading (skeleton) |
| `ConsensusMeter` | agreeing (green), disagreeing (red), mixed (gray) |
| `FilterSidebar` | expanded, collapsed (mobile) |
| `FilterChip` | selected, unselected |
| `StudyTypeBadge` | RCT, Meta-Analysis, Review, etc. |
| `PaperDetailPanel` | open, closed |

## 6. Technical Approach

### Stack
- **Framework:** Next.js 14 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Search API:** Semantic Scholar API (free tier: 100 req/s)
- **Paper metadata:** Semantic Scholar + CrossRef API
- **PDF fetch:** arXiv API (for arXiv papers) + DOI URL resolution
- **PDF parsing:** pdfminer.six (local) or marker-pdf
- **LLM extraction:** Groq API (Llama 3.1 8B — free, fast)
- **Vector store:** Chroma (local, free)
- **Hosting:** Vercel

### API Routes

```
GET  /api/search?q=...&filters=...  → { papers: [...], total: N }
GET  /api/paper/:id                → { paper, claims, consensus }
POST /api/extract-claims           → { claims: [...] }
GET  /api/autocomplete?q=...       → { suggestions: [...] }
```

### Data Model

```typescript
interface Paper {
  id: string;           // Semantic Scholar ID
  title: string;
  authors: string[];
  abstract: string;
  year: number;
  journal: string;
  citationCount: number;
  doi?: string;
  arxivId?: string;
  pdfUrl?: string;
  studyType?: string;
  sampleSize?: number;
  claims: Claim[];
  consensusScore: number;  // -1 to 1
}

interface Claim {
  text: string;
  supporting: number;  // papers supporting
  contradicting: number; // papers contradicting
  papers: string[];   // paper IDs
}
```

### LLM Extraction Pipeline
1. Fetch paper abstract + intro from Semantic Scholar
2. If arXiv: fetch PDF → extract text → chunk
3. Prompt Llama 3.1 8B: extract 3-5 key findings relevant to query
4. Store claims in Chroma with paper ID metadata
5. Consensus: embed all claims → cosine similarity → cluster

## 7. Scope — v1 Features

Priority order:
1. ✅ Search bar → Semantic Scholar results
2. ✅ Paper cards with AI finding extraction
3. ✅ Consensus meter (aggregate agreement)
4. ✅ Study type + date filters
5. ⬜ Paper detail panel with full abstract
6. ⬜ PDF fetch + claim extraction from full text
7. ⬜ Infinite scroll / pagination
