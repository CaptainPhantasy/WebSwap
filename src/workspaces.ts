import path from "path";
import { fileURLToPath } from "url";
import { mkdir, readFile, writeFile } from "fs/promises";
import type { ScrapedSite } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_PARENT = path.resolve(__dirname, "..", "..");

export const DEFAULT_WORKSPACE_ROOT = path.resolve(
  process.env.WEBSWAP_PACKAGE_DIR || path.join(PROJECT_PARENT, "webswap-packages"),
);

const WORKSPACE_ID_RE = /^webswap-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}$/;
const SAFE_PREVIEW_FILE_RE = /^(index|[a-z0-9-]{1,60})\.html$|^styles\.css$|^README\.txt$/;

export interface WorkspaceOptions {
  rootDir?: string;
}

export interface WorkspacePaths {
  id: string;
  rootDir: string;
  dir: string;
  contentDir: string;
  previewDir: string;
  zipPath: string;
  redesignPath: string;
  metadataPath: string;
}

export interface WorkspaceMetadata {
  id: string;
  rootUrl: string;
  origin: string;
  createdAt: string;
}

export async function createWorkspace(
  site: ScrapedSite,
  options: WorkspaceOptions = {},
): Promise<WorkspacePaths> {
  const workspace = resolveWorkspace(createWorkspaceId(), options);
  await mkdir(workspace.contentDir, { recursive: true });
  await mkdir(workspace.previewDir, { recursive: true });

  await writeFile(
    path.join(workspace.contentDir, "scraped-data.json"),
    JSON.stringify(site, null, 2),
  );
  await writeFile(
    workspace.metadataPath,
    JSON.stringify(
      {
        id: workspace.id,
        rootUrl: site.rootUrl,
        origin: site.origin,
        createdAt: new Date().toISOString(),
      } satisfies WorkspaceMetadata,
      null,
      2,
    ),
  );

  return workspace;
}

export function resolveWorkspace(
  workspaceId: string,
  options: WorkspaceOptions = {},
): WorkspacePaths {
  if (!WORKSPACE_ID_RE.test(workspaceId)) {
    throw new Error("Invalid workspace id");
  }

  const rootDir = path.resolve(options.rootDir || DEFAULT_WORKSPACE_ROOT);
  const dir = path.resolve(rootDir, workspaceId);
  assertInside(rootDir, dir);

  return {
    id: workspaceId,
    rootDir,
    dir,
    contentDir: path.join(dir, "content"),
    previewDir: path.join(dir, "preview"),
    zipPath: path.join(dir, "export.zip"),
    redesignPath: path.join(dir, "content", "redesign.json"),
    metadataPath: path.join(dir, "workspace.json"),
  };
}

export async function loadWorkspaceSite(
  workspaceId: string,
  options: WorkspaceOptions = {},
): Promise<ScrapedSite> {
  const workspace = resolveWorkspace(workspaceId, options);
  const raw = await readFile(path.join(workspace.contentDir, "scraped-data.json"), "utf8");
  const site = JSON.parse(raw) as ScrapedSite;
  validateScrapedSite(site);
  return site;
}

export async function loadWorkspaceMetadata(
  workspaceId: string,
  options: WorkspaceOptions = {},
): Promise<WorkspaceMetadata> {
  const workspace = resolveWorkspace(workspaceId, options);
  const raw = await readFile(workspace.metadataPath, "utf8");
  return JSON.parse(raw) as WorkspaceMetadata;
}

export function resolvePreviewFile(
  workspaceId: string,
  fileName: string,
  options: WorkspaceOptions = {},
): string {
  const normalized = fileName || "index.html";
  if (!SAFE_PREVIEW_FILE_RE.test(normalized)) {
    throw new Error("Invalid preview file");
  }
  const workspace = resolveWorkspace(workspaceId, options);
  const filePath = path.resolve(workspace.previewDir, normalized);
  assertInside(workspace.previewDir, filePath);
  return filePath;
}

function createWorkspaceId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `webswap-${timestamp}-${random}`;
}

function assertInside(rootDir: string, targetPath: string): void {
  const relative = path.relative(rootDir, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved path escapes workspace root");
  }
}

function validateScrapedSite(site: ScrapedSite): void {
  if (!site || typeof site !== "object") throw new Error("Invalid scraped site");
  if (!site.rootUrl || typeof site.rootUrl !== "string") throw new Error("Invalid scraped site rootUrl");
  if (!site.brand || typeof site.brand.name !== "string") throw new Error("Invalid scraped site brand");
  if (!Array.isArray(site.pages)) throw new Error("Invalid scraped site pages");
  if (!Array.isArray(site.allImages)) throw new Error("Invalid scraped site images");
}
