import React from "react";
import JSZip from "jszip";
import type {
  DesignTemplate,
  Redesign,
  RedesignPage,
  RedesignSection,
} from "./types";
import { generateTemplateCSS } from "./templateEngine";

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

export function sectionHTML(s: RedesignSection, _t: DesignTemplate): string {
  const sectionHead = (eyebrow: string, heading?: string, subheading?: string) => `
  <div class="section-head">
    <div class="eyebrow">${esc(eyebrow)}</div>
    <div>
      ${heading ? `<h2>${esc(heading)}</h2>` : ""}
      ${subheading ? `<p class="lede">${esc(subheading)}</p>` : ""}
    </div>
  </div>`;

  switch (s.kind) {
    case "hero":
      return `<section class="hero">
  <div class="wrap">
    <div>
      ${s.subheading ? `<div class="eyebrow">${esc(s.subheading)}</div>` : ""}
      <h1 class="display">${esc(s.heading)}</h1>
      ${s.body ? `<p class="lede">${esc(s.body)}</p>` : ""}
      <div class="ctas">${s.ctaLabel ? `<a class="btn btn--primary" href="${esc(s.ctaHref) || "#"}">${esc(s.ctaLabel)}</a>` : ""}</div>
      <div class="meta"><span><b>${String((s.items || []).length || 3)}</b>Proof points</span><span><b>Static</b>Export ready</span></div>
    </div>
    ${s.imageUrl ? `<figure class="hero-figure"><img src="${esc(s.imageUrl)}" alt="" loading="lazy" /></figure>` : `<div class="hero-figure"></div>`}
  </div>
</section>`;
    case "feature-grid":
      return `<section class="section features">
  <div class="wrap">
    ${sectionHead("Capabilities", s.heading, s.subheading)}
    <div class="feature-grid">
      ${(s.items || []).map((it) => `<article class="card"><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p></article>`).join("")}
    </div>
  </div>
</section>`;
    case "image-split":
      return `<section class="section image-split">
  <div class="wrap split ${s.alignment === "right" ? "reverse" : ""}">
    <div>
      ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}
      ${s.body ? `<p class="lede">${esc(s.body)}</p>` : ""}
      ${s.ctaLabel ? `<a class="btn" href="${esc(s.ctaHref) || "#"}">${esc(s.ctaLabel)}</a>` : ""}
    </div>
    ${s.imageUrl ? `<img src="${esc(s.imageUrl)}" alt="" loading="lazy" />` : ""}
  </div>
</section>`;
    case "stats":
      return `<section class="section stats">
  <div class="wrap">
    ${sectionHead("Signals", s.heading)}
    <div class="stats-grid">
      ${(s.items || []).map((it) => `<div class="stat card"><div class="stat-value">${esc(it.value)}</div><div class="stat-label">${esc(it.label)}</div></div>`).join("")}
    </div>
  </div>
</section>`;
    case "quote":
      return `<section class="section pullquote">
  <div class="wrap">
    <div class="mark">“</div>
    <div><blockquote>${esc(s.body)}</blockquote>${s.attribution ? `<cite>— ${esc(s.attribution)}</cite>` : ""}</div>
  </div>
</section>`;
    case "gallery":
      return `<section class="gallery">
  <div class="wrap">
    <div class="head"><div class="eyebrow">Gallery</div>${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}</div>
    <div class="pair">${(s.imageUrls || []).slice(0, 2).map((src, index) => `<figure><img src="${esc(src)}" alt="" loading="lazy" /><figcaption>Image ${index + 1}</figcaption></figure>`).join("")}</div>
  </div>
</section>`;
    case "logos":
      return `<section class="section logos">
  <div class="wrap">
    <div class="eyebrow">${esc(s.heading) || "Proof"}</div>
    <div class="logo-row">${(s.items || []).map((it) => `<span>${esc(it.label || it.title)}</span>`).join("")}</div>
  </div>
</section>`;
    case "pricing":
      return `<section class="section pricing">
  <div class="wrap">
    ${sectionHead("Process", s.heading)}
    <div class="feature-grid">${(s.items || []).map((it) => `<article class="card pricing-card"><div class="muted">${esc(it.label)}</div><div class="price">${esc(it.value)}</div><p>${esc(it.body)}</p></article>`).join("")}</div>
  </div>
</section>`;
    case "faq":
      return `<section class="faq">
  <div class="wrap grid">
    <div>${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}</div>
    <div>${(s.items || []).map((it) => `<details><summary>${esc(it.title)}</summary><div>${esc(it.body)}</div></details>`).join("")}</div>
  </div>
</section>`;
    case "team":
      return `<section class="section team">
  <div class="wrap">
    ${sectionHead("Team", s.heading)}
    <div class="stats-grid">${(s.items || []).map((it) => `<div class="member"><div class="avatar"></div><div class="member-name">${esc(it.title)}</div><div class="muted">${esc(it.label)}</div></div>`).join("")}</div>
  </div>
</section>`;
    case "contact":
      return `<section class="section contact">
  <div class="wrap contact-layout">
    <div>${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}${s.subheading ? `<p class="lede">${esc(s.subheading)}</p>` : ""}</div>
    <form onsubmit="event.preventDefault();alert('Static export: connect this form before launch.');">
      <div class="field"><label>Name</label><input type="text" required /></div>
      <div class="field"><label>Email</label><input type="email" required /></div>
      <div class="field full"><label>Message</label><textarea required></textarea></div>
      <button type="submit" class="btn btn--primary">${esc(s.ctaLabel) || "Send message"}</button>
    </form>
  </div>
</section>`;
    case "cta":
    default:
      return `<section class="cta-banner">
  <div class="wrap">
    <div>${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}${s.subheading ? `<p>${esc(s.subheading)}</p>` : ""}</div>
    <div class="ctas">${s.ctaLabel ? `<a class="btn btn--primary" href="${esc(s.ctaHref) || "#"}">${esc(s.ctaLabel)}</a>` : ""}</div>
  </div>
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
<header class="masthead">
  <div class="wrap">
    <div></div>
    <a class="wordmark" href="index.html"><span class="name">${esc(redesign.brand.name)}</span><span class="est">Static conversion system</span></a>
    <nav>${nav}</nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="colophon">
  <div class="wrap">
    <div class="brand-block"><span class="name">${esc(redesign.brand.name)}</span><p>${esc(redesign.brand.tagline)}</p></div>
    <div><h5>Pages</h5><ul>${pageList(redesign)}</ul></div>
    <div><h5>Template</h5><ul><li>${esc(t.name)}</li><li>${esc(t.id)}</li></ul></div>
    <div><h5>Handoff</h5><ul><li>HTML/CSS export</li><li>Design system included</li></ul></div>
    <div class="legal">© ${new Date().getFullYear()} ${esc(redesign.brand.name)}<span>Generated by WebSwap</span></div>
  </div>
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

export function pageFilename(page: RedesignPage, redesign: Redesign): string {
  const idx = redesign.pages.indexOf(page);
  if (idx === 0) return "index.html";
  return `${page.slug || `page-${idx + 1}`}.html`;
}

function pageList(redesign: Redesign): string {
  return redesign.pages
    .map((page) => `<li><a href="${esc(pageFilename(page, redesign))}">${esc(page.title)}</a></li>`)
    .join("");
}

export function styleSheet(t: DesignTemplate): string {
  return generateTemplateCSS(t);
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
  zip.file("DESIGN_SYSTEM.md", designSystemMarkdown(redesign, template));
  zip.file(
    "README.txt",
    `WebSwap static site export
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

function designSystemMarkdown(redesign: Redesign, template: DesignTemplate): string {
  return `# ${redesign.brand.name} Design System

## Template

- Template: ${template.name}
- Template ID: ${template.id}
- Mood: ${template.mood.join(", ")}

## Palette

- Primary: ${template.palette.primary}
- Accent: ${template.palette.accent}
- Background: ${template.palette.bg}
- Surface: ${template.palette.surface}
- Text: ${template.palette.text}
- Muted: ${template.palette.muted}

## Typography

- Heading: ${template.typography.heading} (${template.typography.headingWeight})
- Body: ${template.typography.body} (${template.typography.bodyWeight})

## Layout DNA

${template.layoutDNA}

## Generated Pages

${redesign.pages.map((page, index) => `${index + 1}. ${page.title} (${pageFilename(page, redesign)})`).join("\n")}

## Final Agent Handoff

Use the exported HTML and CSS as the canonical implementation baseline. Preserve the palette, typography, spacing rhythm, and section structure unless a client-specific edit requires a deliberate deviation.
`;
}
