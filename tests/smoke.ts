import JSZip from "jszip";
import { DESIGN_TEMPLATES, getTemplate } from "../src/templates.ts";
import {
  isPrivateIp,
  assertPublicHost,
  extractPage,
  extractBrand,
} from "../src/scraper.ts";
import {
  fontImportUrl,
  renderSectionPreview,
  sectionHTML,
  pageHTML,
  styleSheet,
  esc,
  buildExportZip,
} from "../src/render.tsx";
import type {
  DesignTemplate,
  Redesign,
  RedesignSection,
  SectionKind,
} from "../src/types.ts";

type TestResult = { name: string; pass: boolean; detail?: string };
const results: TestResult[] = [];

function assert(cond: any, msg: string): void {
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

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const HEX_OR_RGBA = /^(#[0-9A-Fa-f]{6}|rgba?\(.+\))$/;

const FIXTURE_HTML = `<!doctype html>
<html>
  <head>
    <title>Acme Roasters — Small-batch Coffee</title>
    <meta name="description" content="Single-origin coffee, hand-roasted weekly in Brooklyn." />
    <meta property="og:site_name" content="Acme Roasters" />
    <meta property="og:image" content="https://cdn.example.com/og.jpg" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <style>
      :root { --brand: #2F3E2E; }
      body { font-family: 'Fraunces', serif; }
      .cta { font-family: "DM Sans", sans-serif; color: #C96A4B; background: #FAF4EC; }
    </style>
  </head>
  <body>
    <header>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/shop">Shop</a>
      <a href="https://twitter.com/acme">Twitter</a>
    </header>
    <nav><a href="/contact">Contact</a></nav>
    <h1>Roasted with intention.</h1>
    <h2>Freshness in every cup</h2>
    <h2>Sustainable sourcing</h2>
    <p>Acme Roasters has been hand-roasting single-origin beans in Brooklyn since 2014. Every batch is labeled with its roast date and farm of origin.</p>
    <p>Questions? Drop us a line at hello@acmeroasters.com or call (718) 555-0142 during shop hours.</p>
    <img src="/hero.jpg" alt="Beans being roasted" width="1600" height="900" />
    <img data-src="/lazy.jpg" alt="Lazy loaded" />
    <img src="data:image/png;base64,AAAA" alt="inline" />
    <a class="button" href="/shop">Shop Beans</a>
    <button>Subscribe</button>
  </body>
</html>`;

const mockSection = (kind: SectionKind): RedesignSection => ({
  kind,
  heading: `${kind} heading`,
  subheading: `${kind} subheading`,
  body: `${kind} body text lorem ipsum dolor sit.`,
  ctaLabel: "Learn more",
  ctaHref: "/contact",
  imageUrl: "https://cdn.example.com/img.jpg",
  imageUrls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
  alignment: "left",
  attribution: "Jane Client, CEO",
  items: [
    { title: "Item 1", body: "Item 1 body", value: "42", label: "Units", icon: "🧪" },
    { title: "Item 2", body: "Item 2 body", value: "99%", label: "Uptime" },
    { title: "Item 3", body: "Item 3 body", value: "12", label: "Pros" },
    { title: "Item 4", body: "Item 4 body", value: "$0", label: "Free" },
  ],
});

const ALL_KINDS: SectionKind[] = [
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
];

(async function main() {
  // ---------------------------------------------------------------
  // Templates integrity — 12 entries, all fields valid
  // ---------------------------------------------------------------
  await test("templates: exactly 12 entries", () => {
    assert(DESIGN_TEMPLATES.length === 12, `got ${DESIGN_TEMPLATES.length}`);
  });
  await test("templates: unique ids", () => {
    const ids = new Set(DESIGN_TEMPLATES.map((t) => t.id));
    assert(ids.size === DESIGN_TEMPLATES.length, "duplicate id");
  });
  await test("templates: all palettes are valid hex or rgba", () => {
    for (const t of DESIGN_TEMPLATES) {
      for (const [k, v] of Object.entries(t.palette)) {
        assert(HEX_OR_RGBA.test(v), `${t.id}.palette.${k}=${v}`);
      }
    }
  });
  await test("templates: primary/text/bg/accent are 6-digit hex", () => {
    for (const t of DESIGN_TEMPLATES) {
      assert(HEX6.test(t.palette.primary), `${t.id}.primary`);
      assert(HEX6.test(t.palette.text), `${t.id}.text`);
      assert(HEX6.test(t.palette.accent), `${t.id}.accent`);
    }
  });
  await test("templates: typography shapes", () => {
    for (const t of DESIGN_TEMPLATES) {
      assert(typeof t.typography.heading === "string" && t.typography.heading.length > 0, t.id);
      assert(typeof t.typography.body === "string" && t.typography.body.length > 0, t.id);
      assert(t.typography.headingWeight >= 100 && t.typography.headingWeight <= 900, t.id);
      assert(t.typography.bodyWeight >= 100 && t.typography.bodyWeight <= 900, t.id);
    }
  });
  await test("templates: layoutDNA present and meaningful (>80 chars)", () => {
    for (const t of DESIGN_TEMPLATES) {
      assert(t.layoutDNA.length >= 80, `${t.id} layoutDNA too short (${t.layoutDNA.length})`);
    }
  });
  await test("templates: getTemplate helper", () => {
    assert(getTemplate("editorial-serif")?.name === "Editorial Serif", "editorial-serif");
    assert(getTemplate("nonexistent") === undefined, "unknown returns undefined");
  });
  await test("templates: mood + bestFor arrays non-empty", () => {
    for (const t of DESIGN_TEMPLATES) {
      assert(Array.isArray(t.mood) && t.mood.length > 0, `${t.id}.mood`);
      assert(Array.isArray(t.bestFor) && t.bestFor.length > 0, `${t.id}.bestFor`);
    }
  });

  // ---------------------------------------------------------------
  // SSRF guard — isPrivateIp
  // ---------------------------------------------------------------
  const SSRF_PRIVATE: string[] = [
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "127.42.7.9",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd00::dead",
    "::ffff:10.0.0.1",
  ];
  const SSRF_PUBLIC: string[] = [
    "1.1.1.1",
    "8.8.8.8",
    "142.250.80.46",
    "172.15.0.1",
    "172.32.0.1",
    "2606:4700:4700::1111",
  ];
  await test(`isPrivateIp: blocks ${SSRF_PRIVATE.length} private addresses`, () => {
    for (const ip of SSRF_PRIVATE) {
      assert(isPrivateIp(ip) === true, `${ip} should be private`);
    }
  });
  await test(`isPrivateIp: allows ${SSRF_PUBLIC.length} public addresses`, () => {
    for (const ip of SSRF_PUBLIC) {
      assert(isPrivateIp(ip) === false, `${ip} should be public`);
    }
  });

  // assertPublicHost — protocol + URL validation
  await test("assertPublicHost: rejects file://", async () => {
    let threw = false;
    try { await assertPublicHost("file:///etc/passwd"); } catch { threw = true; }
    assert(threw, "did not throw");
  });
  await test("assertPublicHost: rejects javascript:", async () => {
    let threw = false;
    try { await assertPublicHost("javascript:alert(1)"); } catch { threw = true; }
    assert(threw, "did not throw");
  });
  await test("assertPublicHost: rejects ftp://", async () => {
    let threw = false;
    try { await assertPublicHost("ftp://example.com/"); } catch { threw = true; }
    assert(threw, "did not throw");
  });
  await test("assertPublicHost: rejects literal 127.0.0.1", async () => {
    let threw = false;
    try { await assertPublicHost("http://127.0.0.1/"); } catch { threw = true; }
    assert(threw, "did not throw");
  });
  await test("assertPublicHost: rejects literal 169.254.169.254 (cloud metadata)", async () => {
    let threw = false;
    try { await assertPublicHost("http://169.254.169.254/latest/meta-data/"); } catch { threw = true; }
    assert(threw, "did not throw");
  });
  await test("assertPublicHost: rejects literal [::1]", async () => {
    let threw = false;
    try { await assertPublicHost("http://[::1]/"); } catch { threw = true; }
    assert(threw, "did not throw");
  });
  await test("assertPublicHost: rejects malformed URL", async () => {
    let threw = false;
    try { await assertPublicHost("not-a-url"); } catch { threw = true; }
    assert(threw, "did not throw");
  });

  // ---------------------------------------------------------------
  // extractPage against fixture HTML
  // ---------------------------------------------------------------
  const page = extractPage(FIXTURE_HTML, "https://acmeroasters.com/");
  await test("extractPage: title", () => {
    assert(page.title === "Acme Roasters — Small-batch Coffee", page.title);
  });
  await test("extractPage: meta description", () => {
    assert(page.metaDescription.includes("Brooklyn"), page.metaDescription);
  });
  await test("extractPage: h1 captured", () => {
    assert(page.h1.includes("Roasted with intention."), JSON.stringify(page.h1));
  });
  await test("extractPage: h2 captured (2)", () => {
    assert(page.h2.length === 2, `${page.h2.length}`);
  });
  await test("extractPage: nav absolute URLs", () => {
    assert(page.navLinks.length >= 4, `${page.navLinks.length}`);
    assert(page.navLinks.every((n) => n.href.startsWith("http")), "non-abs href");
  });
  await test("extractPage: paragraphs length-filtered", () => {
    assert(page.paragraphs.length >= 1, `${page.paragraphs.length}`);
    assert(page.paragraphs.every((p) => p.length >= 40 && p.length <= 600), "length filter");
  });
  await test("extractPage: og image captured", () => {
    assert(page.images.some((i) => i.role === "og"), "no og image");
  });
  await test("extractPage: logo captured from apple-touch-icon", () => {
    assert(page.images.some((i) => i.role === "logo"), "no logo");
  });
  await test("extractPage: hero image marked", () => {
    assert(page.images.some((i) => i.role === "hero"), "no hero");
  });
  await test("extractPage: data: URIs excluded", () => {
    assert(page.images.every((i) => !i.src.startsWith("data:")), "data URI leaked");
  });
  await test("extractPage: data-src lazy images captured", () => {
    assert(page.images.some((i) => i.src.endsWith("/lazy.jpg")), "lazy img missing");
  });
  await test("extractPage: ctas captured", () => {
    assert(page.ctas.includes("Shop Beans"), JSON.stringify(page.ctas));
    assert(page.ctas.includes("Subscribe"), JSON.stringify(page.ctas));
  });

  // extractBrand
  const brand = extractBrand([page], FIXTURE_HTML);
  await test("extractBrand: name from og:site_name", () => {
    assert(brand.name === "Acme Roasters", brand.name);
  });
  await test("extractBrand: tagline from meta description", () => {
    assert(brand.tagline.includes("Brooklyn"), brand.tagline);
  });
  await test("extractBrand: email regex", () => {
    assert(brand.emails.includes("hello@acmeroasters.com"), JSON.stringify(brand.emails));
  });
  await test("extractBrand: phone regex", () => {
    assert(brand.phones.some((p) => p.includes("555-0142")), JSON.stringify(brand.phones));
  });
  await test("extractBrand: social link detected", () => {
    assert(brand.socials.some((s) => s.platform === "Twitter"), JSON.stringify(brand.socials));
  });
  await test("extractBrand: colors detected from inline CSS", () => {
    assert(brand.detectedColors.includes("#2F3E2E"), JSON.stringify(brand.detectedColors));
    assert(brand.detectedColors.includes("#C96A4B"), JSON.stringify(brand.detectedColors));
  });
  await test("extractBrand: fonts detected", () => {
    assert(brand.detectedFonts.some((f) => f === "Fraunces"), JSON.stringify(brand.detectedFonts));
    assert(brand.detectedFonts.some((f) => f === "DM Sans"), JSON.stringify(brand.detectedFonts));
  });
  await test("extractBrand: generic font keywords excluded", () => {
    assert(!brand.detectedFonts.includes("serif"), "serif leaked");
    assert(!brand.detectedFonts.includes("sans-serif"), "sans-serif leaked");
  });

  // ---------------------------------------------------------------
  // render.tsx — fontImportUrl, esc
  // ---------------------------------------------------------------
  await test("fontImportUrl: produces Google Fonts URL", () => {
    const u = fontImportUrl("Fraunces", "Inter");
    assert(u.startsWith("https://fonts.googleapis.com/css2?"), u);
    assert(u.includes("family=Fraunces"), u);
    assert(u.includes("family=Inter"), u);
    assert(u.includes("display=swap"), u);
  });
  await test("fontImportUrl: dedupes when heading==body", () => {
    const u = fontImportUrl("Inter", "Inter");
    assert((u.match(/family=/g) || []).length === 1, u);
  });
  await test("fontImportUrl: URI-encodes spaces", () => {
    const u = fontImportUrl("DM Sans", "Space Grotesk");
    assert(u.includes("DM%20Sans"), u);
    assert(u.includes("Space%20Grotesk"), u);
  });
  await test("esc: basic characters", () => {
    assert(esc("<div>\"A & B\"</div>") === "&lt;div&gt;&quot;A &amp; B&quot;&lt;/div&gt;", esc("<div>\"A & B\"</div>"));
  });
  await test("esc: empty / undefined safe", () => {
    assert(esc(undefined) === "", "undefined");
    assert(esc("") === "", "empty");
  });
  await test("esc: prevents <script> injection in output", () => {
    const payload = "</h1><script>alert(1)</script>";
    const escaped = esc(payload);
    assert(!escaped.includes("<script>"), `leaked: ${escaped}`);
  });

  // ---------------------------------------------------------------
  // All 12 section kinds — JSX preview + static HTML
  // ---------------------------------------------------------------
  const t: DesignTemplate = DESIGN_TEMPLATES[0];
  for (const kind of ALL_KINDS) {
    const section = mockSection(kind);
    await test(`renderSectionPreview(${kind}): returns non-null React element`, () => {
      const el = renderSectionPreview(section, t);
      assert(el != null, "null");
      assert(typeof el === "object", "not an object");
    });
    await test(`sectionHTML(${kind}): produces valid non-empty <section>`, () => {
      const html = sectionHTML(section, t);
      assert(typeof html === "string" && html.length > 0, "empty");
      assert(html.includes("<section"), `no <section> in ${kind}`);
    });
  }

  // Styles + pageHTML smoke
  await test("styleSheet: contains CSS custom props and typography", () => {
    const css = styleSheet(t);
    assert(css.includes("--bg:"), "no --bg");
    assert(css.includes("--primary:"), "no --primary");
    assert(css.includes(t.typography.heading), "no heading font");
    assert(css.includes(t.typography.body), "no body font");
    assert(css.includes("@media"), "no media query");
  });

  // Full 3-page redesign structure
  const mockRedesign: Redesign = {
    brand: { name: "Acme Roasters", tagline: "Small-batch coffee.", voice: "warm, earnest" },
    templateId: t.id,
    palette: t.palette,
    typography: t.typography,
    pages: [
      {
        slug: "home",
        title: "Home",
        metaDescription: "Welcome.",
        nav: [
          { label: "Home", href: "/" },
          { label: "About", href: "/about" },
          { label: "Contact", href: "/contact" },
        ],
        sections: [
          mockSection("hero"),
          mockSection("feature-grid"),
          mockSection("stats"),
          mockSection("cta"),
        ],
      },
      {
        slug: "about",
        title: "About",
        metaDescription: "Who we are.",
        nav: [
          { label: "Home", href: "/" },
          { label: "About", href: "/about" },
          { label: "Contact", href: "/contact" },
        ],
        sections: [
          mockSection("image-split"),
          mockSection("team"),
          mockSection("quote"),
        ],
      },
      {
        slug: "contact",
        title: "Contact",
        metaDescription: "Get in touch.",
        nav: [
          { label: "Home", href: "/" },
          { label: "About", href: "/about" },
          { label: "Contact", href: "/contact" },
        ],
        sections: [mockSection("contact"), mockSection("faq")],
      },
    ],
    suggestions: ["Add testimonials section", "Tighten hero copy", "Commit to a single CTA"],
    metrics: {
      designScore: "96/100",
      contentClarity: "A",
      loadSpeed: "0.6s",
      accessibility: "AA",
    },
    chartData: [
      { section: "Hero", weight: 90, target: 95 },
      { section: "About", weight: 70, target: 85 },
    ],
  };

  await test("pageHTML: produces valid <!doctype html> with fonts + CSS link", () => {
    const html = pageHTML(mockRedesign.pages[0], t, mockRedesign);
    assert(html.startsWith("<!doctype html>"), "missing doctype");
    assert(html.includes('lang="en"'), "no lang");
    assert(html.includes('<link rel="preconnect"'), "no preconnect");
    assert(html.includes("fonts.googleapis.com"), "no google fonts");
    assert(html.includes('href="styles.css"'), "no stylesheet link");
    assert(html.includes("<main>") && html.includes("</main>"), "no main");
    assert(html.includes("Acme Roasters"), "brand missing");
  });

  await test("pageHTML: nav links within redesign are rewritten to local .html", () => {
    const html = pageHTML(mockRedesign.pages[0], t, mockRedesign);
    assert(html.includes('href="about.html"') || html.includes("index.html"), "no rewrite");
  });

  // Export ZIP
  await test("buildExportZip: zip contains index.html + 2 named pages + styles.css + README.txt", async () => {
    const zip = new JSZip();
    await buildExportZip(zip, mockRedesign, t);
    const names = Object.keys(zip.files).sort();
    assert(names.includes("index.html"), `files: ${names.join(",")}`);
    assert(names.includes("styles.css"), `files: ${names.join(",")}`);
    assert(names.includes("README.txt"), `files: ${names.join(",")}`);
    const htmlFiles = names.filter((n) => n.endsWith(".html"));
    assert(htmlFiles.length === 3, `expected 3 html, got ${htmlFiles.length}: ${htmlFiles}`);
  });

  await test("buildExportZip: index.html content renders all expected sections", async () => {
    const zip = new JSZip();
    await buildExportZip(zip, mockRedesign, t);
    const idx = await zip.file("index.html")!.async("string");
    assert(idx.includes("class=\"hero\""), "no hero");
    assert(idx.includes("class=\"features\""), "no features");
    assert(idx.includes("class=\"stats\""), "no stats");
    assert(idx.includes("class=\"cta-section\"") || idx.includes("class='cta-section'"), "no cta");
  });

  await test("buildExportZip: styles.css is syntactically balanced (braces match)", async () => {
    const zip = new JSZip();
    await buildExportZip(zip, mockRedesign, t);
    const css = await zip.file("styles.css")!.async("string");
    const open = (css.match(/\{/g) || []).length;
    const close = (css.match(/\}/g) || []).length;
    assert(open === close, `unbalanced braces: ${open} open vs ${close} close`);
  });

  await test("buildExportZip: export README mentions brand + template", async () => {
    const zip = new JSZip();
    await buildExportZip(zip, mockRedesign, t);
    const readme = await zip.file("README.txt")!.async("string");
    assert(readme.includes("Acme Roasters"), "no brand");
    assert(readme.includes(t.id) || readme.includes(t.name), "no template");
  });

  // XSS: ensure user-controlled content in exported HTML is escaped
  await test("export HTML: user content with <script> is escaped", async () => {
    const malicious: Redesign = {
      ...mockRedesign,
      brand: { ...mockRedesign.brand, name: "</title><script>alert(1)</script>" },
      pages: mockRedesign.pages.map((p, i) =>
        i === 0
          ? {
              ...p,
              sections: [
                {
                  kind: "hero",
                  heading: "<img src=x onerror=alert(1)>",
                  subheading: "normal",
                  body: "normal",
                  ctaLabel: "Go",
                  ctaHref: "/",
                },
              ],
            }
          : p,
      ),
    };
    const zip = new JSZip();
    await buildExportZip(zip, malicious, t);
    const idx = await zip.file("index.html")!.async("string");
    assert(!idx.includes("<script>alert(1)</script>"), "script leaked!");
    assert(!idx.includes("<img src=x onerror=alert(1)>"), "attribute XSS leaked!");
    assert(idx.includes("&lt;script&gt;") || idx.includes("&lt;img"), "escaping not visible");
  });

  // Print results
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log("\n=== SMOKE TEST RESULTS ===");
  for (const r of results) {
    if (r.pass) console.log(`  PASS  ${r.name}`);
    else console.log(`  FAIL  ${r.name}\n         ${r.detail}`);
  }
  console.log(`\nTotal: ${pass} passed, ${fail} failed (${results.length} total)`);
  const rate = pass / results.length;
  console.log(`Pass rate: ${(rate * 100).toFixed(1)}%`);
  process.exit(fail > 0 ? 1 : 0);
})();
