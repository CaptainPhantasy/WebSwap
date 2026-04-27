import JSZip from "jszip";
import path from "path";
import { mkdtemp, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { DESIGN_TEMPLATES } from "../src/templates.ts";
import type { ScrapedSite } from "../src/types.ts";
import {
  createFallbackBlueprint,
  parseBuildBlueprintOrFallback,
} from "../src/blueprint.ts";
import { buildLocalRedesign, buildWorkspaceSite } from "../src/localBuilder.ts";
import {
  createWorkspace,
  loadWorkspaceSite,
  resolveWorkspace,
} from "../src/workspaces.ts";
import { rankTemplatesForSite } from "../src/templateRecommendations.ts";

interface TestResult {
  name: string;
  pass: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, pass: true });
  } catch (e: any) {
    results.push({ name, pass: false, detail: e?.message || String(e) });
  }
}

const SITE: ScrapedSite = {
  rootUrl: "https://example-plumbing.test",
  origin: "https://example-plumbing.test",
  scrapedAt: "2026-04-26T00:00:00.000Z",
  brand: {
    name: "Example Plumbing",
    tagline: "Same-day plumbing repairs with clear communication.",
    detectedColors: ["#0A66FF", "#101223"],
    detectedFonts: ["Inter"],
    emails: ["service@example-plumbing.test"],
    phones: ["(555) 010-1042"],
    socials: [],
  },
  pages: [
    {
      url: "https://example-plumbing.test/",
      path: "/",
      title: "Example Plumbing | Same-Day Repairs",
      metaDescription: "Trusted residential plumbing repairs, water heaters, drains, and emergency service.",
      h1: ["Plumbing help when you need it."],
      h2: ["Drain cleaning", "Water heaters", "Leak detection", "Clear pricing"],
      navLinks: [
        { label: "Home", href: "https://example-plumbing.test/" },
        { label: "Services", href: "https://example-plumbing.test/services" },
        { label: "Contact", href: "https://example-plumbing.test/contact" },
      ],
      ctas: ["Schedule service", "Call now"],
      paragraphs: [
        "Example Plumbing helps homeowners solve urgent plumbing problems with licensed technicians, clean work areas, and straightforward communication from first call to final walkthrough.",
        "The team handles drain cleaning, leak diagnosis, fixture replacement, water heater repair, and emergency plumbing calls across the metro area.",
      ],
      images: [
        {
          src: "https://example-plumbing.test/images/van.jpg",
          alt: "Example Plumbing service van",
          role: "hero",
          width: 1600,
          height: 900,
        },
      ],
    },
    {
      url: "https://example-plumbing.test/services",
      path: "/services",
      title: "Plumbing Services",
      metaDescription: "Drain cleaning, leak repair, water heaters, fixtures, and emergency plumbing service.",
      h1: ["Residential plumbing services"],
      h2: ["Emergency repairs", "Water heater service", "Fixture installation"],
      navLinks: [],
      ctas: ["Request an estimate"],
      paragraphs: [
        "Every service visit starts with a diagnosis, plain-language options, and a clear recommendation before work begins.",
        "Customers choose Example Plumbing for responsive scheduling, respectful technicians, and repairs built to last.",
      ],
      images: [
        {
          src: "https://example-plumbing.test/images/sink.jpg",
          alt: "Technician repairing sink plumbing",
          role: "content",
        },
      ],
    },
    {
      url: "https://example-plumbing.test/contact",
      path: "/contact",
      title: "Contact Example Plumbing",
      metaDescription: "Call or request plumbing service from Example Plumbing.",
      h1: ["Schedule plumbing service"],
      h2: ["Fast response", "Local technicians"],
      navLinks: [],
      ctas: ["Call (555) 010-1042"],
      paragraphs: [
        "Call the office or send a service request with your address, issue, and preferred appointment window.",
      ],
      images: [],
    },
  ],
  allImages: [
    {
      src: "https://example-plumbing.test/images/van.jpg",
      alt: "Example Plumbing service van",
      role: "hero",
      width: 1600,
      height: 900,
    },
    {
      src: "https://example-plumbing.test/images/sink.jpg",
      alt: "Technician repairing sink plumbing",
      role: "content",
    },
  ],
};

const RICH_SITE: ScrapedSite = {
  ...SITE,
  rootUrl: "https://example-restaurant.test",
  origin: "https://example-restaurant.test",
  brand: {
    ...SITE.brand,
    name: "Example Supper Club",
    tagline: "Seasonal dining, private events, and weekend live music.",
    socials: [{ platform: "Instagram", url: "https://instagram.com/examplesupper" }],
  },
  pages: [
    ...SITE.pages,
    {
      url: "https://example-restaurant.test/menu",
      path: "/menu",
      title: "Menu",
      metaDescription: "Seasonal dinner menu, cocktails, and private dining.",
      h1: ["Dinner menu"],
      h2: ["Cocktails", "Private dining", "Weekend specials"],
      navLinks: [],
      ctas: ["Reserve a table"],
      paragraphs: ["Our menu changes with local farms, seasonal produce, and a focused cocktail program for dinner and late-night guests."],
      images: [{ src: "https://example-restaurant.test/menu.jpg", alt: "Plated dinner", role: "content" }],
    },
    {
      url: "https://example-restaurant.test/events",
      path: "/events",
      title: "Events",
      metaDescription: "Live music, chef dinners, and private events.",
      h1: ["Events and private dining"],
      h2: ["Live music", "Chef dinners", "Private events"],
      navLinks: [],
      ctas: ["Plan an event"],
      paragraphs: ["The dining room hosts live music, chef dinners, celebrations, and private events with custom menus."],
      images: [{ src: "https://example-restaurant.test/events.jpg", alt: "Private event", role: "content" }],
    },
    {
      url: "https://example-restaurant.test/gallery",
      path: "/gallery",
      title: "Gallery",
      metaDescription: "Food, cocktails, and dining room gallery.",
      h1: ["Gallery"],
      h2: ["Dining room", "Cocktails", "Seasonal plates"],
      navLinks: [],
      ctas: ["View the menu"],
      paragraphs: ["Browse the room, menu details, cocktails, and atmosphere before planning a visit."],
      images: [{ src: "https://example-restaurant.test/gallery.jpg", alt: "Dining room", role: "content" }],
    },
  ],
  allImages: [
    ...SITE.allImages,
    { src: "https://example-restaurant.test/menu.jpg", alt: "Plated dinner", role: "content" },
    { src: "https://example-restaurant.test/events.jpg", alt: "Private event", role: "content" },
    { src: "https://example-restaurant.test/gallery.jpg", alt: "Dining room", role: "content" },
  ],
};

(async function main() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "webswap-workspaces-"));
  const template = DESIGN_TEMPLATES[0];

  try {
    await test("fallback blueprint has 3 page plans and content warnings array", () => {
      const blueprint = createFallbackBlueprint(SITE, template);
      assert(blueprint.pagePlan.length === 3, `pages=${blueprint.pagePlan.length}`);
      assert(Array.isArray(blueprint.contentWarnings), "missing warnings");
      assert(blueprint.pagePlan.every((p) => p.sectionPlan.length >= 3), "missing section plans");
    });

    await test("invalid model blueprint falls back without raw invalid shape", () => {
      const parsed = parseBuildBlueprintOrFallback({ pages: [{ title: "bad" }] }, SITE, template);
      assert(parsed.blueprint.pagePlan.length === 3, `pages=${parsed.blueprint.pagePlan.length}`);
      assert(parsed.usedFallback === true, "did not mark fallback");
      assert(parsed.warnings.some((w) => w.includes("Invalid blueprint")), parsed.warnings.join(" | "));
    });

    await test("template recommendations return exactly three evidence-backed options", () => {
      const recommendations = rankTemplatesForSite(RICH_SITE, DESIGN_TEMPLATES);
      assert(recommendations.length === 3, `recommendations=${recommendations.length}`);
      assert(recommendations.every((r) => r.reasons.length > 0), "missing recommendation reasons");
      assert(new Set(recommendations.map((r) => r.templateId)).size === 3, "duplicate recommendations");
    });

    await test("local builder returns complete redesign pages", () => {
      const blueprint = createFallbackBlueprint(SITE, template);
      const redesign = buildLocalRedesign(SITE, template, blueprint);
      assert(redesign.pages.length === 3, `pages=${redesign.pages.length}`);
      for (const page of redesign.pages) {
        assert(Array.isArray(page.nav) && page.nav.length === 3, `${page.slug} nav`);
        assert(Array.isArray(page.sections) && page.sections.length >= 3, `${page.slug} sections`);
        assert(page.sections.every((s) => typeof s.kind === "string"), `${page.slug} bad section kind`);
      }
    });

    await test("fallback blueprint expands beyond three pages for rich source inventory", () => {
      const blueprint = createFallbackBlueprint(RICH_SITE, template);
      assert(blueprint.pagePlan.length > 3, `pages=${blueprint.pagePlan.length}`);
      assert(blueprint.pagePlan.length <= 12, `pages=${blueprint.pagePlan.length}`);
      assert(blueprint.pagePlan.some((p) => p.slug === "menu"), blueprint.pagePlan.map((p) => p.slug).join(","));
      assert(blueprint.pagePlan.some((p) => p.slug === "events"), blueprint.pagePlan.map((p) => p.slug).join(","));
    });

    await test("local builder computes truthful metrics from scrape depth", () => {
      const shallow = buildLocalRedesign(SITE, template, createFallbackBlueprint(SITE, template));
      const rich = buildLocalRedesign(RICH_SITE, template, createFallbackBlueprint(RICH_SITE, template));
      assert(rich.pages.length > shallow.pages.length, `${rich.pages.length} <= ${shallow.pages.length}`);
      assert(rich.metrics.designScore !== "92/100", "design score remained hardcoded");
      assert(rich.metrics.contentClarity !== "A-", "content clarity remained hardcoded");
      assert(rich.chartData.some((row) => row.section === "Source Pages" && row.weight > shallow.pages.length), "missing source page metric");
      assert(rich.suggestions.some((s) => s.includes("Recommended templates")), rich.suggestions.join(" | "));
    });

    await test("local builder output is exportable by existing ZIP renderer", async () => {
      const blueprint = createFallbackBlueprint(SITE, template);
      const redesign = buildLocalRedesign(SITE, template, blueprint);
      const workspace = await createWorkspace(SITE, { rootDir });
      const artifact = await buildWorkspaceSite(workspace.id, SITE, template, blueprint, { rootDir });
      const zipData = await readFile(artifact.zipPath);
      const zip = await JSZip.loadAsync(zipData);
      const names = Object.keys(zip.files).sort();
      assert(names.includes("index.html"), names.join(","));
      assert(names.includes("services.html"), names.join(","));
      assert(names.includes("contact.html"), names.join(","));
      assert(names.includes("styles.css"), names.join(","));
      assert(names.includes("README.txt"), names.join(","));
      assert(artifact.redesign.pages.length === redesign.pages.length, "artifact redesign mismatch");
    });

    await test("workspace persistence writes and reloads scraped site safely", async () => {
      const workspace = await createWorkspace(SITE, { rootDir });
      const resolved = resolveWorkspace(workspace.id, { rootDir });
      const loaded = await loadWorkspaceSite(workspace.id, { rootDir });
      assert(loaded.brand.name === SITE.brand.name, loaded.brand.name);
      assert(resolved.dir.startsWith(rootDir), resolved.dir);
      await stat(path.join(resolved.contentDir, "scraped-data.json"));
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log("\n=== WORKSPACE BUILDER TEST RESULTS ===");
  for (const r of results) {
    if (r.pass) console.log(`  PASS  ${r.name}`);
    else console.log(`  FAIL  ${r.name}\n         ${r.detail}`);
  }
  console.log(`\nTotal: ${pass} passed, ${fail} failed (${results.length} total)`);
  process.exit(fail > 0 ? 1 : 0);
})();
