<p align="center">
  <img src="https://repository-images.githubusercontent.com/1218644799/98367d5d-e916-4381-ac10-d93e31293d15" alt="WebSwap — client site conversion engine" width="100%" />
</p>

# WebSwap

WebSwap is a private client-site conversion engine for rapidly producing polished, ready-to-ship website options from an existing public website.

Drop in a client URL. WebSwap scrapes the site's content, images, CTAs, contact paths, visual signals, and page structure. It classifies the business, recommends three fitting design templates, builds a static site from the client's real source material, and exports HTML/CSS plus design-system guidance for final agent-assisted deployment.

The goal is speed without generic output: client-specific sites, professional design systems, and a handoff path that turns a current website into deployable redesign options with minimal manual discovery.

---

## What it does

### 1. Reads the client's real public site

WebSwap crawls public HTTP(S) pages through an SSRF guard. It extracts headings, paragraphs, nav, CTAs, OG tags, hero/content images, logos, detected colors and fonts, emails, phone numbers, and social links.

### 2. Understands the business and page inventory

The page classifier identifies the business category and labels source pages such as services, products, menu, events, gallery, team, FAQ, pricing, locations, booking, and contact.

### 3. Recommends three design directions

Templates include palettes, typography, mood, layout DNA, and best-fit industries. WebSwap ranks templates against the scraped business and content signals so the operator starts with client-specific choices instead of a generic catalog.

### 4. Builds a multi-page static site

The deterministic builder creates generated pages from source-backed content. Rich source sites can produce deeper exports, capped at twelve pages, while thinner sites stay appropriately compact.

### 5. Exports a handoff-ready package

The export includes browser-ready HTML/CSS and design-system guidance so another agent can make final minor edits and prepare deployment.

---

## Install

```bash
npm install
cp .env.example .env.local
PORT=10337 npm run dev
```

The app runs on the governed project port: `http://localhost:10337`.

---

## Architecture

- **Frontend:** React 19, Vite 6, Tailwind 4, Motion, Recharts.
- **Server:** Express 4 with Vite middleware in dev and static serving in production.
- **Scrape:** Cheerio and guarded fetch with DNS/IP SSRF protection.
- **Classification:** Business and page classification from scraped content and paths.
- **Build:** Deterministic local site generation, optionally guided by a compact typed model blueprint.
- **Export:** Static HTML/CSS zip with escaped user-originated strings.

---

## Commands

```bash
npm run lint
npm test
npm run build
PORT=10337 npm run dev
```

Full governed verification:

```bash
npm run lint && npm test && npm run build && bash /Volumes/SanDisk1Tb/.supercache/bootstrap.sh --verify /Volumes/SanDisk1Tb/WebSwap
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Runtime health and template count |
| GET | `/api/templates` | Template catalog |
| POST | `/api/scrape` | Create workspace and scrape summary from `{ url }` |
| POST | `/api/workspaces/:workspaceId/build` | Build generated site for selected template |
| GET | `/api/jobs/:jobId` | Poll build status |
| GET | `/api/workspaces/:workspaceId/export.zip` | Download static export |

---

## Shipped by

**Floyd's Labs** · built with **Floyd**.
