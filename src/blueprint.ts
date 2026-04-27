import { z } from "zod";
import type { DesignTemplate, ScrapedSite, SectionKind } from "./types";
import { classifySecondaryPage } from "./pageClassifier";

export const SECTION_KINDS = [
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
] as const satisfies readonly SectionKind[];

export const SectionKindSchema = z.enum(SECTION_KINDS);

export const BuildBlueprintSchema = z
  .object({
    brandVoice: z.string().min(1).max(500),
    pagePlan: z
      .array(
        z
          .object({
            slug: z.string().min(1).max(60),
            title: z.string().min(1).max(120),
            sourcePageRefs: z.array(z.number().int().nonnegative()).min(1).max(5),
            sectionPlan: z
              .array(
                z
                  .object({
                    kind: SectionKindSchema,
                    sourceRefs: z.array(z.string().min(1).max(120)).max(12),
                    intent: z.string().min(1).max(240),
                    copyBrief: z.string().min(1).max(500),
                    imageRole: z.enum(["hero", "content", "logo"]).optional(),
                  })
                  .strict(),
              )
              .min(3)
              .max(6),
          })
          .strict(),
      )
      .length(3),
    contentWarnings: z.array(z.string().max(300)).max(10),
  })
  .strict();

export type BuildBlueprint = z.infer<typeof BuildBlueprintSchema>;

export interface ParsedBlueprint {
  blueprint: BuildBlueprint;
  usedFallback: boolean;
  warnings: string[];
}

export function parseBuildBlueprintOrFallback(
  value: unknown,
  site: ScrapedSite,
  template: DesignTemplate,
): ParsedBlueprint {
  const parsed = BuildBlueprintSchema.safeParse(value);
  if (parsed.success) {
    return { blueprint: parsed.data, usedFallback: false, warnings: [] };
  }

  const firstIssue = parsed.error.issues[0];
  const issuePath = firstIssue?.path.length ? firstIssue.path.join(".") : "root";
  const issueText = firstIssue
    ? `${issuePath}: ${firstIssue.message}`
    : "unknown schema error";

  return {
    blueprint: createFallbackBlueprint(site, template),
    usedFallback: true,
    warnings: [`Invalid blueprint from model; used deterministic fallback (${issueText}).`],
  };
}

export function createFallbackBlueprint(
  site: ScrapedSite,
  template: DesignTemplate,
): BuildBlueprint {
  const secondary = chooseSecondaryPage(site);
  const contactIndex = chooseContactPageIndex(site);
  const brandVoice = [
    site.brand.tagline,
    template.mood.slice(0, 3).join(", "),
    "clear, specific, client-ready",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    brandVoice,
    pagePlan: [
      {
        slug: "home",
        title: "Home",
        sourcePageRefs: [0],
        sectionPlan: [
          section("hero", ["page:0:h1:0", "brand:tagline"], "Make the offer immediately clear.", "Lead with the primary service promise and strongest CTA.", "hero"),
          section("feature-grid", ["page:0:h2", "page:0:paragraphs"], "Turn scraped headings into service cards.", "Summarize the core services in concise, scannable cards."),
          section("image-split", ["page:0:paragraphs", "images:hero"], "Use real imagery with proof-oriented copy.", "Pair a real photo with the strongest credibility paragraph.", "content"),
          section("cta", ["page:0:ctas", "brand:phone"], "Create a conversion close.", "Repeat the best source CTA and make the next action obvious."),
        ],
      },
      {
        slug: secondary.slug,
        title: secondary.title,
        sourcePageRefs: [secondary.index],
        sectionPlan: [
          section("hero", [`page:${secondary.index}:h1:0`, `page:${secondary.index}:metaDescription`], "Introduce the detail page.", "Use source page language to frame this page's purpose.", "hero"),
          section("feature-grid", [`page:${secondary.index}:h2`, `page:${secondary.index}:paragraphs`], "Explain the offering.", "Convert source headings and body copy into practical proof points."),
          section("quote", [`page:${secondary.index}:paragraphs`], "Add a trust-building proof moment.", "Use source sentiment without inventing a named testimonial."),
          section("faq", [`page:${secondary.index}:paragraphs`, "brand:emails", "brand:phones"], "Answer buyer questions.", "Create concise FAQs from source facts only."),
        ],
      },
      {
        slug: "contact",
        title: "Contact",
        sourcePageRefs: [contactIndex],
        sectionPlan: [
          section("hero", [`page:${contactIndex}:h1:0`, "brand:phone"], "Make contact feel low-friction.", "Lead with scheduling, response, or next-step language from the source.", "hero"),
          section("contact", ["brand:emails", "brand:phones", `page:${contactIndex}:paragraphs`], "Expose contact paths clearly.", "Use source phone/email details and a demo-safe form."),
          section("faq", [`page:${contactIndex}:paragraphs`, "page:0:ctas"], "Remove conversion friction.", "Answer what happens after a visitor reaches out."),
          section("cta", ["brand:phone", "page:0:ctas"], "End with one decisive action.", "Repeat the strongest contact CTA."),
        ],
      },
    ],
    contentWarnings: [],
  };
}

function section(
  kind: SectionKind,
  sourceRefs: string[],
  intent: string,
  copyBrief: string,
  imageRole?: "hero" | "content" | "logo",
): BuildBlueprint["pagePlan"][number]["sectionPlan"][number] {
  return { kind, sourceRefs, intent, copyBrief, ...(imageRole ? { imageRole } : {}) };
}

function chooseSecondaryPage(site: ScrapedSite) {
  const result = classifySecondaryPage(site);
  return { index: result.index, slug: result.slug, title: result.title };
}

function chooseContactPageIndex(site: ScrapedSite): number {
  const idx = site.pages.findIndex((page) => {
    const haystack = `${page.path} ${page.title} ${page.h1.join(" ")}`.toLowerCase();
    return /(contact|schedule|quote|estimate|get in touch)/.test(haystack);
  });
  return idx >= 0 ? idx : Math.max(0, site.pages.length - 1);
}
