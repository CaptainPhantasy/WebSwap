import type { DesignTemplate, ScrapedImage, ScrapedSite } from "./types";

export interface SiteSummaryPage {
  index: number;
  path: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  ctas: string[];
  navLabels: string[];
  paragraphSamples: string[];
  paragraphCount: number;
  images: Array<Pick<ScrapedImage, "src" | "alt" | "role">>;
}

export interface SiteSummary {
  rootUrl: string;
  origin: string;
  scrapedAt: string;
  brand: ScrapedSite["brand"];
  pages: SiteSummaryPage[];
  totals: {
    pages: number;
    images: number;
    paragraphs: number;
    navTargets: number;
  };
  template?: {
    id: string;
    name: string;
    mood: string[];
    layoutDNA: string;
  };
}

export function createSiteSummary(
  site: ScrapedSite,
  template?: DesignTemplate,
): SiteSummary {
  const navLabels = new Set<string>();
  let paragraphCount = 0;

  const pages = site.pages.map((page, index) => {
    page.navLinks.forEach((link) => {
      if (link.label.trim()) navLabels.add(link.label.trim());
    });
    paragraphCount += page.paragraphs.length;

    return {
      index,
      path: page.path,
      title: trimText(page.title, 140),
      metaDescription: trimText(page.metaDescription, 220),
      h1: page.h1.slice(0, 3).map((text) => trimText(text, 140)),
      h2: page.h2.slice(0, 8).map((text) => trimText(text, 140)),
      ctas: page.ctas.slice(0, 8).map((text) => trimText(text, 80)),
      navLabels: Array.from(new Set(page.navLinks.map((n) => n.label.trim()).filter(Boolean))).slice(0, 10),
      paragraphSamples: page.paragraphs.slice(0, 5).map((text) => trimText(text, 320)),
      paragraphCount: page.paragraphs.length,
      images: page.images.slice(0, 6).map((image) => ({
        src: image.src,
        alt: trimText(image.alt, 120),
        role: image.role,
      })),
    };
  });

  return {
    rootUrl: site.rootUrl,
    origin: site.origin,
    scrapedAt: site.scrapedAt,
    brand: site.brand,
    pages,
    totals: {
      pages: site.pages.length,
      images: site.allImages.length,
      paragraphs: paragraphCount,
      navTargets: navLabels.size,
    },
    ...(template
      ? {
          template: {
            id: template.id,
            name: template.name,
            mood: template.mood.slice(0, 6),
            layoutDNA: template.layoutDNA,
          },
        }
      : {}),
  };
}

function trimText(text: string | undefined, limit: number): string {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trim()}…` : normalized;
}
