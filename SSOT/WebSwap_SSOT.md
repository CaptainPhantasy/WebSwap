# WebSwap SSOT — Client Conversion Engine

**Created:** 2026-04-27
**Governance:** .supercache/ v1.5.0
**Status:** Active refactor toward robust near-autonomous website conversion engine

---

## Authority

This document is the single source of truth for WebSwap's current product goal, architecture, activation plan, and verification requirements. Superseded lesser-goal documents have been quarantined under `Issues/quarantine/2026-04-27-lesser-goal/` with `.DEL` extensions.

---

## Current Goal

WebSwap exists to create a private, high-leverage client website conversion engine for Legacy AI operations.

The operator should be able to point WebSwap at a client's existing public website and receive:

1. A scrape-backed understanding of the current site.
2. Three client-specific template recommendations with evidence-backed reasons.
3. A polished static website generated from the client's actual content and images.
4. Up to twelve generated pages when the source site contains enough useful page inventory.
5. A design-system output suitable for handoff to another agent for final edits and deployment.
6. Truthful metrics that describe scrape quality, content coverage, conversion readiness, visual asset strength, and export completeness.

The smaller demo-generator framing is obsolete.

---

## Capability Contract

| Capability | Required Behavior | Current Implementation State | Activation Work |
|---|---|---|---|
| Public site intake | Fetch only public HTTP(S), reject private/unsupported targets, cap crawl scope. | `src/scraper.ts` implements guarded fetch/extraction. | Preserve SSRF boundary while improving page discovery. |
| Content extraction | Extract headings, paragraphs, CTAs, nav, images, brand colors/fonts, contact paths, socials. | Scraper already extracts these signals. | Feed more extracted signals into builder, metrics, and design handoff. |
| Business classification | Determine business category from full site text and paths. | `src/pageClassifier.ts` classifies service, hospitality, retail, creative, SaaS, and more. | Use category for recommendations and page strategy. |
| Page classification | Label source pages and route page types. | `classifyPages()` supports many labels; builder uses too little of it. | Generate richer page plans up to twelve pages. |
| Template recommendation | Recommend three templates for the specific client. | Templates expose `bestFor[]`; classifier exists; bridge missing. | Add deterministic ranking and UI/API entry point. |
| Template design system | Template choice must materially change exported design. | Template metadata exists; CSS variation is too shallow. | Activate template-specific CSS and design-system output. |
| Static export | Export browser-ready HTML/CSS. | Export exists but DOM/CSS alignment needs cutover. | Align markup and stylesheet contract. |
| Metrics | Show truthful computed build metrics. | Some metrics are hardcoded. | Compute from scrape/build data. |
| Agent handoff | Provide design-system guidance for final deployment edits. | Template `layoutDNA` exists. | Include design-system artifact in export. |

---

## Implementation Order

1. Quarantine lesser-goal documentation and replace canonical docs with current conversion-engine goal.
2. Add failing regression coverage for export DOM/CSS alignment, template CSS variation, recommendations, metrics, and page depth.
3. Align export HTML and CSS into one canonical structure.
4. Activate template-specific CSS and design-system output.
5. Add template recommendations from classifier + template metadata.
6. Expand deterministic page planning up to twelve pages from classified source pages.
7. Replace hardcoded metrics with computed metrics.
8. Improve image selection and proof signal usage.
9. Consolidate preview/export rendering seams where safe.
10. Run full verification.

---

## Non-Negotiable Invariants

- Do not bypass `assertPublicHost()` for any outbound fetch or redirect.
- Do not invent client facts, URLs, contacts, credentials, testimonials, or claims.
- Escape every user-originated string inserted into exported HTML.
- Do not keep compatibility shims for the obsolete lesser-goal model.
- Do not claim metrics that are not computed from source/build data.
- Do not expose provider keys or internal model/runtime details in client-facing output.

---

## Verification Requirements

A change is not complete until these pass:

```bash
npm run lint
npm test
npm run build
bash /Volumes/SanDisk1Tb/.supercache/bootstrap.sh --verify /Volumes/SanDisk1Tb/WebSwap
```

Additional regression expectations:

- Exported HTML contains selectors used by generated CSS.
- At least three templates emit materially different CSS beyond palette variables.
- Template recommendations return exactly three ranked options with evidence-backed reasons.
- Builder can generate more than three pages when source inventory supports it, capped at twelve.
- Metrics change when scrape content changes.
- Export README/design-system output reflects generated pages and template design system.

---

## Change Log

- 2026-04-27 — Replaced obsolete lesser-goal SSOT with conversion-engine SSOT and defined activation path for latent features.
