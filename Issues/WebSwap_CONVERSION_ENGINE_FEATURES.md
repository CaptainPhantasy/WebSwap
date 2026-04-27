# WebSwap Conversion Engine Feature Plan

**Created:** 2026-04-27
**Status:** Active implementation plan

## Goal

Wire WebSwap's latent systems into the current conversion-engine product goal: scrape a client site, classify it, recommend three templates, generate client-specific static sites up to twelve pages deep, compute truthful metrics, and export a design-system handoff.

## Active Feature Set

| Feature | Source Systems | Implementation Requirement |
|---|---|---|
| Export DOM/CSS alignment | `src/render.tsx`, `src/templateEngine.ts` | Exported HTML must contain selectors styled by generated CSS. |
| Template-specific design systems | `src/templates.ts`, `src/templateEngine.ts` | Template metadata must affect output beyond colors/fonts. |
| Three template recommendations | `src/pageClassifier.ts`, `src/templates.ts` | Return exactly three ranked recommendations with source-backed reasons. |
| Multi-page generation | `src/pageClassifier.ts`, `src/blueprint.ts`, `src/localBuilder.ts` | Use classified source pages; cap output at twelve pages. |
| Truthful metrics | `src/localBuilder.ts`, scrape/build data | Replace hardcoded values with computed metrics. |
| Proof and CTA signal usage | `src/scraper.ts`, `src/localBuilder.ts` | Use scraped CTAs, contacts, and socials in sections/suggestions. |
| Design-system handoff | `src/templates.ts`, export zip | Include a design-system artifact in generated exports. |

## Verification Targets

- Tests fail before implementation if features are absent.
- Tests pass after wiring features.
- `npm run lint`, `npm test`, `npm run build`, and governance verification pass before completion.
