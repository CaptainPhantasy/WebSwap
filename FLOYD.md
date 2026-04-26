# WebSwap — FLOYD.md
**Version:** 1.4.1
**Initialized:** 2026-04-25T20:30:32-0400
**Governance:** .supercache/ v1.4.1
**Port:** 10337 (claimed in `/Volumes/SanDisk1Tb/SSOT/port-registry.json`)
**Drive:** SanDisk1Tb
**Path:** /Volumes/SanDisk1Tb/WebSwap

---

## Agent Contract

You are working on **WebSwap**, a Legacy AI project.

**This file (`FLOYD.md`) is the canonical project spec.** It is authoritative for project identity, stack, ports, build commands, environment variables, and project-specific rules. All agents read this file first.

### Before You Start
1. Read this file completely. Do not skim. Every section constrains your behavior.
2. **If you are Claude Code**: also read `CLAUDE.md` if it exists at the project root. This repo is compliant without one.
3. Read `.supercache/READONLY` — you MUST NOT write to `.supercache/`.
4. Read `SSOT/WebSwap_SSOT.md` for current project state. Perform the Verification Sweep Protocol for sections relevant to your task.
5. Read `Issues/WebSwap_ISSUES.md` for open issues and blockers.
6. Read `.supercache/manifests/port-allocation-policy.yaml` — NEVER use port 3000 or any other forbidden port. This project uses port **10337**.
7. Read `.supercache/contracts/execution-contract.md` — this governs how you prove your work.
8. Read `.supercache/contracts/repo-structure.md` — canonical layout for this TypeScript/Node project.
9. Read `.supercache/contracts/git-discipline.md` — pre-commit checklist, commit message standards, secret hygiene, and reputation guardrails.
10. Read `.supercache/contracts/document-management.md` — Anti-Cruft Rule, canonical document homes, SSOT verification sweep, reference materials tier.
11. Read `.supercache/contracts/repo-hygiene.md` — `.gitignore` baseline, cleanup triggers, and project root tidiness standards.
12. Read `.supercache/manifests/model-routing.yaml` — this tells you which LLM tier to use for what.

### Governance Location
```
.supercache/ → /Volumes/SanDisk1Tb/.supercache
```
This directory contains global templates, contracts, manifests, and routing config. It is **READ-ONLY**.

### Where You Write

| Location             | Purpose                                           | Example                                          |
|----------------------|---------------------------------------------------|--------------------------------------------------|
| `SSOT/`              | Project status, decisions, findings, verification | `SSOT/WebSwap_SSOT.md`                           |
| `Issues/`            | Bugs, blockers, tasks, help-desk ledger           | `Issues/WebSwap_ISSUES.md`                       |
| `.floyd/`            | Agent working state, session logs, runtime cache  | `.floyd/agent_log.jsonl`                         |
| Project source files | Application code and governed repo config         | `server.ts`, `src/*`, `README.md`, `.gitignore` |

### Where You Do NOT Write

| Location    | Reason                                                         |
|-------------|----------------------------------------------------------------|
| `.supercache/` | Global governance — READ-ONLY for all agents                |
| `.vscode/`  | Local editor/session state; do not commit personal workspace files |
| `dist/`     | Generated build output; rebuild it instead of hand-editing     |

---

## Project Identity

| Field                | Value |
|----------------------|-------|
| **Name**             | WebSwap |
| **Purpose**          | Crawl an existing marketing site, extract its brand/content signals, and generate a three-page redesign demo plus exportable static HTML. |
| **Primary Language** | TypeScript (ES2022) |
| **Runtime**          | Node.js server with Vite-bundled browser frontend |
| **Module System**    | ESM |
| **Framework**        | Express 4 API host + Vite 6 + React 19 frontend |
| **Database**         | None |
| **Port**             | **10337** — claimed in `/Volumes/SanDisk1Tb/SSOT/port-registry.json` |
| **Repository**       | `github.com/CaptainPhantasy/WebSwap` |
| **Current Phase**    | Active development |

---

## Project Structure

```
WebSwap/
├── server.ts                    # Express API host and Vite integration
├── src/                         # Frontend and shared app modules
│   ├── App.tsx                  # Three-stage UI: scrape, choose, preview/export
│   ├── scraper.ts               # Crawl logic, SSRF guard, and brand/content extraction
│   ├── templates.ts             # Twelve design template specifications
│   ├── render.tsx               # React preview and static HTML/CSS export builder
│   ├── types.ts                 # Shared data contracts
│   ├── main.tsx                 # React bootstrap
│   └── index.css                # Tailwind-driven app styles
├── tests/                       # Executable regression coverage
│   ├── smoke.ts                 # Unit/render/export checks
│   └── http.ts                  # Express endpoint integration checks
├── metadata.json                # Project metadata for external surfaces
├── package.json                 # npm scripts and dependency manifest
├── package-lock.json            # Locked dependency graph
├── tsconfig.json                # TypeScript compiler settings
├── vite.config.ts               # Vite, React, and Tailwind configuration
├── .env.example                 # Environment variable template
├── README.md                    # Public project overview and usage
├── FLOYD.md                     # Canonical project governance spec
├── SSOT/
│   └── WebSwap_SSOT.md          # Verified architecture and operating facts
├── Issues/
│   └── WebSwap_ISSUES.md        # Issue and blocker ledger
└── .floyd/
    ├── .supercache_version      # Governance version pin
    └── agent_log.jsonl          # Session activity log
```

---

## Build & Verify Commands

| Action         | Command                                                     | Expected Result |
|----------------|-------------------------------------------------------------|-----------------|
| **Type check** | `npm run lint`                                              | Exit 0, no TypeScript errors |
| **Build**      | `npm run build`                                             | Exit 0, client bundle written to `dist/` |
| **Test**       | `npm test`                                                  | Exit 0, all smoke + HTTP tests pass |
| **Lint**       | `N/A`                                                       | N/A — this repo uses `npm run lint` as its TypeScript no-emit gate |
| **Start**      | `PORT=10337 npm run start`                                  | Service up on port 10337 |
| **Dev**        | `PORT=10337 npm run dev`                                    | Live reload active on port 10337 |

### Verification sequence after any change:
```bash
npm run lint && npm test && npm run build && bash /Volumes/SanDisk1Tb/.supercache/bootstrap.sh --verify /Volumes/SanDisk1Tb/WebSwap
```

---

## Port Allocation

| Port        | Service                            | Status |
|-------------|------------------------------------|--------|
| **10337**   | Express + Vite HTTP server         | **CLAIMED** in `port-registry.json` |

**Rules:**
- This project runs on port **10337**. That port is claimed in `/Volumes/SanDisk1Tb/SSOT/port-registry.json`.
- Do not change the port without Douglas Talley's explicit approval.
- Do not bind to any port in the forbidden list from `.supercache/manifests/port-allocation-policy.yaml`.
- Verify before starting: `lsof -i :10337` — if something else is bound, investigate before killing.

---

## Project-Specific Rules

| #  | Rule | Rationale |
|----|------|-----------|
| R1 | Any outbound site fetch or redirect hop must pass through `assertPublicHost()` before network I/O. | `src/scraper.ts` is the SSRF boundary; bypassing it can hit loopback, RFC1918, metadata, or unsupported protocols. |
| R2 | Any user-originated string inserted into exported HTML must be escaped with `esc()` before interpolation. | Static demo exports are built as raw HTML strings in `src/render.tsx`; unescaped content becomes an injection bug. |
| R3 | `ANTHROPIC_API_KEY` remains server-side only and must never be surfaced in the browser bundle or client storage. | The redesign provider credential is the only secret in this app; leaking it is an immediate security incident. |

---

## Known Patterns & Lessons

| Pattern | Trigger | Fix | Confidence |
|---------|---------|-----|------------|
| `ssrf-guard-first` | Adding a new fetch path or redirect handling path | Route it through `assertPublicHost()` and keep the redirect loop inside `safeFetchHtml()`. | 1.0 |
| `escaped-demo-export` | Inserting new fields into `sectionHTML()` or `pageHTML()` | Wrap every user-originated string with `esc()` before writing it into exported markup. | 1.0 |
| `claimed-port-dev` | Starting local dev or test servers | Use port 10337 for app runtime, and confirm the global claim before changing any port assumptions. | 1.0 |

---

## Environment Variables

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | Server-side redesign API credential | `sk-ant-...` |
| `PORT` | No | Override the HTTP server port; defaults to 10337 | `10337` |
| `DISABLE_HMR` | No | Disable Vite HMR in constrained sandboxes | `true` |

---

## Execution Contract

Before claiming any task complete, provide:

1. **Exact action taken** — what you did, specifically
2. **Direct evidence** — file path + line, command + output, diff, or screenshot
3. **Verification result** — run the verification sequence above, all must exit 0
4. **Status** — mark COMPLETE only after steps 1-3 are proven

See `.supercache/contracts/execution-contract.md` for the full contract.