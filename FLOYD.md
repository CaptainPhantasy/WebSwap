# WebSwap — FLOYD.md

**Version:** 2.0.0
**Initialized:** 2026-04-25T20:30:32-0400
**Governance:** .supercache/ v1.5.0
**Port:** 10337 (claimed in `/Volumes/SanDisk1Tb/SSOT/port-registry.json`)
**Drive:** SanDisk1Tb
**Path:** /Volumes/SanDisk1Tb/WebSwap

---

## Agent Contract

You are working on **WebSwap**, a Legacy AI project.

This file is the canonical project spec. It is authoritative for project identity, stack, ports, build commands, environment variables, and project-specific rules. Agents must read this file first, then read `SSOT/WebSwap_SSOT.md` and `Issues/WebSwap_ISSUES.md` before non-trivial work.

### Governance Location

```
.supercache/ → /Volumes/SanDisk1Tb/.supercache
```

This directory is read-only for agents.

### Where You Write

| Location | Purpose |
|---|---|
| `SSOT/` | Project truth, active capability contract, verification records |
| `Issues/` | Bugs, blockers, tasks, recovered inventories, quarantined superseded docs |
| `.floyd/` | Agent working state and ephemeral runtime cache |
| Project source files | Application code and governed repo config |

### Where You Do NOT Write

| Location | Reason |
|---|---|
| `.supercache/` | Global governance, read-only |
| `.vscode/` | Local editor/session state |
| `dist/` | Generated build output |

---

## Project Identity

| Field | Value |
|---|---|
| **Name** | WebSwap |
| **Purpose** | Near-autonomous client website conversion engine: crawl an existing client site, extract content/images/brand signals, recommend three client-specific design templates, generate polished multi-page static sites up to twelve pages deep when source content supports it, and export both ready-to-ship HTML/CSS and design-system guidance for agent-assisted final deployment. |
| **Primary Language** | TypeScript (ES2022) |
| **Runtime** | Node.js server with Vite-bundled browser frontend |
| **Module System** | ESM |
| **Framework** | Express 4 API host + Vite 6 + React 19 frontend |
| **Database** | None |
| **Port** | **10337** — claimed in `/Volumes/SanDisk1Tb/SSOT/port-registry.json` |
| **Repository** | `github.com/CaptainPhantasy/WebSwap` |
| **Current Phase** | Active refactor toward robust conversion engine |

---

## Current Product Contract

WebSwap must support this operator flow:

1. Operator enters a client website URL.
2. WebSwap fetches only public HTTP(S) pages through the SSRF guard.
3. WebSwap extracts content, images, CTAs, brand tokens, contact paths, social proof, and page signals.
4. WebSwap classifies the business and page inventory.
5. WebSwap recommends three templates specifically suited to that client.
6. WebSwap generates a static site using scraped truth, not invented client facts.
7. WebSwap generates as many pages as the source content justifies, capped at twelve.
8. WebSwap exports ready-to-ship HTML/CSS plus a design-system handoff for final agent refinement.
9. WebSwap reports truthful build metrics computed from scrape/build data.

---

## Project Structure

```
WebSwap/
├── server.ts                    # Express API host and Vite integration
├── src/                         # Frontend and shared app modules
│   ├── App.tsx                  # UI: scrape, recommend templates, preview/export/dashboard
│   ├── scraper.ts               # Crawl logic, SSRF guard, and brand/content extraction
│   ├── pageClassifier.ts        # Business and page classification
│   ├── templates.ts             # Twelve design template specifications
│   ├── templateEngine.ts        # Template-driven CSS/design-system generation
│   ├── localBuilder.ts          # Deterministic redesign/site builder
│   ├── render.tsx               # React preview and static HTML/CSS export builder
│   ├── siteSummary.ts           # Compact scrape summary for UI/model use
│   ├── blueprint.ts             # Build blueprint schema/fallback
│   ├── types.ts                 # Shared data contracts
│   ├── main.tsx                 # React bootstrap
│   └── index.css                # Tailwind-driven app styles
├── tests/                       # Executable regression coverage
├── metadata.json                # Project metadata for external surfaces
├── package.json                 # npm scripts and dependency manifest
├── package-lock.json            # Locked dependency graph
├── tsconfig.json                # TypeScript compiler settings
├── vite.config.ts               # Vite, React, and Tailwind configuration
├── .env.example                 # Environment variable template
├── README.md                    # Public project overview and usage
├── FLOYD.md                     # Canonical project governance spec
├── SSOT/
│   └── WebSwap_SSOT.md          # Current conversion-engine truth
├── Issues/
│   ├── WebSwap_ISSUES.md        # Issue and blocker ledger
│   └── quarantine/              # Superseded lesser-goal docs with .DEL extensions
└── .floyd/                      # Agent runtime state
```

---

## Build & Verify Commands

| Action | Command | Expected Result |
|---|---|---|
| **Type check** | `npm run lint` | Exit 0, no TypeScript errors |
| **Build** | `npm run build` | Exit 0, client bundle written to `dist/` |
| **Test** | `npm test` | Exit 0, smoke + workspace + HTTP tests pass |
| **Start** | `PORT=10337 npm run start` | Service up on port 10337 |
| **Dev** | `PORT=10337 npm run dev` | Live reload active on port 10337 |

Verification sequence after any change:

```bash
npm run lint && npm test && npm run build && bash /Volumes/SanDisk1Tb/.supercache/bootstrap.sh --verify /Volumes/SanDisk1Tb/WebSwap
```

---

## Port Allocation

| Port | Service | Status |
|---|---|---|
| **10337** | Express + Vite HTTP server | **CLAIMED** in `port-registry.json` |

Do not change the port without explicit approval.

---

## Project-Specific Rules

| # | Rule | Rationale |
|---|---|---|
| R1 | Any outbound site fetch or redirect hop must pass through `assertPublicHost()` before network I/O. | `src/scraper.ts` is the SSRF boundary; bypassing it can hit loopback, RFC1918, metadata, or unsupported protocols. |
| R2 | Any user-originated string inserted into exported HTML must be escaped with `esc()` before interpolation. | Static exports are built as raw HTML strings in `src/render.tsx`; unescaped content becomes an injection bug. |
| R3 | `PORTKEY_API_KEY` remains server-side only and must never be surfaced in the browser bundle or client storage. | The Portkey credential is the only secret in this app; leaking it is an immediate security incident. |
| R4 | Client-ready claims must be backed by scrape/build evidence. | Hardcoded quality scores or invented client facts create false confidence and break trust. |
| R5 | Template recommendation must be explainable from scraped evidence and template metadata. | The operator needs a defensible reason for the three recommended options. |
| R6 | The canonical product goal is the conversion engine, not a small redesign demo. | Superseded lesser-goal docs are quarantined under `Issues/quarantine/` with `.DEL` extensions. |

---

## Known Patterns & Lessons

| Pattern | Trigger | Fix | Confidence |
|---|---|---|---|
| `ssrf-guard-first` | Adding a new fetch path or redirect handling path | Route it through `assertPublicHost()` and keep the redirect loop inside `safeFetchHtml()`. | 1.0 |
| `escaped-static-export` | Inserting new fields into `sectionHTML()` or `pageHTML()` | Wrap every user-originated string with `esc()` before writing it into exported markup. | 1.0 |
| `claimed-port-dev` | Starting local dev or test servers | Use port 10337 for app runtime and confirm the global claim before changing port assumptions. | 1.0 |
| `truthful-conversion-metrics` | Adding dashboard/export scores | Compute from scraped pages, assets, CTAs, contact signals, classification, and export completeness. | 1.0 |
| `template-recommendation-evidence` | Ranking templates | Use classifier category, page labels, template `bestFor[]`, mood, and content density. | 1.0 |

---

## Environment Variables

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `PORTKEY_API_KEY` | Yes for model-assisted blueprinting | Portkey AI Gateway credential | `pk-...` |
| `PORT` | No | Override HTTP server port; defaults to 10337 | `10337` |
| `REDESIGN_MODEL` | No | Set to `local` for deterministic-only builds | `local` |
| `DISABLE_HMR` | No | Disable Vite HMR in constrained sandboxes | `true` |

---

## Execution Contract

Before claiming any task complete, provide:

1. Exact action taken.
2. Direct evidence: file path + line, command + output, diff, or screenshot.
3. Verification result: build pass, test pass, linter clean, or equivalent.
4. Status only after proof.
