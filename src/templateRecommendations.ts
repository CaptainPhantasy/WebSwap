import type { DesignTemplate, ScrapedSite } from "./types";
import { classifyPages, classifySiteIndustry, type BusinessCategory } from "./pageClassifier";

export interface TemplateRecommendation {
  templateId: string;
  templateName: string;
  score: number;
  reasons: string[];
}

const CATEGORY_TERMS: Record<BusinessCategory, string[]> = {
  "service-trade": ["service", "services", "trust", "utility", "professional", "compliance", "local"],
  professional: ["law", "firms", "professional", "authoritative", "consulting", "trust"],
  hospitality: ["hospitality", "food", "beverage", "restaurant", "bar", "hotel", "nightclub", "events", "warm", "luxury"],
  retail: ["retail", "shop", "e-commerce", "boutique", "lifestyle", "dtc", "products"],
  creative: ["creative", "studio", "portfolio", "gallery", "festival", "record", "agency"],
  "tech-saas": ["saas", "technical", "data", "grid", "engineered", "platform", "developers"],
  healthcare: ["health", "wellness", "clinic", "professional", "trust", "clear"],
  "real-estate": ["architecture", "property", "luxury", "sculptural", "minimal"],
  education: ["education", "courses", "clear", "utility", "authoritative"],
  general: ["clear", "trust", "professional", "portfolio", "utility"],
};

export function rankTemplatesForSite(
  site: ScrapedSite,
  templates: readonly DesignTemplate[],
): TemplateRecommendation[] {
  const industry = classifySiteIndustry(site);
  const pages = classifyPages(site);
  const pageLabels = new Set(pages.map((page) => page.label));
  const terms = CATEGORY_TERMS[industry.category];
  const hasStrongImagery = site.allImages.length >= Math.max(3, site.pages.length);
  const hasManyPages = site.pages.length >= 5;

  return templates
    .map((template) => {
      const haystack = [
        template.id,
        template.name,
        template.blurb,
        template.layoutDNA,
        ...template.mood,
        ...template.bestFor,
      ]
        .join(" ")
        .toLowerCase();

      let score = Math.round(industry.confidence * 25);
      const reasons: string[] = [];

      for (const term of terms) {
        if (haystack.includes(term.toLowerCase())) score += 12;
      }

      const directBestFor = template.bestFor.filter((term) =>
        terms.some((needle) => term.toLowerCase().includes(needle.toLowerCase()) || needle.toLowerCase().includes(term.toLowerCase())),
      );
      if (directBestFor.length) {
        reasons.push(`Matches ${industry.category} signal via ${directBestFor.slice(0, 2).join(", ")}.`);
        score += directBestFor.length * 10;
      }

      if (pageLabels.has("menu") && /hospitality|food|beverage|warm|prestige|luxury/.test(haystack)) {
        score += 18;
        reasons.push("Source includes menu/dining signals that fit this visual system.");
      }
      if (pageLabels.has("events") && /event|festival|hospitality|night|monolith|bold/.test(haystack)) {
        score += 16;
        reasons.push("Source includes events signals that benefit from a stronger experiential layout.");
      }
      if (pageLabels.has("gallery-portfolio") && /portfolio|gallery|creative|sculptural|editorial/.test(haystack)) {
        score += 16;
        reasons.push("Source includes gallery or portfolio content this template can showcase.");
      }
      if (hasStrongImagery && /gallery|visual|cinematic|sculptural|hospitality|organic/.test(haystack)) {
        score += 10;
        reasons.push("Source has enough imagery to support a visually led direction.");
      }
      if (hasManyPages && /grid|utility|saas|technical|system|dense/.test(haystack)) {
        score += 8;
        reasons.push("Source has enough page depth for a structured system layout.");
      }

      if (!reasons.length) {
        reasons.push(`Best available fit for ${industry.category} based on mood, layout, and template metadata.`);
      }

      return {
        templateId: template.id,
        templateName: template.name,
        score,
        reasons: reasons.slice(0, 3),
      };
    })
    .sort((a, b) => b.score - a.score || a.templateName.localeCompare(b.templateName))
    .slice(0, 3);
}
