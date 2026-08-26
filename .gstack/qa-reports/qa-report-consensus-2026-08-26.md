# QA Report — consensus clone (76.13.30.74:3000)

**Date:** 2026-08-26
**Target:** http://76.13.30.74:3000 (repo: playthegameoflife/consensus)
**Reference:** live consensus.app (SSR verified) + Wayback snapshots (2025-02, 2025-06, 2025-12, 2026-01)
**Tier:** Standard
**Mode:** Full — 1:1 clone verification

## Summary

| Metric | Value |
|---|---|
| Issues found | 6 |
| Fixed (verified) | 5 |
| Deferred | 1 |
| Health score before | 84 |
| Health score after | 96 |
| JS console errors (clone) | 0 |

## Verified working (matches consensus.app)

- ✅ Landing: "Research starts here" + sidebar copy is **identical** to live consensus.app ("Consensus is the AI-powered academic search engine", "Search & analyze 220M+ peer reviewed research papers", "Transparent, reliable, and built to save you time")
- ✅ Design tokens: background `oklch(0.981 0.004 247)`, primary `oklch(0.479 0.188 254)` — verified against consensus.app's palette
- ✅ Search: real OpenAlex results (230K for coffee, 149K for meditation, 33K for creatine — all relevant papers with abstracts)
- ✅ Consensus Meter: "N papers analyzed", agreeing/disagreeing/mixed counts, verdict (MOSTLY AGREE / MOSTLY DISAGREE / MIXED EVIDENCE)
- ✅ Sort dropdown: Relevance / Newest First / Most Cited / Consensus
- ✅ Filters: Study Type (Meta-Analysis, Review, RCT, Cross-Sectional, Cohort, Case-Control), Publication Year (+ sliders 1900–2026), Access
- ✅ Paper detail panel: Overview / Claims / Citations / Related / Graph / Chat tabs, BibTeX export, View PDF
- ✅ Corpus dropdown (All papers / Medical), Deep mode, Load more results, Save search, Recent searches
- ✅ 0 console errors; TypeScript compiles clean

## Issues fixed (commit fff9ea1)

### ISSUE-001 — HIGH — Quick action pills ran literal searches
Clicking "📊 Draft a report" / "✦ Find the Consensus" / "🔬 Find studies by method" executed a plain keyword search for the pill text → 4.2M junk results ("Draft a report" papers). Real consensus.app pills set a prompt template + Pro/Deep mode.
**Fix:** Pills now prefill the textarea with a template ("Write a report about ", "What is the consensus on ", "What are the studies using ") and enable Deep mode. **Verified:** pill click → template in box + Deep switch on + input focused.

### ISSUE-002 — MEDIUM — Hero search bar missing "Sources" selector
Live consensus.app (Jan 2026 SSR) has `data-source-selector-button` (Sources dropdown) + `corpus-selector-button` (Corpus) + Deep switch. Clone only had an "All research" corpus dropdown.
**Fix:** Two-row search box matching the real app: multiline textarea (maxLength 10000) on top; Sources dropdown (All sources/PubMed/arXiv/bioRxiv/medRxiv), Corpus dropdown (All papers/Medical), Deep as `role="switch"` (disabled until query), Filter + submit on the right. Verified all controls render with matching data-testids.

### ISSUE-003 — LOW — Title/metadata stale
Clone title was "Consensus — AI Academic Search"; live app is "Consensus: AI for Research" with the "research OS" description.
**Fix:** Updated `app/layout.tsx` metadata. **Verified:** browser title = "Consensus: AI for Research".

### ISSUE-004 — LOW — Sidebar default state
Real app starts with sidebar **collapsed** (logo + "Open sidebar" button); clone started expanded.
**Fix:** Default `sidebarCollapsed = true`; collapsed state now shows logo + Open sidebar button only (matches `sidebar-container` / `open-sidebar-button` testids). **Verified:** expand/collapse works, full sidebar (New Thread, Home, Research starts here, RECENT, Sign in/Sign up) appears on expand.

### ISSUE-005 — LOW — Help button inert
Clone's Help button did nothing; real app has an "Open support chat" affordance.
**Fix:** Now an `<a>` to help.consensus.app with `aria-label="Open support chat"`. **Verified:** renders as link.

## Deferred

- **Filter button (hero)** is a no-op on the landing view — real consensus.app opens the filter panel from it. The clone's filter sidebar is always visible on results, so impact is minor. Worth wiring to a drawer on mobile.
- **Mobile responsiveness** — clone is desktop-first (no responsive breakpoints); real app collapses the sidebar on small screens. Flagged as scope for a follow-up.
- **Auth** — Sign in / Sign up buttons are present but not wired to a real auth backend (expected for a static clone).

## Evidence

- Screenshots: `.gstack/qa-reports/screenshots/landing-after-fix.png`, `results-after-fix.png`
- Reference: live SSR at consensus.app/search/ + Wayback snapshots 20250601, 20251226, 20260101
