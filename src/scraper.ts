import { promises as dns } from "dns";
import net from "net";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import type {
  ScrapedImage,
  ScrapedPage,
  ScrapedSite,
  BrandTokens,
} from "./types";

export const MAX_PAGES = 5;
export const MAX_DEPTH = 2;
export const MAX_BYTES = 2_000_000;
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 3;
export const MAX_IMAGES_PER_SITE = 40;

export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
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

export async function assertPublicHost(url: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid URL`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${u.protocol}`);
  }
  const rawHost = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(rawHost)) {
    if (isPrivateIp(rawHost)) throw new Error(`Blocked private address: ${rawHost}`);
    return;
  }
  const records = await dns.lookup(rawHost, { all: true });
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      throw new Error(`Host ${rawHost} resolves to private address ${r.address}`);
    }
  }
}

export async function safeFetchHtml(targetUrl: string): Promise<string | null> {
  let url = targetUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "WebSwapBot/2.0 (+demo)",
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

export function extractPage(html: string, pageUrl: string): ScrapedPage {
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

export function extractBrand(pages: ScrapedPage[], rootHtml: string): BrandTokens {
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
  const fontFamilyRe = /font-family\s*:\s*([^;}]+)/gi;
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

export async function scrapeSite(rootUrl: string): Promise<ScrapedSite> {
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
