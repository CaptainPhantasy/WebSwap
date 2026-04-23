<p align="center">
  <img src="https://repository-images.githubusercontent.com/1218644799/98367d5d-e916-4381-ac10-d93e31293d15" alt="WebSwap — Drop in a URL. Same content, hotter design." width="100%" />
</p>

# WebSwap

**She's the same. Just hotter.**

Paste a URL. WebSwap reads the actual site — copy, images, brand tokens, the parts that were already working. You pick one of twelve design directions. Claude Opus 4.7 rebuilds it as a real three-page demo, with the real content, in the new look.

You hand the demo to the client. They point at the one they like. The design phase is over.

---

## Install

```bash
npm install
cp .env.example .env.local     # put your ANTHROPIC_API_KEY in it
npm run dev                    # http://localhost:3000
```

That's the whole setup.

---

## What it does

### Read
Up to five pages of the source site, prioritized by the paths that actually matter: `/`, `/about`, `/services`, `/products`, `/work`, `/contact`. Pulls headings, paragraphs, navigation, calls-to-action, OG tags, hero images, logos, detected brand colors and fonts, contact emails, phone numbers, social links.

Refuses to touch anything resolving to a private address. Cloud metadata endpoints, loopback, RFC1918, link-local — blocked at resolution, before a byte leaves the box.

### Offer
Twelve design directions. Each one is a full specification, not a mood word.

| | |
| --- | --- |
| Editorial Serif | Magazine-grade negative space. Drop caps. |
| Dark Luxury Monolith | Black canvas. Hairlines. Restrained gold. |
| Brutalist Grid | Numbered sections. Unexpected rotations. |
| Warm Organic | Terracotta and sage. Italic Fraunces. |
| Atmospheric Glass | Indigo gradients. Frosted cards. |
| Clean Utility | White. Dense. Institutional. |
| Oversized Typographic | Headlines at 16vw. One accent, three times. |
| Bold Color Monolith | One color. Saturates the whole page. |
| SaaS Split | 50/50. Gradient accents. Conversion-shaped. |
| Prestige Hospitality | Off-white. Italic ligatures. Deep emerald. |
| Technical Data Grid | Monospace. Terminal green. Status dots. |
| Sculptural Minimal | Ink on bone. One statement per screen. |

### Build
Three pages, each structurally distinct. Home, a secondary page (about / services / work — whichever the source site emphasized), and a conversion page. Real scraped copy, paraphrased only for rhythm. Real scraped image URLs.

Preview in-browser with a viewport toggle. Swap templates. Regenerate. Watch the design change without the content changing.

### Export
One button. You get a zip:

```
index.html
about.html          (or services.html, etc.)
contact.html
styles.css
README.txt
```

Opens in a browser. Renders. Uses Google Fonts that match the chosen template. Every user-influenced string is HTML-escaped before it lands in the file, so a client putting `<script>` in their company name produces text, not execution.

---

## Why

An agency was going to take six weeks to produce three mockups. A theme marketplace was going to give you twelve variations of the same grid. A Squarespace wizard was going to ask thirty questions and then build you a layout you've seen before.

WebSwap is none of those things.

It's a tool. It runs on your laptop. It reads a URL. It produces HTML.

---

## Architecture

- **Front:** React 19, Vite 6, Tailwind 4, Motion, Recharts, TypeScript.
- **Host:** Express 4 with Vite in middleware mode. One process, dev and prod.
- **Model:** Claude Opus 4.7, adaptive thinking, effort `xhigh`, structured JSON output against a strict schema, streamed at 32K output tokens. Prompt caching on the system prompt + template catalog.
- **Scrape:** Cheerio, node-fetch, manual redirect loop, 10-second per-request timeout, 2 MB body cap, three-hop ceiling, IPv4 + IPv6 SSRF guard.
- **Export:** JSZip, Google Fonts link, shared `styles.css` typed on the chosen template's palette and typography.

The Anthropic API key lives only in the Node process. It is not in any client bundle, not in `vite.config.ts`, not in localStorage, not in the DOM. If you find it in the browser, something has gone badly wrong.

---

## Tested

```bash
npm test
```

Ninety-four tests across two suites. All passing at the tip of this branch.

- **Unit (75):** every template's palette validated as hex or rgba; sixteen private IPs blocked; six public IPs allowed; seven protocol and host variants rejected; the scraper run against a fixture that exercises OG tags, lazy-loaded images, inline CSS font detection with quoted names, data-URI exclusion, email and phone regex; all twelve section kinds rendered to React and to static HTML; stylesheet brace-balanced; export zip structure validated; a deliberate `<script>` payload confirmed escaped.
- **Integration (19):** real Express server booted, `/api/health` and `/api/templates` validated, nine SSRF and malformed-URL variants rejected, redesign input validation checked, and a real round-trip to the Anthropic API with a deliberately bad key to confirm the SDK is wired and the `AuthenticationError` maps to a clean 401.

---

## API

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | status, model, template count |
| GET | `/api/templates` | twelve template specs |
| POST | `/api/scrape` | `{ url }` → `{ site }` |
| POST | `/api/redesign` | `{ site, templateId }` → `{ redesign }` |

## Layout

```
server.ts         Express host + /api/redesign → Claude Opus 4.7
src/
  scraper.ts      Crawler, SSRF guard, extractors
  templates.ts    The twelve templates
  render.tsx      React preview, static HTML, zip export
  types.ts        Shared types
  App.tsx         Three-stage UI: scrape → pick → preview
  main.tsx        React bootstrap
  index.css       Tailwind entry, display fonts
tests/
  smoke.ts        75 unit tests
  http.ts         19 integration tests
```

---

## Built by

Floyd's Labs. Claude Code did the typing.
