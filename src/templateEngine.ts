import type { DesignTemplate } from "./types";

// ── CSS generation from template properties ──
// Full design system templates use generateTemplateCSS; the basic fallback
// produces a clean, usable stylesheet from palette and typography alone.

export function generateTemplateCSS(template: DesignTemplate): string {
  return basicCSS(template);
}

// ── Fallback for templates without design system ──
function basicCSS(template: DesignTemplate): string {
  const p = template.palette;
  const t = template.typography;
  return `:root {
  --bg: ${p.bg};
  --surface: ${p.surface};
  --ink: ${p.text};
  --text: ${p.text};
  --muted: ${p.muted};
  --accent: ${p.accent};
  --accent-dim: ${p.primary};
  --rule: ${p.muted}33;
  --heading-stack: '${t.heading}', serif;
  --body-stack: '${t.body}', sans-serif;
  --gutter: clamp(20px, 4vw, 56px);
  --max-width: 1240px;
  --section-gap: 88px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--bg); color: var(--text); font-family: var(--body-stack); font-size: 17px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
img { max-width: 100%; display: block; height: auto; }
a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; border: none; background: none; }
::selection { background: var(--accent); color: var(--bg); }
.wrap { max-width: var(--max-width); margin: 0 auto; padding: 0 var(--gutter); position: relative; z-index: 2; }
h1, h2, h3, h4 { font-family: var(--heading-stack); color: var(--ink); line-height: 1.05; font-weight: ${t.headingWeight}; ${t.headingCase === "uppercase" ? "text-transform: uppercase; letter-spacing: -0.005em;" : "letter-spacing: -0.02em;"} ${t.headingStyle === "italic" ? "font-style: italic;" : ""} }
h1 { font-size: clamp(48px, 7.6vw, 112px); }
h2 { font-size: clamp(36px, 4.6vw, 64px); letter-spacing: -0.02em; }
h3 { font-size: clamp(22px, 2.2vw, 30px); }
h4 { font-size: 18px; letter-spacing: 0.02em; }
.eyebrow { font-family: var(--heading-stack); font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); display: inline-flex; align-items: center; gap: 12px; }
.eyebrow::before { content: ""; width: 28px; height: 1px; background: var(--accent); display: inline-block; }
.lede { font-size: clamp(20px, 1.8vw, 24px); line-height: 1.5; color: var(--ink); max-width: 56ch; }
/* ── Sections ── */
.section { padding: var(--section-gap) 0; position: relative; }
.section + .section { border-top: 1px solid var(--rule); }
.section-head { display: grid; grid-template-columns: 1fr 1.6fr; gap: 48px; margin-bottom: 56px; align-items: end; }
.section-head h2 { max-width: 18ch; }
/* ── Buttons ── */
.btn { font-family: var(--heading-stack); font-size: 14px; letter-spacing: 0.14em; text-transform: uppercase; padding: 16px 28px; border: 1px solid var(--ink); color: var(--ink); background: transparent; display: inline-flex; align-items: center; gap: 12px; transition: background 0.25s, color 0.25s, border-color 0.25s; cursor: pointer; }
.btn:hover { background: var(--ink); color: var(--bg); }
.btn--primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.btn--primary:hover { background: var(--accent-dim); border-color: var(--accent-dim); }
/* ── Header ── */
.masthead { padding: 28px 0 22px; border-bottom: 1px solid var(--rule); }
.masthead .wrap { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 32px; }
.masthead nav { display: flex; gap: 24px; align-items: center; justify-self: end; }
.masthead nav a { font-family: var(--heading-stack); font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); padding-bottom: 4px; border-bottom: 1px solid transparent; transition: border-color 0.25s, color 0.25s; }
.masthead nav a:hover, .masthead nav a.current { color: var(--ink); border-color: var(--ink); }
.wordmark { text-align: center; }
.wordmark .name { font-family: var(--heading-stack); font-size: clamp(24px, 3vw, 36px); font-weight: ${t.headingWeight}; color: var(--ink); display: block; line-height: 1; }
.wordmark .est { font-family: var(--heading-stack); font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); display: block; margin-top: 8px; }
/* ── Hero ── */
.hero { padding: 72px 0 88px; ${p.primary === p.bg ? "background: var(--ink);" : ""} }
.hero .wrap { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 64px; align-items: end; }
.hero .display { margin: 18px 0 28px; }
.hero .meta { display: flex; gap: 32px; margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--rule); font-size: 13px; color: var(--muted); }
.hero .meta b { font-family: var(--heading-stack); font-weight: ${t.headingWeight}; color: var(--ink); display: block; font-size: 24px; }
.hero .ctas { display: flex; gap: 18px; margin-top: 28px; flex-wrap: wrap; align-items: center; }
.hero-figure { position: relative; }
.hero-figure img { width: 100%; aspect-ratio: 4/5; object-fit: cover; ${p.muted} }
/* ── Cards ── */
.card { background: var(--surface); border: 1px solid var(--rule); padding: 32px 28px; border-radius: 12px; transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s; }
.card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px -22px rgba(0,0,0,0.25); }
.feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
/* ── Stats ── */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.stat .stat-value { font-family: var(--heading-stack); font-size: 2.5rem; color: var(--accent); line-height: 1; }
.stat .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-top: 6px; }
/* ── Reviews ── */
.reviews { padding: 96px 0; background: var(--surface); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.reviews-head { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: end; margin-bottom: 48px; }
.reviews-head .meter { display: flex; align-items: baseline; gap: 18px; }
.reviews-head .meter .score { font-family: var(--heading-stack); font-size: 84px; line-height: 1; color: var(--ink); }
.reviews-head .meter .stars { color: var(--ink); letter-spacing: 0.25em; font-size: 22px; }
.reviews-head .meter .ct { color: var(--muted); font-size: 13px; display: block; margin-top: 6px; }
.reviews-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.review { background: var(--surface); border: 1px solid var(--rule); padding: 32px; display: flex; flex-direction: column; gap: 14px; }
.review .stars-row { color: var(--ink); letter-spacing: 0.25em; font-size: 14px; }
.review blockquote { font-family: var(--heading-stack); font-size: 18px; line-height: 1.4; color: var(--ink); font-style: italic; }
.review .who { padding-top: 14px; border-top: 1px solid var(--rule); margin-top: auto; display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--muted); }
.review .who b { color: var(--ink); font-family: var(--heading-stack); font-weight: ${t.headingWeight}; }
/* ── FAQ ── */
.faq { padding: 96px 0; }
.faq .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 56px; align-items: start; }
.faq details { border-top: 1px solid var(--rule); padding: 22px 0; }
.faq details:last-of-type { border-bottom: 1px solid var(--rule); }
.faq summary { font-family: var(--heading-stack); font-size: clamp(20px, 1.8vw, 26px); font-weight: ${t.headingWeight}; cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 24px; align-items: baseline; color: var(--ink); }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; font-family: var(--heading-stack); color: var(--ink); font-size: 28px; transition: transform 0.3s; }
.faq details[open] summary::after { transform: rotate(45deg); }
.faq details > div { padding-top: 16px; color: var(--text); max-width: 56ch; font-size: 15px; }
/* ── Gallery ── */
.gallery { padding: 96px 0; border-top: 1px solid var(--rule); }
.gallery .head { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: end; margin-bottom: 32px; }
.gallery .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.gallery figure { position: relative; overflow: hidden; }
.gallery figure img { width: 100%; aspect-ratio: 4/5; object-fit: cover; transition: transform 1.2s cubic-bezier(0.2,0.7,0.2,1); }
.gallery figure:hover img { transform: scale(1.04); }
.gallery figcaption { position: absolute; left: 16px; top: 16px; padding: 8px 14px; background: var(--bg); border: 1px solid var(--rule); font-family: var(--heading-stack); font-size: 13px; color: var(--ink); }
/* ── CTA Banner ── */
.cta-banner { background: var(--ink); color: var(--bg); padding: 80px 0; }
.cta-banner h2 { color: var(--bg); }
.cta-banner .wrap { display: grid; grid-template-columns: 1.4fr 1fr; gap: 56px; align-items: center; }
.cta-banner .ctas { display: flex; gap: 18px; flex-wrap: wrap; }
.cta-banner .btn { color: var(--bg); border-color: var(--bg); }
.cta-banner .btn:hover { background: var(--bg); color: var(--ink); }
.cta-banner .btn--primary { background: var(--accent); border-color: var(--accent); color: var(--ink); }
.cta-banner .btn--primary:hover { background: var(--accent-dim); border-color: var(--accent-dim); }
/* ── Contact ── */
.contact-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
.contact-layout form { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.contact-layout .field.full { grid-column: 1 / -1; }
.field label { display: block; font-family: var(--heading-stack); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.field input, .field textarea, .field select { width: 100%; padding: 14px 16px; border: 1px solid var(--rule); background: var(--bg); font-family: var(--body-stack); font-size: 16px; color: var(--ink); outline: none; transition: border-color 0.25s; border-radius: 8px; }
.field input:focus, .field textarea:focus { border-color: var(--accent); }
.field textarea { min-height: 140px; resize: vertical; }
/* ── Pull Quote ── */
.pullquote { display: grid; grid-template-columns: 1fr 3fr; gap: 56px; align-items: start; padding: 64px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.pullquote .mark { font-family: var(--heading-stack); font-size: 96px; line-height: 0.6; color: var(--accent); font-style: italic; }
.pullquote blockquote { font-family: var(--heading-stack); font-size: clamp(28px, 3.2vw, 42px); line-height: 1.2; color: var(--ink); }
.pullquote cite { font-style: italic; font-size: 14px; color: var(--muted); display: block; margin-top: 18px; }
/* ── Footer ── */
.colophon { background: var(--surface); padding: 80px 0 32px; border-top: 1px solid var(--rule); }
.colophon .wrap { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; }
.colophon h5 { font-family: var(--heading-stack); font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin-bottom: 18px; }
.colophon ul { list-style: none; }
.colophon li { padding: 6px 0; }
.colophon li a { color: var(--ink); border-bottom: 1px solid transparent; }
.colophon li a:hover { color: var(--ink); border-color: var(--ink); }
.colophon .brand-block .name { font-family: var(--heading-stack); font-size: 26px; color: var(--ink); display: block; line-height: 1; }
.colophon .brand-block p { color: var(--muted); margin-top: 12px; max-width: 36ch; }
.colophon .legal { grid-column: 1 / -1; margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--rule); display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); letter-spacing: 0.04em; }
/* ── Marquee ── */
.marquee { background: var(--surface); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); overflow: hidden; padding: 14px 0; position: relative; }
.marquee .track { display: inline-flex; align-items: center; gap: 28px; white-space: nowrap; will-change: transform; animation: marqueeScroll 36s linear infinite; }
.marquee:hover .track { animation-play-state: paused; }
.marquee .item { font-family: var(--heading-stack); font-size: 22px; color: var(--ink); font-style: italic; }
.marquee .sep { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block; }
@keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
/* ── Motion ── */
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(18px); transition: opacity 0.9s ease, transform 0.9s ease; }
  .reveal.is-in { opacity: 1; transform: translateY(0); }
  .reveal-stagger > * { opacity: 0; transform: translateY(14px); transition: opacity 0.8s ease, transform 0.8s ease; }
  .reveal-stagger.is-in > *:nth-child(1) { transition-delay: 0ms; opacity: 1; transform: none; }
  .reveal-stagger.is-in > *:nth-child(2) { transition-delay: 100ms; opacity: 1; transform: none; }
  .reveal-stagger.is-in > *:nth-child(3) { transition-delay: 200ms; opacity: 1; transform: none; }
  .reveal-stagger.is-in > *:nth-child(4) { transition-delay: 300ms; opacity: 1; transform: none; }
  .reveal-stagger.is-in > *:nth-child(n+5) { transition-delay: 400ms; opacity: 1; transform: none; }
  .ken-burns { overflow: hidden; }
  .ken-burns img { animation: kenBurns 22s ease-in-out infinite alternate; }
  @keyframes kenBurns { from { transform: scale(1.0) translate(0,0); } to { transform: scale(1.06) translate(-1.2%, -0.8%); } }
}
@media (prefers-reduced-motion: reduce) { .marquee .track { animation: none; } }
/* ── Responsive ── */
@media (max-width: 960px) {
  .masthead .wrap { grid-template-columns: 1fr; text-align: center; }
  .masthead nav { justify-self: center; flex-wrap: wrap; }
  .hero .wrap, .section-head, .contact-layout { grid-template-columns: 1fr; gap: 40px; }
  .feature-grid { grid-template-columns: 1fr; }
  .reviews-head, .reviews-grid, .faq .grid { grid-template-columns: 1fr; gap: 32px; }
  .colophon .wrap { grid-template-columns: 1fr 1fr; }
  .cta-banner .wrap { grid-template-columns: 1fr; }
}
@media (max-width: 540px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .colophon .wrap { grid-template-columns: 1fr; }
  .contact-layout form { grid-template-columns: 1fr; }
}
`;
}