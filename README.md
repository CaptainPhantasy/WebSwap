# SiteReimaginer AI

Paste a URL, let the app scrape the real site (copy, images, brand tokens, nav), then
pick one of 12 high-level designer templates. Claude Opus 4.7 produces a **3-page
demo site** you can show a client — real content, real imagery, real aesthetic
direction. After the client picks a direction, you already know exactly which
palette, typography, and layout DNA to build the final site against.

## What changed vs. the AI Studio handoff

- **Anthropic, not Google.** Swapped `@google/genai` → `@anthropic-ai/sdk`. Model is
  `claude-opus-4-7` with adaptive thinking + `xhigh` effort, structured JSON output.
- **Server-side key.** `ANTHROPIC_API_KEY` never leaves the Express host — no more
  inlining via `vite.config.ts`.
- **Flow reversed.** Scrape first → review what we found → then pick the template.
  The client's design choice is informed by what's actually on the site.
- **12 templates** with full aesthetic specs (palette, type pair, layout DNA, mood,
  best-fit industries). See `src/templates.ts`.
- **3-page demo output.** Home + secondary + conversion page, each structurally
  distinct, ready to export as a static zip (`index.html`, `page-2.html`,
  `page-3.html`, shared `styles.css`).
- **Hardened scraper.** SSRF guard (blocks RFC1918 / loopback / link-local / IPv6
  private), 10 s per-request timeout, HTML-only content-type check, 2 MB max body,
  manual redirect loop with bounded hops.

## Run Locally

### Prerequisites

- Node.js 20+
- An Anthropic API key (`sk-ant-…`)

### Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste your ANTHROPIC_API_KEY
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Script          | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Start Express + Vite middleware (hot reload)  |
| `npm run build` | Production build via `vite build` → `dist/`   |
| `npm run start` | Run the Express host against `dist/`          |
| `npm run lint`  | TypeScript typecheck (`tsc --noEmit`)         |

### API surface

| Method | Path              | Purpose                                                |
| ------ | ----------------- | ------------------------------------------------------ |
| GET    | `/api/health`     | Health + model + template count                        |
| GET    | `/api/templates`  | List all 12 designer templates                         |
| POST   | `/api/scrape`     | `{ url }` → `{ site }` (pages, images, brand tokens)  |
| POST   | `/api/redesign`   | `{ site, templateId }` → `{ redesign }` (3-page plan) |

## Project Structure

```
server.ts           Express host, scraper, /api/redesign → Claude Opus 4.7
src/
  App.tsx           3-stage flow (scrape → pick template → preview 3 pages)
  render.tsx        React preview + static HTML/CSS export
  templates.ts      12 high-level designer templates
  types.ts          Shared types (ScrapedSite, Redesign, DesignTemplate)
  main.tsx          React bootstrap
  index.css         Tailwind entry + fonts
```

## Security

- API key lives only in `process.env.ANTHROPIC_API_KEY` inside the Node process.
- Scraper rejects any URL that resolves to a private IP (RFC1918, loopback,
  link-local, IPv6 unique-local/link-local, CGNAT) before fetching.
- Only `text/html` responses are accepted. Max 2 MB body, 10 s per-request.
- Redirects are followed manually, each hop re-checked for SSRF. Max 3 hops.

## Notes

- Image URLs in the demo point at the original site. For a real deliverable,
  download and re-host them — the export README.txt calls this out.
- "Mini-CMS" edit mode from the prototype has been removed for now; add it back
  as a `PATCH /api/redesign/sections` endpoint once persistence is wired.
