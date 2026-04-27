import type { ScrapedSite, ScrapedPage } from "./types";

// ── Business type classification ──

export type BusinessCategory =
  | "service-trade"     // plumber, electrician, HVAC, landscaper, cleaner
  | "professional"      // law, accounting, consulting, medical practice
  | "hospitality"       // restaurant, bar, nightclub, hotel, cafe
  | "retail"            // shop, e-commerce, boutique
  | "creative"          // agency, studio, gallery, media
  | "tech-saas"         // SaaS, dev tools, platforms, AI startups
  | "healthcare"        // clinic, dentist, vet, therapy
  | "real-estate"       // agency, property management, developer
  | "education"         // school, tutoring, courses, coaching
  | "general";          // fallback

export interface PageClassification {
  index: number;
  page: ScrapedPage;
  label: PageLabel;
  confidence: number; // 0-1
}

export type PageLabel =
  | "home"
  | "about"
  | "services"
  | "products"
  | "menu"
  | "events"
  | "gallery-portfolio"
  | "team"
  | "contact"
  | "faq"
  | "pricing"
  | "blog-news"
  | "locations"
  | "booking"
  | "other";

// ── Industry classification from full scraped site ──

export function classifySiteIndustry(site: ScrapedSite): {
  category: BusinessCategory;
  confidence: number;
  evidence: string[];
} {
  const allText = siteAllText(site);
  const scores: Record<BusinessCategory, { score: number; evidence: string[] }> = {
    "service-trade":  scoreCategory(allText, serviceTradePatterns),
    professional:     scoreCategory(allText, professionalPatterns),
    hospitality:      scoreCategory(allText, hospitalityPatterns),
    retail:           scoreCategory(allText, retailPatterns),
    creative:         scoreCategory(allText, creativePatterns),
    "tech-saas":      scoreCategory(allText, techSaasPatterns),
    healthcare:       scoreCategory(allText, healthcarePatterns),
    "real-estate":    scoreCategory(allText, realEstatePatterns),
    education:        scoreCategory(allText, educationPatterns),
    general:          { score: 0.5, evidence: ["no strong industry signal — using generic layout"] },
  };

  // Boost by nav paths
  const paths = site.pages.map((p) => p.path.toLowerCase());
  for (const cat of Object.keys(scores) as BusinessCategory[]) {
    const boost = pathBoost(paths, cat);
    if (boost > 0) {
      scores[cat].score += boost;
      scores[cat].evidence.push(`nav path signal (+${boost.toFixed(1)})`);
    }
  }

  const ranked = (Object.entries(scores) as [BusinessCategory, typeof scores[BusinessCategory]][])
    .sort((a, b) => b[1].score - a[1].score);

  const winner = ranked[0];
  return {
    category: winner[0],
    confidence: Math.min(1, winner[1].score / 8),
    evidence: winner[1].evidence,
  };
}

// ── Classify each scraped page ──

export function classifyPages(site: ScrapedSite): PageClassification[] {
  const industry = classifySiteIndustry(site);
  return site.pages.map((page, index) => {
    const result = classifySinglePage(page, index, site, industry.category);
    return { index, page, label: result.label, confidence: result.confidence };
  });
}

function classifySinglePage(
  page: ScrapedPage,
  index: number,
  site: ScrapedSite,
  industry: BusinessCategory,
): { label: PageLabel; confidence: number } {
  const path = page.path.toLowerCase();
  const text = pageText(page);

  // Explicit path matches — highest confidence
  if (index === 0 || path === "/" || path === "" || /^\/index/.test(path)) {
    return { label: "home", confidence: 1.0 };
  }

  // Contact-oriented paths
  if (/\/contact|\/schedule|\/quote|\/estimate|\/book|\/appointment|\/get-in-touch|\/reach-us/.test(path)) {
    return { label: "contact", confidence: 0.95 };
  }

  // About / story / team
  if (/\/about|\/story|\/team|\/company|\/who-we-are|\/our-team/.test(path)) {
    if (/team/.test(path) || /team|our team/.test(text)) {
      return { label: "team", confidence: 0.9 };
    }
    return { label: "about", confidence: 0.9 };
  }

  // Industry-specific path matching
  switch (industry) {
    case "hospitality": {
      if (/\/menu|\/food|\/drinks|\/dining|\/cocktails/.test(path)) return { label: "menu", confidence: 0.9 };
      if (/\/events|\/private-events|\/party|\/booking|\/reservation/.test(path)) return { label: "events", confidence: 0.85 };
      if (/\/gallery|\/photos|\/tour/.test(path)) return { label: "gallery-portfolio", confidence: 0.8 };
      break;
    }
    case "retail": {
      if (/\/shop|\/products|\/collection|\/new|\/sale/.test(path)) return { label: "products", confidence: 0.9 };
      if (/\/locations|\/stores|\/find-us/.test(path)) return { label: "locations", confidence: 0.85 };
      break;
    }
    case "creative": {
      if (/\/work|\/portfolio|\/projects|\/case-studies/.test(path)) return { label: "gallery-portfolio", confidence: 0.9 };
      if (/\/services|\/capabilities/.test(path)) return { label: "services", confidence: 0.8 };
      break;
    }
    case "tech-saas": {
      if (/\/features|\/product|\/platform|\/solutions/.test(path)) return { label: "products", confidence: 0.9 };
      if (/\/pricing|\/plans/.test(path)) return { label: "pricing", confidence: 0.9 };
      if (/\/docs|\/api|\/developers/.test(path)) return { label: "other", confidence: 0.7 };
      break;
    }
    case "service-trade":
    case "professional":
    case "healthcare": {
      if (/\/services|\/repair|\/treatment|\/practice-areas/.test(path)) return { label: "services", confidence: 0.9 };
      if (/\/areas|\/locations|\/coverage/.test(path)) return { label: "locations", confidence: 0.85 };
      break;
    }
    case "real-estate": {
      if (/\/listings|\/properties|\/homes|\/rentals/.test(path)) return { label: "products", confidence: 0.9 };
      if (/\/neighborhoods|\/areas/.test(path)) return { label: "locations", confidence: 0.85 };
      break;
    }
    case "education": {
      if (/\/courses|\/programs|\/curriculum/.test(path)) return { label: "products", confidence: 0.9 };
      if (/\/faculty|\/instructors/.test(path)) return { label: "team", confidence: 0.8 };
      break;
    }
  }

  // Content-based fallback
  const contentLabel = classifyByContent(text, page, industry);
  if (contentLabel) return contentLabel;

  // Industry-aware normalization: remap labels that don't make sense for this business type.
  // A nightclub's /services page is really events/menu, retail's /services is products, etc.
  const normalized = normalizeLabelForIndustry("other", text, industry);
  if (normalized) return normalized;

  return { label: "other", confidence: 0.2 };
}

function classifyByContent(
  text: string,
  page: ScrapedPage,
  industry: BusinessCategory,
): { label: PageLabel; confidence: number } | null {
  // Pricing page signals
  if (/\b(pricing|plans|rates|fees|starting at|cost)\b/i.test(text) && text.length < 2000) {
    return { label: "pricing", confidence: 0.7 };
  }

  // FAQ page signals
  if (/(frequently asked|common questions|faq|q&a)/i.test(text)) {
    return { label: "faq", confidence: 0.85 };
  }

  // Blog/news
  if (/(blog|news|articles|press|media|updates)/i.test(page.path)) {
    return { label: "blog-news", confidence: 0.8 };
  }

  // Service-like content
  if (industry !== "hospitality" && industry !== "retail" && industry !== "tech-saas") {
    if (/\b(service|repair|install|maintenance|replacement|treatment|consultation)\b/i.test(text)) {
      return { label: "services", confidence: 0.65 };
    }
  }

  // Menu-like content
  if (industry === "hospitality" || industry === "retail") {
    if (/(menu|appetizer|entree|dessert|drink|cocktail|wine list|price|order)/i.test(text)) {
      return { label: "menu", confidence: 0.7 };
    }
  }

  // Product-like content
  if (/(product|shop|buy|order|cart|checkout|inventory|collection)/i.test(text)) {
    return { label: "products", confidence: 0.6 };
  }

  return null;
}

// Industry-aware label remapping: when a page's classified label doesn't make sense
// for the site's business type, reclassify based on content patterns.
function normalizeLabelForIndustry(
  label: PageLabel,
  text: string,
  industry: BusinessCategory,
): { label: PageLabel; confidence: number } | null {
  if (label === "services" || label === "other") {
    switch (industry) {
      case "hospitality": {
        if (/\b(event|private|party|dj|wedding|banquet|catering|celebration|guest list|bottle service|vip|table)\b/i.test(text)) {
          return { label: "events", confidence: 0.65 };
        }
        if (/\b(menu|appetizer|entrée|entree|dessert|drink|cocktail|wine|beer|spirit|food|dining|cuisine|chef|kitchen)\b/i.test(text)) {
          return { label: "menu", confidence: 0.65 };
        }
        if (/\b(gallery|photos|tour|venue|space|interior)\b/i.test(text)) {
          return { label: "gallery-portfolio", confidence: 0.55 };
        }
        return { label: "menu", confidence: 0.4 };
      }
      case "retail": {
        if (/\b(product|shop|buy|cart|checkout|inventory|collection|merchandise|apparel|clothing|accessor|sale|new arrival)\b/i.test(text)) {
          return { label: "products", confidence: 0.65 };
        }
        if (/\b(location|store|find us|visit|direction)\b/i.test(text)) {
          return { label: "locations", confidence: 0.55 };
        }
        return { label: "products", confidence: 0.4 };
      }
      case "tech-saas": {
        if (/\b(pricing|plan|subscription|tier|starting at|per month|per seat|enterprise)\b/i.test(text)) {
          return { label: "pricing", confidence: 0.65 };
        }
        if (/\b(feature|product|platform|solution|integration|api|sdk|developer)\b/i.test(text)) {
          return { label: "products", confidence: 0.65 };
        }
        return { label: "products", confidence: 0.4 };
      }
      case "education": {
        if (/\b(course|class|program|curriculum|workshop|seminar|certification|degree|major|minor|enroll|admission)\b/i.test(text)) {
          return { label: "products", confidence: 0.65 };
        }
        if (/\b(faculty|instructor|professor|teacher|staff)\b/i.test(text)) {
          return { label: "team", confidence: 0.55 };
        }
        return { label: "products", confidence: 0.4 };
      }
      case "real-estate": {
        if (/\b(listing|property|home|house|condo|apartment|for sale|for rent|buy|sell|lease)\b/i.test(text)) {
          return { label: "products", confidence: 0.65 };
        }
        if (/\b(neighborhood|area|location|community|market)\b/i.test(text)) {
          return { label: "locations", confidence: 0.55 };
        }
        return { label: "products", confidence: 0.4 };
      }
      default:
        return null;
    }
  }

  if (label === "products") {
    switch (industry) {
      case "service-trade":
      case "healthcare":
      case "professional": {
        if (/\b(service|repair|install|maintenance|replacement|treatment|consultation|practice area)\b/i.test(text)) {
          return { label: "services", confidence: 0.6 };
        }
        if (/\b(about|story|who we are|mission|history|company)\b/i.test(text)) {
          return { label: "about", confidence: 0.5 };
        }
        return { label: "services", confidence: 0.4 };
      }
      default:
        return null;
    }
  }

  return null;
}


// ── Choose the right secondary page for the blueprint ──

export interface SecondaryPageChoice {
  index: number;
  slug: string;
  title: string;
  label: PageLabel;
  category: BusinessCategory;
}

export function classifySecondaryPage(site: ScrapedSite): SecondaryPageChoice {
  const industry = classifySiteIndustry(site);
  const allPages = classifyPages(site);

  // Find the best non-home, non-contact page
  const candidates = allPages.filter((p) => p.label !== "home" && p.label !== "contact");

  // Score candidates by: explicit classification confidence + content richness + industry match
  const scored = candidates.map((c) => {
    const page = c.page;
    const contentRichness = Math.min(1, (page.paragraphs.length * 40 + page.h2.length * 30 + page.h1.length * 50) / 200);

    // Prefer pages that match the industry's expected secondary page type
    const industryMatch = expectedSecondaryLabel(industry.category) === c.label ? 0.3 : 0;

    return {
      index: c.index,
      page,
      label: c.label,
      score: c.confidence * 0.4 + contentRichness * 0.3 + industryMatch,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  if (scored.length === 0) {
    // No good candidates — use the richest non-home page
    const richest = site.pages
      .map((p, i) => ({ index: i, page: p, richness: p.paragraphs.length + p.h2.length * 2 + p.h1.length * 3 }))
      .filter((p) => p.index > 0 || site.pages.length === 1)
      .sort((a, b) => b.richness - a.richness);

    const chosen = richest[0] || { index: 0, page: site.pages[0], richness: 0 };
    const fallback = defaultSecondaryForIndustry(industry.category);
    return {
      index: chosen.index,
      slug: fallback.slug,
      title: chosen.page?.title || fallback.title,
      label: fallback.label,
      category: industry.category,
    };
  }

  const winner = scored[0];
  const { slug, title } = pageLabelToRoute(winner.label, winner.page, industry.category);

  return {
    index: winner.index,
    slug,
    title,
    label: winner.label,
    category: industry.category,
  };
}

// ── Helpers ──

function siteAllText(site: ScrapedSite): string {
  return site.pages
    .flatMap((p) => [
      p.path,
      p.title,
      ...p.h1,
      ...p.h2,
      ...p.paragraphs,
      ...p.ctas,
      p.metaDescription,
    ])
    .join(" ")
    .toLowerCase();
}

function pageText(page: ScrapedPage): string {
  return [
    page.title,
    ...page.h1,
    ...page.h2,
    ...page.paragraphs,
    ...page.ctas,
    page.metaDescription,
  ].join(" ").toLowerCase();
}

function scoreCategory(text: string, patterns: RegExp[]): { score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];
  for (const pat of patterns) {
    const matches = text.match(pat);
    if (matches) {
      score += 1.2;
      if (score <= 3) evidence.push(matches[0].trim().slice(0, 60));
    }
  }
  return { score, evidence };
}

function pathBoost(paths: string[], category: BusinessCategory): number {
  const map: Partial<Record<BusinessCategory, RegExp>> = {
    "service-trade": /\/service|\/repair|\/install|coverage|areas/,
    hospitality: /\/menu|\/events|\/drinks|\/dining|\/reservation/,
    retail: /\/shop|\/product|\/collection|\/stores/,
    creative: /\/work|\/portfolio|\/projects|studio/,
    "tech-saas": /\/features|\/pricing|\/docs|\/api|\/platform/,
    healthcare: /\/treatment|\/patient|\/clinic|medical/,
    "real-estate": /\/listings|\/property|\/home|realty/,
    education: /\/course|\/program|academy|learning/,
  };
  const pat = map[category];
  if (!pat) return 0;
  const hits = paths.filter((p) => pat.test(p)).length;
  return hits * 0.4;
}

function expectedSecondaryLabel(category: BusinessCategory): PageLabel {
  switch (category) {
    case "hospitality": return "menu";
    case "retail": return "products";
    case "creative": return "gallery-portfolio";
    case "tech-saas": return "products";
    case "service-trade":
    case "professional":
    case "healthcare": return "services";
    case "real-estate": return "products";
    case "education": return "products";
    default: return "services";
  }
}

function defaultSecondaryForIndustry(category: BusinessCategory): { slug: string; title: string; label: PageLabel } {
  switch (category) {
    case "hospitality": return { slug: "menu", title: "Menu", label: "menu" };
    case "retail": return { slug: "products", title: "Products", label: "products" };
    case "creative": return { slug: "portfolio", title: "Portfolio", label: "gallery-portfolio" };
    case "tech-saas": return { slug: "features", title: "Features", label: "products" };
    case "real-estate": return { slug: "listings", title: "Listings", label: "products" };
    case "education": return { slug: "programs", title: "Programs", label: "products" };
    default: return { slug: "services", title: "Services", label: "services" };
  }
}

function pageLabelToRoute(
  label: PageLabel,
  page: ScrapedPage,
  industry: BusinessCategory,
): { slug: string; title: string } {
  const title = page.title || labelToTitle(label, industry);

  switch (label) {
    case "services": return { slug: "services", title };
    case "products": return { slug: "products", title };
    case "menu": return { slug: "menu", title };
    case "events": return { slug: "events", title };
    case "about": return { slug: "about", title };
    case "team": return { slug: "team", title };
    case "gallery-portfolio": return { slug: "gallery", title };
    case "pricing": return { slug: "pricing", title };
    case "faq": return { slug: "faq", title };
    case "locations": return { slug: "locations", title };
    case "booking": return { slug: "booking", title };
    default: return { slug: "about", title: "About" };
  }
}

function labelToTitle(label: PageLabel, _industry: BusinessCategory): string {
  switch (label) {
    case "services": return "Services";
    case "products": return "Products";
    case "menu": return "Menu";
    case "events": return "Events";
    case "about": return "About";
    case "team": return "Team";
    case "gallery-portfolio": return "Gallery";
    case "pricing": return "Pricing";
    case "faq": return "FAQ";
    case "locations": return "Locations";
    case "booking": return "Book";
    case "contact": return "Contact";
    case "blog-news": return "News";
    default: return "About";
  }
}

// ── Regex pattern sets per industry ──

const serviceTradePatterns: RegExp[] = [
  /\b(plumb(ing|er)?|pipe|drain|faucet|toilet|sink|shower|leak|water heater)\b/i,
  /\b(electric(ian|al)?|wiring|circuit|panel|outlet|breaker|lighting)\b/i,
  /\b(hvac|heating|cooling|furnace|air condition|duct|thermostat)\b/i,
  /\b(landscap(e|ing)|lawn|garden|tree|sprinkler|mow|turf)\b/i,
  /\b(roof(ing|er)?|shingle|gutter|siding|window|door|paint(er|ing)?|handyman|carpentry|masonry)\b/i,
  /\b(clean(ing|er)?|maid|janitorial|custodial)\b/i,
  /\b(on.time|guarantee|licensed|insured|bonded|free estimate|upfront|same day|emergency)\b/i,
  /\b(residential|commercial)\s+(plumbing|electrical|hvac|repair|service)\b/i,
];

const professionalPatterns: RegExp[] = [
  /\b(law|attorney|legal|counsel|litigation|firm|bar association|practice areas)\b/i,
  /\b(account(ant|ing)?|tax|cpa|audit|bookkeeping|payroll|financial)\b/i,
  /\b(consult(ing|ant)?|advisory|strategy|management|operations)\b/i,
  /\b(insurance|coverage|policy|claim|broker)\b/i,
  /\b(notary|paralegal|mediation|arbitration)\b/i,
];

const hospitalityPatterns: RegExp[] = [
  /\b(restaurant|bar|nightclub|lounge|cafe|bistro|pub|tavern|diner|club)\b/i,
  /\b(menu|appetizer|entrée|entree|dessert|drink|cocktail|wine|beer|spirit)\b/i,
  /\b(chef|kitchen|dining|cuisine|farm.to.table|tasting|pairing)\b/i,
  /\b(hotel|inn|resort|motel|bnb|bed and breakfast|lodging|accommodation)\b/i,
  /\b(reservation|booking|table|room|suite|check.in|check.out|concierge)\b/i,
  /\b(venue|private event|wedding|banquet|catering|party|celebration)\b/i,
  /\b(happy hour|brunch|lunch|dinner|late night|weekend)\b/i,
];

const retailPatterns: RegExp[] = [
  /\b(shop|store|boutique|retail|market|marketplace|ecommerce)\b/i,
  /\b(product|collection|inventory|merchandise|apparel|clothing|accessories)\b/i,
  /\b(buy|purchase|order|cart|checkout|shipping|delivery|return)\b/i,
  /\b(sale|discount|clearance|new arrival|limited edition|exclusive)\b/i,
];

const creativePatterns: RegExp[] = [
  /\b(agency|studio|creative|design|brand(ing)?|graphic|illustration)\b/i,
  /\b(portfolio|work|projects|case study|client)\b/i,
  /\b(art direction|visual|motion|animation|video|photography|film|production)\b/i,
  /\b(gallery|exhibition|installation|curator|collection)\b/i,
  /\b(ux|ui|user experience|interface|interaction|digital product)\b/i,
  /\b(record label|music|audio|sound|mixing|mastering|producer)\b/i,
];

const techSaasPatterns: RegExp[] = [
  /\b(saas|platform|api|sdk|cloud|infrastructure|developer tool)\b/i,
  /\b(software|application|app|automation|workflow|integration|pipeline)\b/i,
  /\b(ai|machine learning|artificial intelligence|llm|model|inference)\b/i,
  /\b(analytics|dashboard|reporting|monitoring|observability)\b/i,
  /\b(pricing|plan|subscription|enterprise|startup|scale|deploy)\b/i,
  /\b(fintech|blockchain|crypto|defi|nft|web3)\b/i,
];

const healthcarePatterns: RegExp[] = [
  /\b(clinic|medical|healthcare|doctor|physician|surgeon|specialist)\b/i,
  /\b(dentist|dental|orthodontic|oral|hygiene)\b/i,
  /\b(veterinary|vet|animal hospital|pet care)\b/i,
  /\b(therapy|physical therapy|chiropractic|massage|acupuncture|wellness)\b/i,
  /\b(patient|appointment|treatment|diagnosis|prescription|referral)\b/i,
  /\b(optometry|ophthalmology|eye care|vision|glasses|contacts)\b/i,
];

const realEstatePatterns: RegExp[] = [
  /\b(real estate|realtor|property|home|house|condo|apartment|listing)\b/i,
  /\b(buy|sell|rent|lease|mortgage|financing|closing|escrow)\b/i,
  /\b(neighborhood|community|development|commercial|residential)\b/i,
  /\b(property management|landlord|tenant|maintenance|hoa)\b/i,
];

const educationPatterns: RegExp[] = [
  /\b(school|academy|college|university|institute|training|education)\b/i,
  /\b(course|class|program|curriculum|workshop|seminar|certification)\b/i,
  /\b(tutor(ing)?|coach(ing)?|mentor(ing)?|teach(er|ing)?|instructor|faculty)\b/i,
  /\b(enroll|admission|registration|tuition|scholarship|financial aid)\b/i,
];