<p align="center">
  <img src="https://repository-images.githubusercontent.com/1218644799/98367d5d-e916-4381-ac10-d93e31293d15" alt="WebSwap — Drop in a URL. Same content, hotter design." width="100%" />
</p>

# WebSwap

**She's the same. Just hotter.** 😉

Drop in a URL. WebSwap ingests the whole site — words, images, brand bones, the parts that were already working — hands you twelve design directions to choose from, and rebuilds it as a real three-page demo you can actually show a client.

The client picks the one they like. You skip six weeks of discovery theater and get to start building the site they already said yes to.

That's the whole pitch.

---

## Who's behind this

Hi. I'm Douglas. I run **Floyd's Labs**, which sounds like a studio and is actually a studio, but in the sense that it's me, a very aggressive espresso machine, and **Floyd** doing the heavy lifting when the brief gets weird.

WebSwap is a **Floyd** project. Douglas set the direction, paced around, muttered things like *"just scrape the thing first"*, and Floyd built the bulk of the workflow.

That's the arrangement. It works.

---

## Install it

```bash
npm install
cp .env.example .env.local   # paste your PORTKEY_API_KEY
npm run dev                  # http://localhost:10337
```

No onboarding flow. No tooltip friend named Sparky. If you can paste a URL into a text field, you're qualified.

---

## What it actually does

### 1. Reads the client's real site

Crawls up to five pages, prioritized: `/`, `/about`, `/services`, `/products`, `/work`, `/contact`. Pulls headings, paragraphs, navigation, CTAs, OG tags, hero images, logos, inline-CSS-detected brand colors, the fonts the site is actually using, emails, phone numbers, and the social links from the bottom of the footer that everybody forgets about.

Refuses to fetch anything that resolves to a private address. Your AWS metadata endpoint is safe from us. So are the neighbor's printer and whatever `127.0.0.1` is hiding.

### 2. Shows you twelve directions that don't look like each other

Because Themeforest has forty thousand templates and they are all the same template.

| Template | Vibe |
| --- | --- |
| Editorial Serif | Magazine-grade negative space. Drop caps where it matters. |
| Dark Luxury Monolith | Black canvas. Hairlines. Restrained gold. Very *please don't speak loudly*. |
| Brutalist Grid | Numbered sections. Unexpected rotations. Slight aggression. |
| Warm Organic | Terracotta and sage. Italic Fraunces. The kind of warm that sells candles. |
| Atmospheric Glass | Indigo gradients. Frosted cards. Cinematic. |
| Clean Utility | White. Dense. For products that have a VP of Compliance. |
| Oversized Typographic | Headlines at 16vw. One accent color, used three times. |
| Bold Color Monolith | One saturated color. The whole page. Pick wisely. |
| SaaS Split | 50/50 hero. Gradient behind a product shot. You've seen this one. It works. |
| Prestige Hospitality | Off-white. Italic ligatures. Deep emerald. Hotels love this. |
| Technical Data Grid | Monospace everything. Terminal green. Status dots. Developers audibly exhale. |
| Sculptural Minimal | Ink on bone. One statement per screen. Gallery energy. |

Each one is a full spec — palette, typography pair, layout DNA, best-fit industries — not a mood word. Pick one. Hit regenerate. Same content, completely different animal.

### 3. Builds a real three-page demo

Home, a secondary page (about / services / work — whichever your client leans on hardest), and a conversion page. Each page is structurally distinct, because nobody wants three pages in a row that are just the hero in different colors. Real scraped copy, paraphrased for rhythm. Real scraped image URLs. Preview in browser. Desktop/mobile toggle. Swap templates. Regenerate. Watch the whole thing become a different site while the words stay the same.

### 4. Exports HTML you can actually hand off

One button. You get a zip:

```
index.html
about.html        (or services.html, etc.)
contact.html
styles.css
README.txt
```

Opens in a browser. Renders. Uses Google Fonts that match the chosen template. Every user-provided string is HTML-escaped on the way out, so a client with a dangerous sense of humor in their company name won't accidentally execute JavaScript on their own marketing site.

You're welcome.

---

## Why this exists

Because my clients have been through the agency experience.

You know the one. Four weeks of discovery workshops. A brand audit deck with stock photos of natural light. Three creative directions that cost more than a used Honda. An iteration round. A line item titled *Strategic Alignment* priced like an entire kitchen appliance. An invoice rendered in a serif font to make the whole thing feel inevitable.

Meanwhile the client just wants to know: *will my site look good, which kind of good, and can I see it?*

WebSwap answers that in about the time it takes to make a pour-over.

---

## How it's built

- **Front end:** React 19, Vite 6, Tailwind 4, Motion for the smooth parts, Recharts for the dashboard.
- **Server:** One Node process. Express 4 with Vite middleware in dev, Express + static bundle in prod.
- **AI-assisted build:** A small typed blueprint can come from a configurable gateway, but the final redesign, preview, and ZIP are built deterministically on the server.
- **Scrape:** Cheerio for parsing, node-fetch for fetching, a hand-rolled SSRF guard I trust more than I trust myself.
- **Secrets:** API credentials live exclusively in `process.env` on the server. Not in any client bundle. Not in `vite.config.ts`. Not in localStorage. If you find them in DevTools I owe you a drink and a bug report.

---

## It's tested

```bash
npm test
```

**94 of 94 passing** at the tip of this branch.

- **75 unit tests.** Every template's palette validated. Twenty-two IP addresses run through the SSRF guard. The scraper against a fixture with every weird HTML pattern I could think of — lazy-loaded images, quoted font names, data-URI exclusion, the works. All twelve section kinds rendered to React *and* static HTML. Export zip validated end-to-end. A real `<script>` payload in the content to prove the escaping holds.
- **19 integration tests.** Real Express server booted. Every endpoint exercised. Including a live round-trip with a deliberately-bad API key to prove the server-side client is actually wired up and the auth error maps to a clean 401.

If these pass on your box, they pass everywhere.

---

## API, for people who want to skip the UI

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | status, model, template count |
| GET | `/api/templates` | twelve template specs |
| POST | `/api/scrape` | `{ url }` → `{ site }` |
| POST | `/api/redesign` | `{ site, templateId }` → `{ redesign }` |

## Project layout

```
server.ts         Express host + Portkey-routed redesign generation
src/
  scraper.ts      Crawler, SSRF guard, extractors
  templates.ts    The twelve templates
  render.tsx      React preview, static HTML, zip export
  types.ts        Shared types
  App.tsx         Three-stage UI: scrape → pick → preview
  main.tsx        React bootstrap
  index.css       Tailwind + display fonts
tests/
  smoke.ts        75 unit tests
  http.ts         19 integration tests
```

---

## Shipped by

**Floyd's Labs** · built with **Floyd**.

Douglas supervised. By which I mean Douglas was nearby. Possibly asleep. Definitely caffeinated. Floyd handled the heavy lifting.
