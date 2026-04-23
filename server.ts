import express, { type Request, type Response, type NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { promises as dns } from "dns";
import net from "net";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { DESIGN_TEMPLATES, getTemplate } from "./src/templates.ts";
import type {
  ScrapedImage,
  ScrapedPage,
  ScrapedSite,
  BrandTokens,
  Redesign,
} from "./src/types.ts";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ANTHROPIC_MODEL = "claude-opus-4-7";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const MAX_PAGES = 5;
const MAX_DEPTH = 2;
const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_IMAGES_PER_SITE = 40;

function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true;
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      return isPrivateIp(lower.slice("::ffff:".length));
    }
    return false;
  }
  return true;
}

async function assertPublicHost(url: string): Promise<void> {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${u.protocol}`);
  }
  const host = u.hostname;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error(`Blocked private address: ${host}`);
    return;
  }
  const records = await dns.lookup(host, { all: true });
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      throw new Error(`Host ${host} resolves to private address ${r.address}`);
    }
  }
}

async function safeFetchHtml(targetUrl: string): Promise<string | null> {
  let url = targetUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "SiteReimaginerBot/2.0 (+demo)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: controller.signal as any,
      });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const next = res.headers.get("location");
        if (!next) return null;
        url = new URL(next, url).toString();
        continue;
      }
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return null;
      return Buffer.from(buf).toString("utf8");
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractPage(html: string, pageUrl: string): ScrapedPage {
  const $ = cheerio.load(html);
  const u = new URL(pageUrl);

  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  const h1: string[] = [];
  $("h1").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) h1.push(t.slice(0, 200));
  });

  const h2: string[] = [];
  $("h2").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) h2.push(t.slice(0, 200));
  });

  const navLinks: Array<{ label: string; href: string }> = [];
  $("header a, nav a").each((_, el) => {
    const href = $(el).attr("href");
    const label = $(el).text().replace(/\s+/g, " ").trim();
    if (href && label && label.length < 40) {
      const abs = absolutize(href, pageUrl);
      if (abs) navLinks.push({ label, href: abs });
    }
  });

  const ctas: string[] = [];
  $("a.button, a.btn, button, [role=button], a.cta").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length <= 60) ctas.push(t);
  });

  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length >= 40 && t.length <= 600) paragraphs.push(t);
  });

  const seenImg = new Set<string>();
  const images: ScrapedImage[] = [];

  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");
  if (ogImage) {
    const abs = absolutize(ogImage, pageUrl);
    if (abs && !seenImg.has(abs)) {
      seenImg.add(abs);
      images.push({ src: abs, alt: title || "", role: "og" });
    }
  }

  const icon =
    $('link[rel="apple-touch-icon"]').attr("href") ||
    $('link[rel="icon"]').attr("href");
  if (icon) {
    const abs = absolutize(icon, pageUrl);
    if (abs && !seenImg.has(abs)) {
      seenImg.add(abs);
      images.push({ src: abs, alt: "logo", role: "logo" });
    }
  }

  let first = true;
  $("img").each((_, el) => {
    const rawSrc =
      $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    if (!rawSrc) return;
    const abs = absolutize(rawSrc, pageUrl);
    if (!abs) return;
    if (abs.startsWith("data:")) return;
    if (seenImg.has(abs)) return;
    seenImg.add(abs);
    const alt = ($(el).attr("alt") || "").replace(/\s+/g, " ").trim();
    const w = Number($(el).attr("width")) || undefined;
    const h = Number($(el).attr("height")) || undefined;
    const role: ScrapedImage["role"] = first ? "hero" : "content";
    first = false;
    images.push({ src: abs, alt, role, width: w, height: h });
  });

  return {
    url: pageUrl,
    path: u.pathname,
    title,
    metaDescription,
    h1,
    h2,
    navLinks,
    ctas,
    paragraphs: paragraphs.slice(0, 20),
    images,
  };
}

function extractBrand(pages: ScrapedPage[], rootHtml: string): BrandTokens {
  const $ = cheerio.load(rootHtml);
  const siteName =
    $('meta[property="og:site_name"]').attr("content") ||
    $('meta[name="application-name"]').attr("content") ||
    $("title").first().text().split(/[|\-–—]/)[0].trim() ||
    "Your Brand";

  const tagline =
    $('meta[name="description"]').attr("content")?.trim() ||
    pages[0]?.metaDescription ||
    pages[0]?.h1[0] ||
    "";

  const emails = new Set<string>();
  const phones = new Set<string>();
  const socials: Array<{ platform: string; url: string }> = [];
  const seenSocial = new Set<string>();

  const body = pages.flatMap((p) => p.paragraphs).join(" ");
  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const phoneRe = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  for (const m of body.match(emailRe) || []) emails.add(m.toLowerCase());
  for (const m of body.match(phoneRe) || []) phones.add(m);

  const socialHosts: Record<string, string> = {
    "twitter.com": "Twitter",
    "x.com": "X",
    "linkedin.com": "LinkedIn",
    "instagram.com": "Instagram",
    "facebook.com": "Facebook",
    "youtube.com": "YouTube",
    "github.com": "GitHub",
    "tiktok.com": "TikTok",
  };
  for (const p of pages) {
    for (const link of p.navLinks) {
      try {
        const h = new URL(link.href).hostname.replace(/^www\./, "");
        for (const host in socialHosts) {
          if (h.endsWith(host) && !seenSocial.has(link.href)) {
            seenSocial.add(link.href);
            socials.push({ platform: socialHosts[host], url: link.href });
          }
        }
      } catch {}
    }
  }

  const detectedColors = new Set<string>();
  const inlineStyles: string[] = [];
  $("style").each((_, el) => inlineStyles.push($(el).html() || ""));
  $("[style]").each((_, el) => inlineStyles.push($(el).attr("style") || ""));
  const hexRe = /#[0-9A-Fa-f]{6}\b/g;
  for (const css of inlineStyles) {
    for (const m of css.match(hexRe) || []) detectedColors.add(m.toUpperCase());
    if (detectedColors.size >= 16) break;
  }

  const detectedFonts = new Set<string>();
  const fontFamilyRe = /font-family\s*:\s*([^;"}]+)/gi;
  for (const css of inlineStyles) {
    let m: RegExpExecArray | null;
    while ((m = fontFamilyRe.exec(css)) !== null) {
      const names = m[1]
        .split(",")
        .map((s) => s.trim().replace(/['"]/g, ""))
        .filter((s) => s && !/^(serif|sans-serif|monospace|system-ui|ui-[a-z-]+)$/i.test(s));
      for (const n of names) {
        if (n.length < 40) detectedFonts.add(n);
        if (detectedFonts.size >= 8) break;
      }
    }
  }

  return {
    name: siteName,
    tagline,
    detectedColors: Array.from(detectedColors).slice(0, 8),
    detectedFonts: Array.from(detectedFonts).slice(0, 6),
    emails: Array.from(emails).slice(0, 3),
    phones: Array.from(phones).slice(0, 3),
    socials: socials.slice(0, 6),
  };
}

async function scrapeSite(rootUrl: string): Promise<ScrapedSite> {
  const origin = new URL(rootUrl).origin;
  const priorityPaths = ["/", "/about", "/services", "/products", "/work", "/contact"];
  const queue: Array<{ url: string; depth: number }> = [];
  const visited = new Set<string>();

  for (const p of priorityPaths) {
    try {
      const candidate = new URL(p, origin).toString();
      queue.push({ url: candidate, depth: 0 });
    } catch {}
  }
  if (!queue.find((q) => q.url === rootUrl)) {
    queue.unshift({ url: rootUrl, depth: 0 });
  }

  const pages: ScrapedPage[] = [];
  let rootHtml = "";

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const { url, depth } = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const html = await safeFetchHtml(url);
    if (!html) continue;
    if (!rootHtml) rootHtml = html;
    const page = extractPage(html, url);
    pages.push(page);

    if (depth < MAX_DEPTH && pages.length < MAX_PAGES) {
      for (const link of page.navLinks) {
        try {
          const nu = new URL(link.href);
          if (nu.origin !== origin) continue;
          if (visited.has(nu.toString())) continue;
          if (queue.some((q) => q.url === nu.toString())) continue;
          queue.push({ url: nu.toString(), depth: depth + 1 });
        } catch {}
      }
    }
  }

  if (pages.length === 0) {
    throw new Error("Could not scrape any pages from that URL.");
  }

  const brand = extractBrand(pages, rootHtml || "");
  const seen = new Set<string>();
  const allImages: ScrapedImage[] = [];
  for (const p of pages) {
    for (const img of p.images) {
      if (seen.has(img.src)) continue;
      seen.add(img.src);
      allImages.push(img);
      if (allImages.length >= MAX_IMAGES_PER_SITE) break;
    }
    if (allImages.length >= MAX_IMAGES_PER_SITE) break;
  }

  return {
    rootUrl,
    origin,
    scrapedAt: new Date().toISOString(),
    brand,
    pages,
    allImages,
  };
}

const REDESIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "brand",
    "templateId",
    "palette",
    "typography",
    "pages",
    "suggestions",
    "metrics",
    "chartData",
  ],
  properties: {
    brand: {
      type: "object",
      additionalProperties: false,
      required: ["name", "tagline", "voice"],
      properties: {
        name: { type: "string" },
        tagline: { type: "string" },
        voice: { type: "string" },
      },
    },
    templateId: { type: "string" },
    palette: {
      type: "object",
      additionalProperties: false,
      required: ["primary", "accent", "bg", "surface", "text", "muted"],
      properties: {
        primary: { type: "string" },
        accent: { type: "string" },
        bg: { type: "string" },
        surface: { type: "string" },
        text: { type: "string" },
        muted: { type: "string" },
      },
    },
    typography: {
      type: "object",
      additionalProperties: false,
      required: ["heading", "body", "headingWeight", "bodyWeight"],
      properties: {
        heading: { type: "string" },
        body: { type: "string" },
        headingWeight: { type: "integer" },
        bodyWeight: { type: "integer" },
        headingStyle: { type: "string", enum: ["italic", "normal"] },
        headingCase: { type: "string", enum: ["normal", "uppercase"] },
      },
    },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "title", "metaDescription", "nav", "sections"],
        properties: {
          slug: { type: "string" },
          title: { type: "string" },
          metaDescription: { type: "string" },
          nav: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "href"],
              properties: {
                label: { type: "string" },
                href: { type: "string" },
              },
            },
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind"],
              properties: {
                kind: {
                  type: "string",
                  enum: [
                    "hero",
                    "feature-grid",
                    "image-split",
                    "stats",
                    "quote",
                    "gallery",
                    "cta",
                    "logos",
                    "pricing",
                    "faq",
                    "team",
                    "contact",
                  ],
                },
                heading: { type: "string" },
                subheading: { type: "string" },
                body: { type: "string" },
                ctaLabel: { type: "string" },
                ctaHref: { type: "string" },
                imageUrl: { type: "string" },
                imageUrls: { type: "array", items: { type: "string" } },
                alignment: { type: "string", enum: ["left", "right"] },
                attribution: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                      value: { type: "string" },
                      label: { type: "string" },
                      icon: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    suggestions: { type: "array", items: { type: "string" } },
    metrics: {
      type: "object",
      additionalProperties: false,
      required: ["designScore", "contentClarity", "loadSpeed", "accessibility"],
      properties: {
        designScore: { type: "string" },
        contentClarity: { type: "string" },
        loadSpeed: { type: "string" },
        accessibility: { type: "string" },
      },
    },
    chartData: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "weight", "target"],
        properties: {
          section: { type: "string" },
          weight: { type: "number" },
          target: { type: "number" },
        },
      },
    },
  },
} as const;

function trimScrapedForPrompt(site: ScrapedSite): unknown {
  return {
    rootUrl: site.rootUrl,
    brand: site.brand,
    pages: site.pages.map((p) => ({
      path: p.path,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1.slice(0, 4),
      h2: p.h2.slice(0, 10),
      ctas: p.ctas.slice(0, 10),
      navLabels: Array.from(new Set(p.navLinks.map((n) => n.label))).slice(0, 10),
      paragraphs: p.paragraphs.slice(0, 8),
      images: p.images.slice(0, 6).map((i) => ({ src: i.src, alt: i.alt, role: i.role })),
    })),
    allImageUrls: site.allImages.slice(0, 20).map((i) => i.src),
  };
}

function systemPrompt(): string {
  return [
    "You are a senior brand + web designer producing a rapid redesign demo.",
    "You receive (1) the catalog of available design templates and (2) scraped data from a real website.",
    "Your job: pick content and structure from the scraped data and rebuild a 3-page demo site faithful to the chosen template's aesthetic DNA.",
    "",
    "Hard rules:",
    "- Use the scraped brand name, tagline, real copy, and real image URLs. Do not invent company names. Paraphrase only to improve clarity and rhythm.",
    "- Image URLs in the output must come from the provided scraped image list. Do not fabricate URLs.",
    "- Palette and typography must come from the chosen template spec unchanged.",
    "- The demo must be exactly three pages: a home page, a secondary page (about, services, products, or work — whichever the source site emphasizes), and a conversion page (contact or cta).",
    "- Each page should feel structurally different. Do not repeat identical section orders across pages.",
    "- Copy must be concise, professional, client-ready. No lorem ipsum. No meta commentary about the redesign.",
    "- Follow the template's layoutDNA literally when shaping sections.",
    "",
    "AVAILABLE TEMPLATES:",
    JSON.stringify(DESIGN_TEMPLATES, null, 2),
  ].join("\n");
}

async function callClaudeRedesign(
  site: ScrapedSite,
  templateId: string,
  client: Anthropic,
): Promise<Redesign> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown templateId: ${templateId}`);

  const userPrompt = [
    `Chosen template id: ${templateId} (${template.name}).`,
    `Template spec to honor:`,
    JSON.stringify(template, null, 2),
    ``,
    `Scraped site data:`,
    JSON.stringify(trimScrapedForPrompt(site)),
    ``,
    `Produce the 3-page redesign JSON now. Return an object matching the required schema exactly. No prose outside the JSON.`,
  ].join("\n");

  const stream = client.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: 32_000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "xhigh",
      format: { type: "json_schema", schema: REDESIGN_SCHEMA as any },
    } as any,
    system: [
      {
        type: "text",
        text: systemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }
  const parsed = JSON.parse(textBlock.text) as Redesign;
  parsed.templateId = templateId;
  parsed.palette = template.palette;
  parsed.typography = template.typography;
  return parsed;
}

async function startServer() {
  if (!ANTHROPIC_API_KEY) {
    console.error(
      "Missing ANTHROPIC_API_KEY. Copy .env.example to .env.local and set your key.",
    );
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      model: ANTHROPIC_MODEL,
      templateCount: DESIGN_TEMPLATES.length,
    });
  });

  app.get("/api/templates", (_req, res) => {
    res.json({ templates: DESIGN_TEMPLATES });
  });

  app.post("/api/scrape", async (req: Request, res: Response) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Body must include { url: string }" });
    }
    try {
      await assertPublicHost(url);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || "Invalid URL" });
    }
    try {
      const site = await scrapeSite(url);
      res.json({ site });
    } catch (e: any) {
      console.error("[scrape] failed:", e?.message);
      res.status(502).json({ error: e?.message || "Scrape failed" });
    }
  });

  app.post("/api/redesign", async (req: Request, res: Response) => {
    const { site, templateId } = req.body || {};
    if (!site || !templateId) {
      return res
        .status(400)
        .json({ error: "Body must include { site, templateId }" });
    }
    if (!getTemplate(templateId)) {
      return res.status(400).json({ error: `Unknown templateId: ${templateId}` });
    }
    try {
      const redesign = await callClaudeRedesign(site as ScrapedSite, templateId, anthropic);
      res.json({ redesign });
    } catch (e: any) {
      console.error("[redesign] failed:", e);
      const status =
        e instanceof Anthropic.RateLimitError ? 429 :
        e instanceof Anthropic.AuthenticationError ? 401 :
        e instanceof Anthropic.BadRequestError ? 400 :
        500;
      res.status(status).json({ error: e?.message || "Redesign failed" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[unhandled]", err);
    res.status(500).json({ error: "Internal error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SiteReimaginer running at http://localhost:${PORT}`);
    console.log(`Model: ${ANTHROPIC_MODEL} · Templates: ${DESIGN_TEMPLATES.length}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
