# WebSwap SSOT (Single Source of Truth)
**Created:** 2026-04-25T20:30:32-0400
**Last Updated:** 2026-04-25 20:32 EDT
**Governance:** .supercache/ v1.4.1

---

## Authority

This document is the **single source of truth** for architecture and programmatic change facts of WebSwap. All other documents are treated as **potentially flawed** unless their facts are confirmed here.

When a fact in any other document contradicts this SSOT, the SSOT wins. If the SSOT itself is wrong, it is corrected via the Verification Sweep Protocol, not by editing other documents to match.

---

## Verification Sweep Protocol (required on every read)

When an agent reads this SSOT to perform a task:

1. Perform a **line-by-line verification review** of the sections relevant to the current task.
2. For each verified fact, append a verification entry to the **Verification Log** at the bottom of this file with:
   - Timestamp (`YYYY-MM-DD HH:MM TZ`)
   - Section/line reference
   - Evidence source (code path + line, command + output, build log, runtime behavior, etc.)
   - Confidence = 100%
3. If any fact cannot be verified to 100% confidence:
   - Mark it **UNVERIFIED** inline in the section where it appears
   - Add an entry to `Issues/WebSwap_ISSUES.md` to track the discrepancy
   - Do NOT proceed on the assumption that the fact is true

### Positive Reinforcement (required)

For each fact verified at 100% confidence during a sweep, emit the acknowledgement:

```
Verified as fact (100%): <fact summary>
```

This pattern is deliberate — it reinforces evidence-first thinking and makes the verification record auditable after the fact.

---

## Current State

**Phase:** Active development
**Status:** Active
**Last Agent Session:** 2026-04-25 20:32 EDT

---

## Architecture Facts

### Stack

- **Primary language**: TypeScript (ES2022)
- **Framework**: Express 4 API host with Vite 6 + React 19 frontend
- **Runtime**: Node.js server with browser-rendered frontend
- **Module system**: ESM with Vite bundler module resolution

### Key architectural choices

- A single `server.ts` process hosts the JSON API and attaches Vite middleware in dev or serves the static client bundle in production.
- Site intake is constrained by `src/scraper.ts`: up to five priority pages, redirect-limited fetches, DNS/IP SSRF guards, and capped response sizes before content is turned into structured site data.
- Export generation lives in `src/render.tsx`, which renders previews in React and builds a static multi-page HTML/CSS zip with escaped user-originated strings.

---

## Key Decisions

| Date | Decision | Rationale | Decided By |
|---|---|---|---|
| 2026-04-25 20:32 EDT | Claimed port 10337 and aligned runtime/docs away from forbidden port 3000. | Governance forbids port 3000 and requires every bound port to be claimed and documented. | Claude |
| 2026-04-25 20:32 EDT | Removed underlying model/runtime references from public repo surfaces while preserving internal implementation details. | Public-facing docs and metadata must not disclose the underlying runtime powering Floyd. | Claude |

---

## Dependencies

| Dependency | Version | Purpose | Criticality |
|---|---|---|---|
| `express` | `^4.21.2` | API host and middleware pipeline | critical |
| `react` | `^19.0.0` | Browser UI and preview rendering | critical |
| `vite` | `^6.2.0` | Frontend bundling and dev middleware | critical |
| `cheerio` | `^1.2.0` | HTML parsing during site intake | supporting |
| `jszip` | `^3.10.1` | Static export zip generation | supporting |
| `@anthropic-ai/sdk` | `^0.88.0` | Server-side redesign provider client | critical |

---

## Deployment

| Environment | URL / Location | Status | Last Deploy |
|---|---|---|---|
| production | Not deployed | N/A | N/A |
| staging | Not deployed | N/A | N/A |
| local | `http://localhost:10337` | active dev | N/A |

---

## Known Patterns & Lessons

| Pattern | Trigger | Fix | Confidence |
|---|---|---|---|
| `ssrf-guard-first` | Adding a new outbound fetch or redirect path | Route it through `assertPublicHost()` before network I/O and keep redirect handling inside `safeFetchHtml()`. | 1.0 |
| `escaped-demo-export` | Adding a new user-originated field to exported HTML | Escape it with `esc()` before interpolating into `sectionHTML()` or `pageHTML()`. | 1.0 |
| `claimed-port-dev` | Starting local app processes | Keep runtime assumptions on port 10337 and update the global claim before changing ports. | 1.0 |

---

## Verification Log (append-only)

Every sweep of this SSOT must append one or more entries here. Never edit or remove existing entries.

| Timestamp | Section / Line | Fact Verified | Evidence Source | Confidence |
|---|---|---|---|---|
| 2026-04-25T20:30:32-0400 | Authority | Document initialized as SSOT | `bootstrap.sh --init` created from template | 100% |
| 2026-04-25 20:32 EDT | Current State | Repo is in active development on claimed port 10337 | `server.ts:17`; `port-registry.json:88-91`; `git status --short --branch` | 100% |
| 2026-04-25 20:32 EDT | Architecture Facts / Stack | TypeScript ESM stack uses Express 4, Vite 6, and React 19 | `package.json:1-45`; `tsconfig.json:2-25`; `vite.config.ts:1-18` | 100% |
| 2026-04-25 20:32 EDT | Architecture Facts / Scraping | SSRF guard blocks private addresses before each fetch/redirect hop | `src/scraper.ts:45-72`; `tests/http.ts:115-137` | 100% |
| 2026-04-25 20:32 EDT | Architecture Facts / Export | Static export escapes user-originated strings before building HTML | `src/render.tsx:419-427`; `src/render.tsx:523-560` | 100% |
| 2026-04-25 20:32 EDT | Deployment | Repo remote is `github.com/CaptainPhantasy/WebSwap` and local development target is `http://localhost:10337` | `gh repo view CaptainPhantasy/WebSwap`; `server.ts:17`; `port-registry.json:88-91` | 100% |

---

## Change Log (append-only)

- 2026-04-25T20:30:32-0400 — Initialized SSOT.
- 2026-04-25 20:32 EDT — Replaced template placeholders with verified stack, port, deployment, and invariant facts.
