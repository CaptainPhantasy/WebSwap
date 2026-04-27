import express, { type NextFunction, type Request, type Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import dotenv from "dotenv";
import { DESIGN_TEMPLATES, getTemplate } from "./src/templates.ts";
import { assertPublicHost, scrapeSite } from "./src/scraper.ts";
import { BuildBlueprintSchema, createFallbackBlueprint, parseBuildBlueprintOrFallback, type BuildBlueprint } from "./src/blueprint.ts";
import { buildWorkspaceSite } from "./src/localBuilder.ts";
import { createSiteSummary } from "./src/siteSummary.ts";
import {
  DEFAULT_WORKSPACE_ROOT,
  createWorkspace,
  loadWorkspaceSite,
  resolvePreviewFile,
  resolveWorkspace,
} from "./src/workspaces.ts";
import type { DesignTemplate, ScrapedSite } from "./src/types.ts";


dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 10337;
const REDESIGN_MODEL = process.env.REDESIGN_MODEL || "gpt-5.5";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORTKEY_API_KEY = process.env.PORTKEY_API_KEY;
const PORTKEY_VIRTUAL_KEY = process.env.PORTKEY_VIRTUAL_KEY || "portkeyopenai";
const PORTKEY_BASE_URL = process.env.PORTKEY_BASE_URL || "https://api.portkey.ai/v1";

type BuildStatus = "queued" | "running" | "complete" | "failed";
type BuildMode = "model" | "local";

interface BuildJob {
  id: string;
  workspaceId: string;
  templateId: string;
  status: BuildStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  warnings: string[];
  previewUrl?: string;
  exportUrl?: string;
  redesign?: unknown;
}

interface RetryableError {
  status?: number;
  error?: { type?: string };
}

const jobs = new Map<string, BuildJob>();

function createModelClient(): OpenAI | null {
  if (REDESIGN_MODEL === "local") return null;
  if (OPENAI_API_KEY) return new OpenAI({ apiKey: OPENAI_API_KEY });
  if (PORTKEY_API_KEY) {
    return new OpenAI({
      apiKey: PORTKEY_API_KEY,
      baseURL: PORTKEY_BASE_URL,
      defaultHeaders: {
        "x-portkey-virtual-key": PORTKEY_VIRTUAL_KEY,
      },
    });
  }
  return null;
}

function isRetryable(err: unknown): err is RetryableError {
  if (typeof err !== "object" || !err) return false;
  const e = err as RetryableError;
  return e.status === 429 || e.status === 500 || e.status === 502 || e.status === 503 || e.status === 504 || e.status === 529;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 800,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`[model] transient failure; retrying attempt ${attempt + 1}/${maxAttempts} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry loop exhausted");
}

async function requestBlueprint(
  site: ScrapedSite,
  template: DesignTemplate,
  client: OpenAI | null,
): Promise<{ blueprint: BuildBlueprint; warnings: string[]; source: "model" | "local" }> {
  if (!client) {
    return {
      blueprint: createFallbackBlueprint(site, template),
      warnings: ["No blueprint model configured; used deterministic local blueprint."],
      source: "local",
    };
  }

  const summary = createSiteSummary(site, template);
  try {
    const response = await retryWithBackoff(() =>
      client.responses.parse({
        model: REDESIGN_MODEL,
        input: [
          {
            role: "system",
            content: [
              "Create a compact build blueprint for WebSwap's deterministic static-site builder.",
              "Return only decisions the local builder needs: page plan, section kinds, source references, and content warnings.",
              "Do not write final site copy. Do not invent URLs, business names, contact details, or image sources.",
              "The local builder will create the final Redesign object and export artifacts.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(summary),
          },
        ],
        reasoning: { effort: "medium" },
        text: {
          verbosity: "low",
          format: zodTextFormat(BuildBlueprintSchema, "webswap_build_blueprint"),
        },
        store: false,
      } as any),
    );

    const parsed = (response as any).output_parsed;
    const result = parseBuildBlueprintOrFallback(parsed, site, template);
    return {
      blueprint: result.blueprint,
      warnings: result.warnings,
      source: result.usedFallback ? "local" : "model",
    };
  } catch (err: any) {
    return {
      blueprint: createFallbackBlueprint(site, template),
      warnings: [`Blueprint model failed; used deterministic local blueprint (${err?.message || String(err)}).`],
      source: "local",
    };
  }
}

function publicJob(job: BuildJob): BuildJob {
  return { ...job };
}

function setJob(jobId: string, patch: Partial<BuildJob>): BuildJob {
  const current = jobs.get(jobId);
  if (!current) throw new Error(`Unknown job id: ${jobId}`);
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(jobId, next);
  return next;
}

async function runBuildJob(
  jobId: string,
  mode: BuildMode,
  client: OpenAI | null,
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    setJob(jobId, { status: "running", progress: 10 });
    const template = getTemplate(job.templateId);
    if (!template) throw new Error(`Unknown templateId: ${job.templateId}`);

    const site = await loadWorkspaceSite(job.workspaceId);
    setJob(jobId, { progress: 25 });

    const blueprint = await requestBlueprint(site, template, mode === "local" ? null : client);
    setJob(jobId, { progress: 55, warnings: blueprint.warnings });

    const artifact = await buildWorkspaceSite(job.workspaceId, site, template, blueprint.blueprint);
    setJob(jobId, {
      status: "complete",
      progress: 100,
      warnings: artifact.warnings.length ? artifact.warnings : blueprint.warnings,
      previewUrl: `/api/workspaces/${job.workspaceId}/preview/index.html`,
      exportUrl: `/api/workspaces/${job.workspaceId}/export.zip`,
      redesign: artifact.redesign,
    });
  } catch (err: any) {
    setJob(jobId, {
      status: "failed",
      progress: 100,
      error: err?.message || "Build failed",
    });
  }
}

function httpStatusForError(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err || "");
  if (message.includes("Invalid workspace") || message.includes("Invalid preview")) return 400;
  if (message.includes("ENOENT")) return 404;
  return 500;
}

async function sendPreviewFile(req: Request, res: Response): Promise<void> {
  try {
    const fileName = req.params.fileName || "index.html";
    const filePath = resolvePreviewFile(req.params.workspaceId, fileName);
    res.sendFile(filePath);
  } catch (err) {
    res.status(httpStatusForError(err)).json({ error: err instanceof Error ? err.message : "Preview unavailable" });
  }
}

async function startServer() {
  const modelClient = createModelClient();
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
      builder: "server-local-static",
      buildMode: modelClient ? "model-assisted" : "local",
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
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid URL" });
    }

    try {
      const site = await scrapeSite(url);
      const workspace = await createWorkspace(site);
      res.json({
        workspaceId: workspace.id,
        siteSummary: createSiteSummary(site),
      });
    } catch (err: any) {
      console.error("[scrape] failed:", err?.message);
      res.status(502).json({ error: err?.message || "Scrape failed" });
    }
  });

  app.post("/api/workspaces/:workspaceId/build", async (req: Request, res: Response) => {
    const { templateId, model } = req.body || {};
    if (!templateId || typeof templateId !== "string") {
      return res.status(400).json({ error: "Body must include { templateId: string }" });
    }
    if (!getTemplate(templateId)) {
      return res.status(400).json({ error: `Unknown templateId: ${templateId}` });
    }

    try {
      resolveWorkspace(req.params.workspaceId);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid workspace id" });
    }

    const mode: BuildMode = model === "local" ? "local" : "model";
    const now = new Date().toISOString();
    const job: BuildJob = {
      id: randomUUID(),
      workspaceId: req.params.workspaceId,
      templateId,
      status: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
      warnings: [],
    };
    jobs.set(job.id, job);

    void runBuildJob(job.id, mode, modelClient);
    res.status(202).json({ jobId: job.id });
  });

  app.get("/api/jobs/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Unknown job id" });
    res.json({ job: publicJob(job) });
  });

  app.get("/api/workspaces/:workspaceId/export.zip", (req, res) => {
    try {
      const workspace = resolveWorkspace(req.params.workspaceId);
      res.download(workspace.zipPath, `${workspace.id}.zip`);
    } catch (err) {
      res.status(httpStatusForError(err)).json({ error: err instanceof Error ? err.message : "Export unavailable" });
    }
  });

  app.get("/api/workspaces/:workspaceId/preview", sendPreviewFile);
  app.get("/api/workspaces/:workspaceId/preview/:fileName", sendPreviewFile);

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
    console.log(`WebSwap running at http://localhost:${PORT}`);
    console.log(`Builder: server-local-static · Templates: ${DESIGN_TEMPLATES.length}`);
    console.log(`Workspace root: ${DEFAULT_WORKSPACE_ROOT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
