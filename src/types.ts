export interface ScrapedImage {
  src: string;
  alt: string;
  role: "logo" | "og" | "hero" | "content";
  width?: number;
  height?: number;
}

export interface ScrapedPage {
  url: string;
  path: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  navLinks: Array<{ label: string; href: string }>;
  ctas: string[];
  paragraphs: string[];
  images: ScrapedImage[];
}

export interface BrandTokens {
  name: string;
  tagline: string;
  detectedColors: string[];
  detectedFonts: string[];
  emails: string[];
  phones: string[];
  socials: Array<{ platform: string; url: string }>;
}

export interface ScrapedSite {
  rootUrl: string;
  origin: string;
  scrapedAt: string;
  brand: BrandTokens;
  pages: ScrapedPage[];
  allImages: ScrapedImage[];
}

export interface DesignTemplate {
  id: string;
  name: string;
  blurb: string;
  mood: string[];
  palette: {
    primary: string;
    accent: string;
    bg: string;
    surface: string;
    text: string;
    muted: string;
  };
  typography: {
    heading: string;
    body: string;
    headingWeight: number;
    bodyWeight: number;
    headingStyle?: "italic" | "normal";
    headingCase?: "normal" | "uppercase";
  };
  layoutDNA: string;
  bestFor: string[];
}

export type SectionKind =
  | "hero"
  | "feature-grid"
  | "image-split"
  | "stats"
  | "quote"
  | "gallery"
  | "cta"
  | "logos"
  | "pricing"
  | "faq"
  | "team"
  | "contact";

export interface RedesignSection {
  kind: SectionKind;
  heading?: string;
  subheading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  imageUrls?: string[];
  alignment?: "left" | "right";
  items?: Array<{
    title?: string;
    body?: string;
    value?: string;
    label?: string;
    icon?: string;
  }>;
  attribution?: string;
}

export interface RedesignPage {
  slug: string;
  title: string;
  metaDescription: string;
  nav: Array<{ label: string; href: string }>;
  sections: RedesignSection[];
}

export interface Redesign {
  brand: {
    name: string;
    tagline: string;
    voice: string;
  };
  templateId: string;
  palette: DesignTemplate["palette"];
  typography: DesignTemplate["typography"];
  pages: RedesignPage[];
  suggestions: string[];
  metrics: {
    designScore: string;
    contentClarity: string;
    loadSpeed: string;
    accessibility: string;
  };
  chartData: Array<{ section: string; weight: number; target: number }>;
}
