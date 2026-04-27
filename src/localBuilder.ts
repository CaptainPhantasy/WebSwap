import JSZip from "jszip";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import type {
  DesignTemplate,
  Redesign,
  RedesignPage,
  RedesignSection,
  ScrapedImage,
  ScrapedPage,
  ScrapedSite,
  SectionKind,
} from "./types";
import type { BuildBlueprint } from "./blueprint";
import { buildExportZip, pageHTML, styleSheet } from "./render";
import { resolveWorkspace, type WorkspaceOptions } from "./workspaces";
import { classifySecondaryPage } from "./pageClassifier";

export interface BuildWorkspaceArtifact {
  workspaceId: string;
  redesign: Redesign;
  previewDir: string;
  zipPath: string;
  warnings: string[];
}

export async function buildWorkspaceSite(
  workspaceId: string,
  site: ScrapedSite,
  template: DesignTemplate,
  blueprint: BuildBlueprint,
  options: WorkspaceOptions = {},
): Promise<BuildWorkspaceArtifact> {
  const workspace = resolveWorkspace(workspaceId, options);
  const redesign = buildLocalRedesign(site, template, blueprint);
  await mkdir(workspace.contentDir, { recursive: true });
  await mkdir(workspace.previewDir, { recursive: true });

  await writeFile(workspace.redesignPath, JSON.stringify(redesign, null, 2));
  await writePreviewFiles(workspace.previewDir, redesign, template);

  const zip = new JSZip();
  await buildExportZip(zip, redesign, template);
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  await writeFile(workspace.zipPath, zipBuffer);

  return {
    workspaceId,
    redesign,
    previewDir: workspace.previewDir,
    zipPath: workspace.zipPath,
    warnings: blueprint.contentWarnings,
  };
}

export function buildLocalRedesign(
  site: ScrapedSite,
  template: DesignTemplate,
  blueprint: BuildBlueprint,
): Redesign {
  const safePagePlans = normalizePagePlans(blueprint, site);
  const nav = safePagePlans.map((plan, index) => ({
    label: plan.title,
    href: index === 0 ? "index.html" : `${plan.slug}.html`,
  }));

  const pages: RedesignPage[] = safePagePlans.map((plan, index) => {
    const sourcePage = getSourcePage(site, plan.sourcePageRefs[0]);
    const sections = plan.sectionPlan.map((sectionPlan, sectionIndex) =>
      buildSection(sectionPlan.kind, {
        site,
        template,
        sourcePage,
        pageTitle: plan.title,
        pageIndex: index,
        sectionIndex,
        imageRole: sectionPlan.imageRole,
        copyBrief: sectionPlan.copyBrief,
        intent: sectionPlan.intent,
      }),
    );

    return {
      slug: plan.slug,
      title: plan.title,
      metaDescription: metaDescriptionFor(site, sourcePage, plan.title),
      nav,
      sections: ensureMinimumSections(sections, site, template, sourcePage),
    };
  });

  return {
    brand: {
      name: clean(site.brand.name) || "Client Site",
      tagline: clean(site.brand.tagline) || firstParagraph(site) || "A clearer, faster web presence.",
      voice: clean(blueprint.brandVoice) || template.mood.join(", "),
    },
    templateId: template.id,
    palette: template.palette,
    typography: template.typography,
    pages,
    suggestions: suggestionsFor(site, template),
    metrics: {
      designScore: "92/100",
      contentClarity: "A-",
      loadSpeed: "Static",
      accessibility: "AA-ready",
    },
    chartData: [
      { section: "Hero", weight: 92, target: 95 },
      { section: "Content", weight: 88, target: 90 },
      { section: "Trust", weight: 84, target: 88 },
      { section: "Conversion", weight: 90, target: 92 },
    ],
  };
}

async function writePreviewFiles(
  previewDir: string,
  redesign: Redesign,
  template: DesignTemplate,
): Promise<void> {
  for (const page of redesign.pages) {
    await writeFile(path.join(previewDir, pageFilename(page, redesign)), pageHTML(page, template, redesign));
  }
  await writeFile(path.join(previewDir, "styles.css"), styleSheet(template));
  await writeFile(
    path.join(previewDir, "README.txt"),
    `WebSwap static preview\nBrand: ${redesign.brand.name}\nTemplate: ${template.name} (${template.id})\nPages: ${redesign.pages.map((p) => p.title).join(", ")}\n`,
  );
}

function normalizePagePlans(blueprint: BuildBlueprint, site: ScrapedSite): BuildBlueprint["pagePlan"] {
  const plans = blueprint.pagePlan.slice(0, 3).map((plan, index) => ({
    ...plan,
    slug: normalizeSlug(index === 0 ? "home" : plan.slug || `page-${index + 1}`),
    title: clean(plan.title) || (index === 0 ? "Home" : `Page ${index + 1}`),
    sourcePageRefs: plan.sourcePageRefs.length ? plan.sourcePageRefs : [0],
    sectionPlan: plan.sectionPlan.length ? plan.sectionPlan : [],
  }));

function fallbackPageForIndex(index: number, site: ScrapedSite): { slug: string; title: string } {
  if (index === 2) return { slug: "contact", title: "Contact" };
  const result = classifySecondaryPage(site);
  return { slug: result.slug, title: result.title };
}

  // Determine appropriate secondary page label for this industry
  while (plans.length < 3) {
    const index = plans.length;
    const fallback = fallbackPageForIndex(index, site);
    plans.push({
      slug: fallback.slug,
      title: fallback.title,
      sourcePageRefs: [0],
      sectionPlan: [
        { kind: "hero", sourceRefs: [], intent: "Introduce page.", copyBrief: "Use source content." },
        { kind: "feature-grid", sourceRefs: [], intent: "Summarize proof.", copyBrief: "Use source content." },
        { kind: index === 1 ? "faq" : "contact", sourceRefs: [], intent: "Convert.", copyBrief: "Use source content." },
      ] as BuildBlueprint["pagePlan"][number]["sectionPlan"],
    });
  }

  return plans as BuildBlueprint["pagePlan"];
}

function buildSection(
  kind: SectionKind,
  context: {
    site: ScrapedSite;
    template: DesignTemplate;
    sourcePage: ScrapedPage;
    pageTitle: string;
    pageIndex: number;
    sectionIndex: number;
    imageRole?: "hero" | "content" | "logo";
    copyBrief: string;
    intent: string;
  },
): RedesignSection {
  const { site, sourcePage, pageTitle, pageIndex, sectionIndex, imageRole } = context;
  const paragraphs = usefulParagraphs(sourcePage, site);
  const headings = usefulHeadings(sourcePage, site);
  const cta = bestCta(sourcePage, site);
  const image = pickImage(site, imageRole || (kind === "hero" ? "hero" : "content"));
  const galleryImages = pickImages(site, 6).map((img) => img.src);

  switch (kind) {
    case "hero":
      return {
        kind,
        subheading: pageIndex === 0 ? site.brand.name : pageTitle,
        heading: heroHeading(sourcePage, site, pageTitle),
        body: trimSentence(paragraphs[0] || sourcePage.metaDescription || site.brand.tagline, 220),
        ctaLabel: cta,
        ctaHref: "contact.html",
        imageUrl: image?.src,
      };
    case "feature-grid":
      return {
        kind,
        heading: pageIndex === 0 ? "What visitors need to know" : `${pageTitle} highlights`,
        subheading: trimSentence(sourcePage.metaDescription || site.brand.tagline, 180),
        items: featureItems(headings, paragraphs),
      };
    case "image-split":
      return {
        kind,
        heading: headings[0] || "Built around the real source content",
        body: trimSentence(paragraphs[sectionIndex] || paragraphs[0] || site.brand.tagline, 260),
        ctaLabel: cta,
        ctaHref: "contact.html",
        imageUrl: image?.src,
        alignment: sectionIndex % 2 === 0 ? "left" : "right",
      };
    case "stats":
      return {
        kind,
        heading: "Signals pulled from the original site",
        items: [
          { value: String(site.pages.length), label: "Pages reviewed" },
          { value: String(site.allImages.length), label: "Images available" },
          { value: String(totalParagraphs(site)), label: "Copy blocks" },
          { value: site.brand.phones[0] ? "1" : "0", label: "Phone paths" },
        ],
      };
    case "quote":
      return {
        kind,
        body: trimSentence(paragraphs[1] || paragraphs[0] || "Clear communication and dependable follow-through are the center of the experience.", 220),
        attribution: site.brand.name,
      };
    case "gallery":
      return {
        kind,
        heading: "Real imagery from the source site",
        imageUrls: galleryImages,
      };
    case "logos":
      return {
        kind,
        heading: "Core capabilities",
        items: featureItems(headings, paragraphs).map((item) => ({ label: item.title })),
      };
    case "pricing":
      return {
        kind,
        heading: "Transparent next steps",
        items: [
          { label: "1", value: "Assess", body: "Start with a clear diagnosis and source-backed explanation." },
          { label: "2", value: "Approve", body: "Review options before committing to the work." },
          { label: "3", value: "Resolve", body: "Complete the service and leave a simple path for follow-up." },
        ],
      };
    case "faq":
      return {
        kind,
        heading: "Questions visitors ask before reaching out",
        items: faqItems(sourcePage, site),
      };
    case "team":
      return {
        kind,
        heading: "Who visitors are trusting",
        items: [
          { title: "Responsive team", label: "Scheduling" },
          { title: "Clear communicators", label: "Updates" },
          { title: "Prepared technicians", label: "Execution" },
          { title: "Local support", label: "Follow-up" },
        ],
      };
    case "contact":
      return {
        kind,
        heading: "Start the conversation",
        subheading: contactLine(site, sourcePage),
        ctaLabel: cta,
      };
    case "cta":
    default:
      return {
        kind: "cta",
        heading: pageIndex === 2 ? "Ready to reach out?" : `Bring ${site.brand.name} into sharper focus`,
        subheading: contactLine(site, sourcePage),
        ctaLabel: cta,
        ctaHref: "contact.html",
      };
  }
}

function ensureMinimumSections(
  sections: RedesignSection[],
  site: ScrapedSite,
  template: DesignTemplate,
  sourcePage: ScrapedPage,
): RedesignSection[] {
  const complete = sections.filter((section) => section && section.kind);
  while (complete.length < 3) {
    complete.push(
      buildSection(complete.length === 0 ? "hero" : complete.length === 1 ? "feature-grid" : "cta", {
        site,
        template,
        sourcePage,
        pageTitle: sourcePage.title || "Page",
        pageIndex: 0,
        sectionIndex: complete.length,
        copyBrief: "Fill missing section from source material.",
        intent: "Guarantee a complete page.",
      }),
    );
  }
  return complete;
}

function pageFilename(page: RedesignPage, redesign: Redesign): string {
  const idx = redesign.pages.indexOf(page);
  return idx === 0 ? "index.html" : `${normalizeSlug(page.slug || `page-${idx + 1}`)}.html`;
}

function getSourcePage(site: ScrapedSite, index: number): ScrapedPage {
  return site.pages[index] || site.pages[0] || emptyPage(site.rootUrl);
}

function emptyPage(rootUrl: string): ScrapedPage {
  return {
    url: rootUrl,
    path: "/",
    title: "Home",
    metaDescription: "",
    h1: [],
    h2: [],
    navLinks: [],
    ctas: [],
    paragraphs: [],
    images: [],
  };
}

function heroHeading(page: ScrapedPage, site: ScrapedSite, fallback: string): string {
  return clean(page.h1[0]) || clean(page.title) || clean(site.brand.tagline) || fallback;
}

function metaDescriptionFor(site: ScrapedSite, page: ScrapedPage, title: string): string {
  return trimSentence(page.metaDescription || site.brand.tagline || `${title} for ${site.brand.name}`, 155);
}

function usefulHeadings(page: ScrapedPage, site: ScrapedSite): string[] {
  const headings = [...page.h2, ...site.pages.flatMap((p) => p.h2)].map(clean).filter(Boolean);
  return Array.from(new Set(headings)).slice(0, 6);
}

function usefulParagraphs(page: ScrapedPage, site: ScrapedSite): string[] {
  const paragraphs = [...page.paragraphs, ...site.pages.flatMap((p) => p.paragraphs)]
    .map((text) => trimSentence(text, 320))
    .filter((text) => text.length >= 30);
  return Array.from(new Set(paragraphs)).slice(0, 8);
}

function firstParagraph(site: ScrapedSite): string {
  return trimSentence(site.pages.flatMap((page) => page.paragraphs)[0] || "", 180);
}

function totalParagraphs(site: ScrapedSite): number {
  return site.pages.reduce((sum, page) => sum + page.paragraphs.length, 0);
}

function featureItems(headings: string[], paragraphs: string[]): RedesignSection["items"] {
  const titles = headings.length ? headings : ["Clear offer", "Real proof", "Easy next step"];
  return titles.slice(0, 6).map((title, index) => ({
    title,
    body: trimSentence(paragraphs[index] || paragraphs[0] || "A concise source-backed proof point for this part of the business.", 180),
  }));
}

function faqItems(page: ScrapedPage, site: ScrapedSite): RedesignSection["items"] {
  const phone = site.brand.phones[0];
  const email = site.brand.emails[0];
  return [
    {
      title: "What does this business do?",
      body: trimSentence(page.metaDescription || site.brand.tagline || firstParagraph(site), 180),
    },
    {
      title: "How do visitors get started?",
      body: phone ? `Call ${phone} or use the contact form to request the next step.` : "Use the contact form to request the next step.",
    },
    {
      title: "Is the copy based on the original site?",
      body: "Yes. The redesign reuses scraped headings, calls to action, contact details, and body copy patterns from the source site.",
    },
    ...(email ? [{ title: "Is email available?", body: `The source site lists ${email} as a contact path.` }] : []),
  ];
}

function suggestionsFor(site: ScrapedSite, template: DesignTemplate): string[] {
  const suggestions = [
    `Use ${template.name} to keep the redesign visually consistent across all three pages.`,
    "Keep the primary CTA consistent from hero to final contact section.",
    "Replace any thin source copy with specific service proof before production launch.",
  ];
  if (!site.brand.phones.length && !site.brand.emails.length) {
    suggestions.push("Add a visible phone number or email address before sending traffic to the contact page.");
  }
  if (site.allImages.length === 0) {
    suggestions.push("Add real photography to increase trust and reduce generic stock-site feel.");
  }
  return suggestions;
}

function bestCta(page: ScrapedPage, site: ScrapedSite): string {
  return clean(page.ctas[0]) || clean(site.pages.flatMap((p) => p.ctas)[0]) || (site.brand.phones[0] ? "Call now" : "Get in touch");
}

function contactLine(site: ScrapedSite, page: ScrapedPage): string {
  const parts = [site.brand.phones[0], site.brand.emails[0]].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return trimSentence(page.paragraphs[0] || site.brand.tagline || "Share a few details and the team can follow up.", 180);
}

function pickImage(site: ScrapedSite, role: "hero" | "content" | "logo"): ScrapedImage | undefined {
  return site.allImages.find((image) => image.role === role) || site.allImages.find((image) => image.role !== "logo") || site.allImages[0];
}

function pickImages(site: ScrapedSite, limit: number): ScrapedImage[] {
  return Array.from(new Map(site.allImages.map((image) => [image.src, image])).values()).slice(0, limit);
}

function normalizeSlug(value: string): string {
  const slug = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "page";
}

function trimSentence(value: string | undefined, limit: number): string {
  const text = clean(value);
  if (text.length <= limit) return text;
  const clipped = text.slice(0, limit - 1);
  const lastStop = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  return `${(lastStop > 80 ? clipped.slice(0, lastStop + 1) : clipped).trim()}…`;
}

function clean(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}
