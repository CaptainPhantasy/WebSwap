import React from "react";
import JSZip from "jszip";
import type {
  DesignTemplate,
  Redesign,
  RedesignPage,
  RedesignSection,
} from "./types";

export function fontImportUrl(heading: string, body: string): string {
  const fam = (name: string) => {
    const encoded = encodeURIComponent(name.trim());
    return `family=${encoded}:wght@400;500;600;700;900`;
  };
  const names = Array.from(new Set([heading, body].filter(Boolean)));
  const parts = names.map(fam).join("&");
  return `https://fonts.googleapis.com/css2?${parts}&display=swap`;
}

export function renderSectionPreview(
  s: RedesignSection,
  t: DesignTemplate,
): React.ReactNode {
  const headingFont = `'${t.typography.heading}', serif`;
  const p = t.palette;
  const upper = t.typography.headingCase === "uppercase";
  const italic = t.typography.headingStyle === "italic";

  const h = (text: string | undefined, size: string) =>
    text ? (
      <h2
        className="font-bold leading-[1.05]"
        style={{
          fontFamily: headingFont,
          fontSize: size,
          fontWeight: t.typography.headingWeight,
          fontStyle: italic ? "italic" : "normal",
          textTransform: upper ? "uppercase" : "none",
          letterSpacing: upper ? "0.04em" : "-0.02em",
          color: p.text,
        }}
      >
        {text}
      </h2>
    ) : null;

  switch (s.kind) {
    case "hero":
      return (
        <section className="px-8 py-16 md:py-24" style={{ background: p.bg }}>
          <div className="max-w-4xl">
            {s.subheading && (
              <div
                className="text-xs font-bold uppercase tracking-widest mb-5"
                style={{ color: p.accent }}
              >
                {s.subheading}
              </div>
            )}
            {h(s.heading, "clamp(2.5rem, 7vw, 5.5rem)")}
            {s.body && (
              <p
                className="mt-6 text-lg max-w-2xl"
                style={{ color: p.muted }}
              >
                {s.body}
              </p>
            )}
            {s.ctaLabel && (
              <button
                className="mt-8 px-8 py-4 rounded-full font-bold"
                style={{ background: p.primary, color: p.bg }}
              >
                {s.ctaLabel}
              </button>
            )}
          </div>
        </section>
      );

    case "feature-grid":
      return (
        <section className="px-8 py-14" style={{ background: p.bg }}>
          {h(s.heading, "clamp(1.75rem, 3vw, 2.5rem)")}
          {s.subheading && (
            <p
              className="mt-3 max-w-2xl"
              style={{ color: p.muted }}
            >
              {s.subheading}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            {(s.items || []).slice(0, 6).map((it, i) => (
              <div
                key={i}
                className="p-6 rounded-xl"
                style={{ background: p.surface, border: `1px solid ${p.muted}22` }}
              >
                <h3
                  className="font-bold mb-2"
                  style={{ color: p.text, fontFamily: headingFont }}
                >
                  {it.title}
                </h3>
                <p className="text-sm" style={{ color: p.muted }}>
                  {it.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      );

    case "image-split":
      return (
        <section className="px-8 py-14" style={{ background: p.bg }}>
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${
              s.alignment === "right" ? "md:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div>
              {h(s.heading, "clamp(1.75rem, 3vw, 2.5rem)")}
              {s.body && (
                <p className="mt-4" style={{ color: p.muted }}>
                  {s.body}
                </p>
              )}
              {s.ctaLabel && (
                <button
                  className="mt-6 px-6 py-3 rounded-full font-bold"
                  style={{ background: p.primary, color: p.bg }}
                >
                  {s.ctaLabel}
                </button>
              )}
            </div>
            {s.imageUrl && (
              <img
                src={s.imageUrl}
                alt=""
                loading="lazy"
                className="w-full h-80 object-cover rounded-2xl"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).style.display = "none")
                }
              />
            )}
          </div>
        </section>
      );

    case "stats":
      return (
        <section className="px-8 py-14" style={{ background: p.surface }}>
          {h(s.heading, "clamp(1.5rem, 2.5vw, 2rem)")}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            {(s.items || []).slice(0, 4).map((it, i) => (
              <div key={i}>
                <div
                  className="font-bold"
                  style={{
                    fontFamily: headingFont,
                    fontSize: "2.5rem",
                    color: p.accent,
                  }}
                >
                  {it.value}
                </div>
                <div
                  className="text-xs uppercase tracking-widest mt-1"
                  style={{ color: p.muted }}
                >
                  {it.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      );

    case "quote":
      return (
        <section className="px-8 py-20" style={{ background: p.bg }}>
          <blockquote
            className="max-w-3xl"
            style={{
              fontFamily: headingFont,
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              lineHeight: 1.3,
              color: p.text,
              fontStyle: italic ? "italic" : "normal",
            }}
          >
            "{s.body}"
          </blockquote>
          {s.attribution && (
            <div
              className="mt-4 text-xs uppercase tracking-widest"
              style={{ color: p.muted }}
            >
              — {s.attribution}
            </div>
          )}
        </section>
      );

    case "gallery":
      return (
        <section className="px-8 py-14" style={{ background: p.bg }}>
          {h(s.heading, "clamp(1.5rem, 2.5vw, 2rem)")}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-8">
            {(s.imageUrls || []).slice(0, 6).map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                loading="lazy"
                className="w-full h-48 object-cover rounded-xl"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).style.display = "none")
                }
              />
            ))}
          </div>
        </section>
      );

    case "logos":
      return (
        <section className="px-8 py-10" style={{ background: p.surface }}>
          <div
            className="text-xs uppercase tracking-widest text-center"
            style={{ color: p.muted }}
          >
            {s.heading || "Trusted by"}
          </div>
          <div className="flex flex-wrap justify-center gap-8 mt-6 opacity-70">
            {(s.items || []).slice(0, 6).map((it, i) => (
              <div
                key={i}
                className="text-lg font-bold"
                style={{ fontFamily: headingFont, color: p.text }}
              >
                {it.label || it.title}
              </div>
            ))}
          </div>
        </section>
      );

    case "pricing":
      return (
        <section className="px-8 py-14" style={{ background: p.bg }}>
          {h(s.heading, "clamp(1.75rem, 3vw, 2.5rem)")}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {(s.items || []).slice(0, 3).map((it, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl"
                style={{
                  background: p.surface,
                  border: `1px solid ${p.muted}30`,
                }}
              >
                <div
                  className="text-xs uppercase tracking-widest"
                  style={{ color: p.muted }}
                >
                  {it.label}
                </div>
                <div
                  className="font-bold mt-2"
                  style={{
                    fontFamily: headingFont,
                    fontSize: "2rem",
                    color: p.text,
                  }}
                >
                  {it.value}
                </div>
                <p className="text-sm mt-2" style={{ color: p.muted }}>
                  {it.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      );

    case "faq":
      return (
        <section className="px-8 py-14" style={{ background: p.bg }}>
          {h(s.heading, "clamp(1.75rem, 3vw, 2.5rem)")}
          <div className="mt-6 max-w-3xl space-y-4">
            {(s.items || []).slice(0, 6).map((it, i) => (
              <div
                key={i}
                className="pb-4"
                style={{ borderBottom: `1px solid ${p.muted}30` }}
              >
                <div className="font-bold" style={{ color: p.text }}>
                  {it.title}
                </div>
                <p className="text-sm mt-1" style={{ color: p.muted }}>
                  {it.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      );

    case "team":
      return (
        <section className="px-8 py-14" style={{ background: p.bg }}>
          {h(s.heading, "clamp(1.75rem, 3vw, 2.5rem)")}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            {(s.items || []).slice(0, 4).map((it, i) => (
              <div key={i}>
                <div
                  className="aspect-square rounded-xl mb-3"
                  style={{ background: p.surface }}
                />
                <div className="font-bold" style={{ color: p.text }}>
                  {it.title}
                </div>
                <div className="text-xs" style={{ color: p.muted }}>
                  {it.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      );

    case "contact":
      return (
        <section className="px-8 py-16" style={{ background: p.surface }}>
          {h(s.heading, "clamp(1.75rem, 3vw, 2.5rem)")}
          {s.subheading && (
            <p className="mt-3 max-w-xl" style={{ color: p.muted }}>
              {s.subheading}
            </p>
          )}
          <div className="mt-8 max-w-lg space-y-3">
            <input
              placeholder="Your name"
              className="w-full p-3 rounded-lg"
              style={{
                background: p.bg,
                border: `1px solid ${p.muted}40`,
                color: p.text,
              }}
            />
            <input
              placeholder="Email"
              className="w-full p-3 rounded-lg"
              style={{
                background: p.bg,
                border: `1px solid ${p.muted}40`,
                color: p.text,
              }}
            />
            <textarea
              placeholder="Message"
              rows={4}
              className="w-full p-3 rounded-lg"
              style={{
                background: p.bg,
                border: `1px solid ${p.muted}40`,
                color: p.text,
              }}
            />
            <button
              className="px-6 py-3 rounded-full font-bold"
              style={{ background: p.primary, color: p.bg }}
            >
              {s.ctaLabel || "Send message"}
            </button>
          </div>
        </section>
      );

    case "cta":
    default:
      return (
        <section
          className="px-8 py-16 text-center"
          style={{ background: p.primary, color: p.bg }}
        >
          <h2
            className="font-bold"
            style={{
              fontFamily: headingFont,
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: t.typography.headingWeight,
            }}
          >
            {s.heading}
          </h2>
          {s.subheading && (
            <p className="mt-4 max-w-2xl mx-auto opacity-80">{s.subheading}</p>
          )}
          {s.ctaLabel && (
            <button
              className="mt-8 px-8 py-4 rounded-full font-bold"
              style={{ background: p.bg, color: p.primary }}
            >
              {s.ctaLabel}
            </button>
          )}
        </section>
      );
  }
}

export function esc(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sectionHTML(s: RedesignSection, t: DesignTemplate): string {
  const p = t.palette;
  switch (s.kind) {
    case "hero":
      return `<section class="hero">
  ${s.subheading ? `<div class="kicker">${esc(s.subheading)}</div>` : ""}
  <h1>${esc(s.heading)}</h1>
  ${s.body ? `<p class="lead">${esc(s.body)}</p>` : ""}
  ${s.ctaLabel ? `<a class="btn" href="${esc(s.ctaHref) || "#"}">${esc(s.ctaLabel)}</a>` : ""}
</section>`;
    case "feature-grid":
      return `<section class="features">
  ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
  ${s.subheading ? `<p class="muted">${esc(s.subheading)}</p>` : ""}
  <div class="grid grid-3">
    ${(s.items || [])
      .map(
        (it) =>
          `<article class="card"><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p></article>`,
      )
      .join("")}
  </div>
</section>`;
    case "image-split":
      return `<section class="split ${s.alignment === "right" ? "reverse" : ""}">
  <div>
    ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
    ${s.body ? `<p>${esc(s.body)}</p>` : ""}
    ${s.ctaLabel ? `<a class="btn" href="${esc(s.ctaHref) || "#"}">${esc(s.ctaLabel)}</a>` : ""}
  </div>
  ${s.imageUrl ? `<img src="${esc(s.imageUrl)}" alt="" loading="lazy" />` : ""}
</section>`;
    case "stats":
      return `<section class="stats">
  ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
  <div class="grid grid-4 stats-grid">
    ${(s.items || [])
      .map(
        (it) =>
          `<div class="stat"><div class="stat-value">${esc(it.value)}</div><div class="stat-label">${esc(it.label)}</div></div>`,
      )
      .join("")}
  </div>
</section>`;
    case "quote":
      return `<section class="quote">
  <blockquote>“${esc(s.body)}”</blockquote>
  ${s.attribution ? `<div class="muted">— ${esc(s.attribution)}</div>` : ""}
</section>`;
    case "gallery":
      return `<section class="gallery">
  ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
  <div class="grid grid-3">
    ${(s.imageUrls || [])
      .map((src) => `<img src="${esc(src)}" alt="" loading="lazy" />`)
      .join("")}
  </div>
</section>`;
    case "logos":
      return `<section class="logos">
  <div class="muted center">${esc(s.heading) || "Trusted by"}</div>
  <div class="logo-row">${(s.items || [])
    .map((it) => `<span>${esc(it.label || it.title)}</span>`)
    .join("")}</div>
</section>`;
    case "pricing":
      return `<section class="pricing">
  ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
  <div class="grid grid-3">
    ${(s.items || [])
      .map(
        (it) => `<article class="card pricing-card">
      <div class="muted">${esc(it.label)}</div>
      <div class="price">${esc(it.value)}</div>
      <p>${esc(it.body)}</p>
    </article>`,
      )
      .join("")}
  </div>
</section>`;
    case "faq":
      return `<section class="faq">
  ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
  <div class="faq-list">
    ${(s.items || [])
      .map(
        (it) =>
          `<details><summary>${esc(it.title)}</summary><p>${esc(it.body)}</p></details>`,
      )
      .join("")}
  </div>
</section>`;
    case "team":
      return `<section class="team">
  ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
  <div class="grid grid-4">
    ${(s.items || [])
      .map(
        (it) =>
          `<div class="member"><div class="avatar"></div><div class="member-name">${esc(it.title)}</div><div class="muted">${esc(it.label)}</div></div>`,
      )
      .join("")}
  </div>
</section>`;
    case "contact":
      return `<section class="contact">
  ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
  ${s.subheading ? `<p class="muted">${esc(s.subheading)}</p>` : ""}
  <form class="contact-form" onsubmit="event.preventDefault();alert('Demo only.');">
    <input type="text" placeholder="Your name" required />
    <input type="email" placeholder="Email" required />
    <textarea rows="4" placeholder="Message" required></textarea>
    <button type="submit" class="btn">${esc(s.ctaLabel) || "Send message"}</button>
  </form>
</section>`;
    case "cta":
    default:
      return `<section class="cta-section" style="background:${p.primary};color:${p.bg};">
  <h2 style="color:${p.bg};">${esc(s.heading)}</h2>
  ${s.subheading ? `<p>${esc(s.subheading)}</p>` : ""}
  ${s.ctaLabel ? `<a class="btn inverse" href="${esc(s.ctaHref) || "#"}">${esc(s.ctaLabel)}</a>` : ""}
</section>`;
  }
}

export function pageHTML(page: RedesignPage, t: DesignTemplate, redesign: Redesign): string {
  const body = page.sections.map((s) => sectionHTML(s, t)).join("\n");
  const nav = page.nav
    .slice(0, 5)
    .map(
      (n) =>
        `<a href="${esc(linkToPage(n.href, redesign))}">${esc(n.label)}</a>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(page.title)} · ${esc(redesign.brand.name)}</title>
<meta name="description" content="${esc(page.metaDescription)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${esc(fontImportUrl(t.typography.heading, t.typography.body))}" rel="stylesheet" />
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<header class="site-header">
  <a class="brand" href="index.html">${esc(redesign.brand.name)}</a>
  <nav>${nav}</nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div>© ${new Date().getFullYear()} ${esc(redesign.brand.name)} · ${esc(redesign.brand.tagline)}</div>
</footer>
</body>
</html>
`;
}

function linkToPage(href: string, redesign: Redesign): string {
  const match = redesign.pages.find(
    (p) => p.slug && href.toLowerCase().includes(p.slug.toLowerCase()),
  );
  if (match) {
    return pageFilename(match, redesign);
  }
  return href || "#";
}

function pageFilename(page: RedesignPage, redesign: Redesign): string {
  const idx = redesign.pages.indexOf(page);
  if (idx === 0) return "index.html";
  return `${page.slug || `page-${idx + 1}`}.html`;
}

export function styleSheet(t: DesignTemplate): string {
  const p = t.palette;
  const upper = t.typography.headingCase === "uppercase";
  const italic = t.typography.headingStyle === "italic";
  return `:root {
  --bg: ${p.bg};
  --surface: ${p.surface};
  --text: ${p.text};
  --muted: ${p.muted};
  --primary: ${p.primary};
  --accent: ${p.accent};
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: '${t.typography.body}', system-ui, sans-serif;
  font-weight: ${t.typography.bodyWeight};
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 {
  font-family: '${t.typography.heading}', serif;
  font-weight: ${t.typography.headingWeight};
  font-style: ${italic ? "italic" : "normal"};
  text-transform: ${upper ? "uppercase" : "none"};
  letter-spacing: ${upper ? "0.04em" : "-0.02em"};
  line-height: 1.05;
  margin: 0 0 0.5em;
}
h1 { font-size: clamp(2.5rem, 7vw, 5.5rem); }
h2 { font-size: clamp(1.75rem, 3vw, 2.75rem); }
h3 { font-size: 1.15rem; margin-bottom: 0.5rem; }
a { color: inherit; text-decoration: none; }
p { color: var(--muted); margin: 0 0 1rem; }
.muted { color: var(--muted); }
.center { text-align: center; }
.kicker {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}
.site-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.5rem 2rem; border-bottom: 1px solid ${p.muted}22;
}
.site-header .brand {
  font-family: '${t.typography.heading}', serif;
  font-weight: 700; letter-spacing: -0.02em;
  text-transform: ${upper ? "uppercase" : "none"};
}
.site-header nav { display: flex; gap: 1.5rem; font-size: 0.85rem; color: var(--muted); }
main > section { padding: clamp(3rem, 8vw, 6rem) 2rem; max-width: 1200px; margin: 0 auto; }
.hero .lead { max-width: 640px; font-size: 1.125rem; }
.btn {
  display: inline-block;
  padding: 0.9rem 1.75rem;
  border-radius: 999px;
  background: var(--primary);
  color: var(--bg);
  font-weight: 700;
  margin-top: 1.25rem;
  transition: transform 0.15s;
  cursor: pointer;
  border: 0;
}
.btn:hover { transform: translateY(-1px); }
.btn.inverse { background: var(--bg); color: var(--primary); }
.grid { display: grid; gap: 1.5rem; }
.grid-3 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.grid-4 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.card { background: var(--surface); border: 1px solid ${p.muted}22; padding: 1.5rem; border-radius: 16px; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
.split.reverse > *:first-child { order: 2; }
.split img { width: 100%; height: 100%; max-height: 420px; object-fit: cover; border-radius: 16px; }
.stats { background: var(--surface); }
.stats-grid { margin-top: 2rem; }
.stat-value { font-family: '${t.typography.heading}', serif; font-size: 2.5rem; color: var(--accent); font-weight: ${t.typography.headingWeight}; }
.stat-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); margin-top: 0.25rem; }
.quote blockquote { font-family: '${t.typography.heading}', serif; font-size: clamp(1.5rem, 3vw, 2.25rem); line-height: 1.3; max-width: 900px; margin: 0 0 1rem; font-style: ${italic ? "italic" : "normal"}; }
.gallery img { width: 100%; height: 220px; object-fit: cover; border-radius: 12px; }
.logos { background: var(--surface); padding: 2.5rem 2rem; }
.logo-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 2.5rem; margin-top: 1.5rem; opacity: 0.7; font-family: '${t.typography.heading}', serif; font-weight: ${t.typography.headingWeight}; }
.pricing-card .price { font-family: '${t.typography.heading}', serif; font-size: 2rem; margin: 0.5rem 0; color: var(--text); }
.faq details { padding: 1rem 0; border-bottom: 1px solid ${p.muted}30; }
.faq summary { font-weight: 700; cursor: pointer; color: var(--text); }
.member .avatar { aspect-ratio: 1/1; background: var(--surface); border-radius: 16px; margin-bottom: 0.75rem; }
.member-name { font-weight: 700; }
.contact-form { display: grid; gap: 0.75rem; max-width: 480px; margin-top: 2rem; }
.contact-form input, .contact-form textarea { padding: 0.85rem; border-radius: 10px; background: var(--bg); color: var(--text); border: 1px solid ${p.muted}40; font-family: inherit; }
.cta-section { text-align: center; }
.cta-section p { color: inherit; opacity: 0.85; max-width: 640px; margin: 0 auto 1.25rem; }
.site-footer { padding: 2rem; border-top: 1px solid ${p.muted}22; color: var(--muted); font-size: 0.85rem; text-align: center; }
@media (max-width: 720px) {
  .split { grid-template-columns: 1fr; }
  .split.reverse > *:first-child { order: 0; }
  .site-header nav { display: none; }
}
`;
}

export async function buildExportZip(
  zip: JSZip,
  redesign: Redesign,
  template: DesignTemplate,
): Promise<void> {
  for (const page of redesign.pages) {
    const filename = pageFilename(page, redesign);
    zip.file(filename, pageHTML(page, template, redesign));
  }
  zip.file("styles.css", styleSheet(template));
  zip.file(
    "README.txt",
    `SiteReimaginer AI demo export
Brand: ${redesign.brand.name}
Template: ${template.name} (${template.id})
Pages: ${redesign.pages.map((p, i) => `${i + 1}. ${p.title}`).join(", ")}

Open index.html in a browser, or drop this folder into any static host
(Netlify, Vercel, S3, GitHub Pages). All assets are either inline or
loaded from the original site — downloading/caching those locally is
left to the final build.
`,
  );
}
