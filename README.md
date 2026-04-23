<p align="center">
  <img src="https://repository-images.githubusercontent.com/1218644799/98367d5d-e916-4381-ac10-d93e31293d15" alt="WebSwap — Drop in a URL. Same content, hotter design." width="100%" />
</p>

# WebSwap

### Or: A Web Design Agency Quoted Three Weeks, We Took a Coffee Break

> **DOCUMENT CLASSIFICATION:** README / OBITUARY FOR THE DISCOVERY PHASE
> **DATE RECORDED:** Sometime After We Got Tired of Mood Boards
> **LOCATION:** Here at Floyd's Labs (which is not an agency)
> **BEVERAGE:** Coffee strong enough to disqualify itself from polite company
> **CURRENT STATE:** Done. Which, again, is the whole point.

---

## What This Is (Or: The Thing That Exists Now)

This is **WebSwap**.

You paste a URL. It quietly reads the actual site — copy, images, brand tokens, navigation, the parts that matter. Then it asks you, the human, to choose one of twelve high-level design directions. Then **Claude Opus 4.7** rebuilds it as a full three-page demo using your client's real content, real imagery, and a real opinion about layout.

You hand the demo to the client. The client points at the one they like. You now know exactly which palette, which typography, which structural DNA to commit to.

The discovery phase is over. It happened during the time it took the espresso machine to hiss.

---

## A Brief Moment of Silence (Or: The Quarter That Disappeared)

Let's acknowledge the alternative.

A reasonably famous, reasonably credentialed, reasonably suit-adjacent web design agency was going to spend three to six weeks producing exactly this:

- A "discovery workshop" where everyone wears name tags
- A "brand audit deck" with photographs of natural light
- Three "creative directions" delivered in a Figma file with strong opinions about whitespace
- A line item called "Strategic Alignment" priced like a used motorcycle
- An "iteration round" where the client says they liked the second one
- An invoice rendered in a serif typeface to make it feel inevitable

Meanwhile, here at Floyd's Labs, Douglas looked at the same problem, took a sip of coffee that arguably violated several international treaties, and said — without opening his eyes —

> *"just scrape the thing first and let them pick after."*

Then he went back to sleep.

So we did.

This document is a small, respectful gravestone for the part of the timeline where someone was about to put together a slide titled **"Discovery Phase Recap (Q2)."**

That slide does not exist now. It will never exist. The world is, in this one small way, lighter.

---

## Quick Start (Or: You Could Already Be Pasting URLs)

```bash
npm install
cp .env.example .env.local        # then put your ANTHROPIC_API_KEY in it
npm run dev
```

Open <http://localhost:3000>.

Paste a URL. Wait for the scrape. Pick a template. Get a three-page demo.

There is no onboarding. There is no guided tour. There is no friendly orange dot named "Sparky" who wants to walk you through how to paste a URL into a text field.

---

## What It Actually Does (Or: The Useful Part Without the Marketing Voice)

### Stage 1 — Read the actual website

- Crawls up to five pages, prioritized: `/`, `/about`, `/services`, `/products`, `/work`, `/contact`
- Pulls real H1s, H2s, paragraphs, navigation, CTAs, OG images, hero images, logo
- Extracts brand tokens: detected colors, detected fonts, emails, phone numbers, social links
- Refuses to scrape anything resolving to a private network address. Cloud metadata endpoints, `127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`, IPv6 loopback — all rejected before a single byte leaves the box.

### Stage 2 — Twelve aesthetic directions, hand-authored

Each template ships with a real spec, not a mood word:

| Template | Vibe |
| --- | --- |
| Editorial Serif | Magazine-grade, generous negative space, drop caps |
| Dark Luxury Monolith | Pure black, hairlines, restrained gold |
| Brutalist Grid | Off-white, numbered sections, unexpected rotations |
| Warm Organic | Terracotta + sage, rounded geometry, italic Fraunces |
| Atmospheric Glass | Indigo gradients, frosted cards, soft luminous edges |
| Clean Utility | Pure white, dense, neutral, institutional |
| Oversized Typographic | Type at 16vw, one accent used exactly three times |
| Bold Color Monolith | A single saturated color saturates the entire page |
| SaaS Split | 50/50 hero, gradient accents, dependable, conversion-shaped |
| Prestige Hospitality | Off-white, italic ligatures, deep emerald |
| Technical Data Grid | Mono-everywhere, terminal-green, status dots |
| Sculptural Minimal | Ink on bone. One monumental statement per screen |

### Stage 3 — A real three-page demo

- **Home**, **secondary** (about / services / work — whichever the source site emphasizes), and **conversion** (contact / CTA)
- Each page is structurally distinct. No three-times-the-same-template-with-different-colors.
- Real scraped copy, paraphrased only for rhythm. Real scraped image URLs.
- Live preview in-browser with a desktop / mobile viewport toggle and a page tab switcher.
- Dashboard view with scorecards, a Recharts comparison chart, and Claude's own list of suggestions.

### Stage 4 — Export

Hit **Export HTML**. You get a zip:

```
index.html
about.html        (or services.html, etc.)
contact.html
styles.css
README.txt
```

It opens in a browser. It is real HTML. It uses Google Fonts that match the chosen template. It is XSS-safe — every piece of user-influenced content is escaped before it lands in the file.

---

## The Part We Didn't Expect (Or: Where the Thing Got Better)

The original handoff from Google AI Studio had the design template baked into the *first* step — paste a URL **and** pick a template at the same time, then go.

Which is fine. Also wrong.

Because the client doesn't know which direction they want until they see what's actually on their site. And the agency doesn't know which direction will work until they see what content they have to work with.

So we flipped it.

**Now you scrape first.** You see what came back — pages, images, brand tokens, real copy. *Then* you pick the aesthetic, with full knowledge of the material you're applying it to. *Then* the demo is generated.

This was Douglas's contribution. He was technically asleep when he said it. Doesn't matter. The flow is correct now.

---

## Architecture Notes (Or: Yes, This Is Real)

- **React 19** + **Vite 6** + **TypeScript** on the front
- **Express 4** host with **Vite middleware mode** — single process for dev and prod
- **Tailwind 4** + **Motion** for the in-browser preview
- **Claude Opus 4.7** via the official `@anthropic-ai/sdk`
  - Adaptive thinking, `effort: "xhigh"`
  - Structured output via `output_config.format.json_schema`
  - Streamed (`max_tokens: 32_000`) so we don't trip SDK timeouts
  - System prompt + template catalog cached via `cache_control: ephemeral`
- **Cheerio** for parsing, **node-fetch** for fetching, **JSZip** for export
- **Recharts** for the dashboard

The Anthropic API key lives **only** inside the Node process. It does not appear in any client bundle. It is not exposed via `vite.config.ts`. It is not in localStorage. If you find it in the DOM, the laws of physics have changed and we have larger problems.

---

## Tested (Or: We Are Not Just Vibes)

```bash
npm test
```

Runs **94 tests** in two suites:

- **`tests/smoke.ts`** — 75 unit tests covering every template's palette, every SSRF code path (16 private IPs + 6 public + 7 protocol/host variants), the full scraper pipeline against fixture HTML (title, meta, H1/H2, nav, CTAs, paragraphs, OG image, logo, hero, lazy-loaded images, brand colors, brand fonts including double-quoted names), all 12 section renderers (React preview *and* static HTML), the stylesheet generator, the per-page HTML export, and the export ZIP — including a deliberate XSS payload to confirm escaping holds.
- **`tests/http.ts`** — 19 integration tests that boot the real Express server, validate `/api/health`, `/api/templates`, every `/api/scrape` rejection path, every `/api/redesign` validation path, and — critically — a real round-trip to the Anthropic API with a deliberately-bad key to confirm the SDK is actually wired up and the `AuthenticationError` maps to a clean `401`.

Last run on this branch: **94 / 94 passing. 100%.**

The pass rate is allowed to be that number. We checked.

---

## A Note on Timing (Or: Why This Exists)

This is not a heroic story.

Nobody disrupted anything. Nobody pivoted. Nobody held a retrospective.

The Google AI Studio handoff produced a working-ish prototype in roughly ten minutes. It had a Gemini key inlined into the client bundle, a model ID that didn't exist, no tests, no error handling, an SSRF vulnerability you could drive a truck through, and one extremely long `App.tsx` that mixed scraping, AI calls, and UI in the same component.

Then **Claude Code** showed up.

We are not doing the false-modesty thing here — this is the part where credit gets handed out **without a ceremony**.

Claude Code looked at the prototype like it had somewhere to be, refactored the SDK, reversed the flow, hand-authored twelve real templates, hardened the scraper against private-network exfiltration, wrote ninety-four tests, fixed a font-detection bug those tests caught, and produced an evidence ledger that would survive contact with a paranoid auditor.

This took roughly the time required to drink one cup of coffee that should not, by any reasonable standard, have been served to a member of the public.

Douglas was awake for portions of this. Generous estimate.

---

## What This Isn't (Or: Let's Be Clear)

- Not a SaaS
- Not a "platform"
- Not a roadmap with quarterly themes
- Not a "we're excited to share" announcement
- Not anything that requires you to schedule a demo to find out the price
- Not a thing that tries to be your friend

It's a tool. It runs on your laptop. It ships HTML.

---

## API Surface (Or: For When You Want to Skip the UI)

| Method | Path             | Purpose                                                  |
| ------ | ---------------- | -------------------------------------------------------- |
| GET    | `/api/health`    | Status, model, template count                            |
| GET    | `/api/templates` | All twelve template specs                                |
| POST   | `/api/scrape`    | `{ url }` → `{ site }` (pages, images, brand tokens)     |
| POST   | `/api/redesign`  | `{ site, templateId }` → `{ redesign }` (3-page plan)    |

## Project Structure

```
server.ts           Express host + /api/redesign → Claude Opus 4.7
src/
  scraper.ts        Crawler + SSRF guard + extractors (testable in isolation)
  templates.ts      The twelve templates, hand-authored, fully specified
  render.tsx        React preview + static HTML/CSS/ZIP export
  types.ts          Shared types
  App.tsx           Three-stage UI (scrape → pick template → preview)
  main.tsx          React bootstrap
  index.css         Tailwind entry + display fonts
tests/
  smoke.ts          75 unit tests
  http.ts           19 integration tests
```

---

## Closing Thought (Or: The Entire Point)

There is a version of this timeline where WebSwap takes a quarter.

There is a version where it takes seventeen Slack threads, four agency partners, and a line item called *Iterative Visual Exploration*.

There is also a version where Douglas mutters at a screen, Claude Code does the actual work, and the thing exists by lunch.

You are reading the README to the third version.

---

*Floyd's Labs and Claude Code present — **WebSwap***

> *"If it works, ship it. If it takes a quarter, you built the discovery phase instead of the website."*
