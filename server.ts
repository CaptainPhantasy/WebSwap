import express, { type Request, type Response, type NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { DESIGN_TEMPLATES, getTemplate } from "./src/templates.ts";
import { assertPublicHost, scrapeSite } from "./src/scraper.ts";
import type { ScrapedSite, Redesign } from "./src/types.ts";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ANTHROPIC_MODEL = "claude-opus-4-7";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;


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
