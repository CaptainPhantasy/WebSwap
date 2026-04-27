import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import JSZip from "jszip";
import { createWorkspace } from "../src/workspaces.ts";
import type { ScrapedSite } from "../src/types.ts";

type R = { name: string; pass: boolean; detail?: string };
const results: R[] = [];
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;

function assert(cond: any, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, pass: true });
  } catch (e: any) {
    results.push({ name, pass: false, detail: e?.message || String(e) });
  }
}

async function waitForHealth(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("server did not come up within 15s");
}

async function jsonReq(
  route: string,
  init: RequestInit,
): Promise<{ status: number; body: any; headers: Headers }> {
  const r = await fetch(BASE + route, init);
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: r.status, body, headers: r.headers };
}

async function waitForJob(jobId: string, timeoutMs = 15000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await jsonReq(`/api/jobs/${jobId}`, { method: "GET" });
    assert(r.status === 200, `job status=${r.status} body=${JSON.stringify(r.body)}`);
    const job = r.body.job;
    if (job.status === "complete" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("job did not finish");
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
      images: [{ src: "https://example-plumbing.test/images/van.jpg", alt: "Example Plumbing service van", role: "hero" }],
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
      paragraphs: ["Every service visit starts with a diagnosis, plain-language options, and a clear recommendation before work begins."],
      images: [{ src: "https://example-plumbing.test/images/sink.jpg", alt: "Technician repairing sink plumbing", role: "content" }],
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
      paragraphs: ["Call the office or send a service request with your address, issue, and preferred appointment window."],
      images: [],
    },
  ],
  allImages: [
    { src: "https://example-plumbing.test/images/van.jpg", alt: "Example Plumbing service van", role: "hero" },
    { src: "https://example-plumbing.test/images/sink.jpg", alt: "Technician repairing sink plumbing", role: "content" },
  ],
};

(async function main() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "webswap-http-"));
  const child: ChildProcess = spawn("npx", ["tsx", "server.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      REDESIGN_MODEL: "local",
      WEBSWAP_PACKAGE_DIR: workspaceRoot,
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (d) => (stderr += d.toString()));
  child.stdout?.on("data", () => {});

  try {
    await waitForHealth();
  } catch (e) {
    console.error("SERVER DID NOT START");
    console.error(stderr);
    child.kill();
    await rm(workspaceRoot, { recursive: true, force: true });
    process.exit(2);
  }

  try {
    await test("GET /api/health → 200, local builder metadata, templateCount=12", async () => {
      const r = await jsonReq("/api/health", { method: "GET" });
      assert(r.status === 200, `status=${r.status}`);
      assert(r.body.status === "ok", r.body.status);
      assert(r.body.builder === "server-local-static", r.body.builder);
      assert(r.body.buildMode === "local", r.body.buildMode);
      assert(!("model" in r.body), "health response leaked model field");
      assert(r.body.templateCount === 12, `templateCount=${r.body.templateCount}`);
    });

    await test("GET /api/templates → 12 templates with full shape", async () => {
      const r = await jsonReq("/api/templates", { method: "GET" });
      assert(r.status === 200, `status=${r.status}`);
      assert(Array.isArray(r.body.templates), "not array");
      assert(r.body.templates.length === 12, `len=${r.body.templates.length}`);
      for (const t of r.body.templates) {
        assert(typeof t.id === "string" && t.id.length > 0, "no id");
        assert(typeof t.name === "string" && t.name.length > 0, `${t.id}.name`);
        assert(t.palette && typeof t.palette.primary === "string", `${t.id}.palette`);
        assert(t.typography && typeof t.typography.heading === "string", `${t.id}.typography`);
        assert(typeof t.layoutDNA === "string" && t.layoutDNA.length > 50, `${t.id}.layoutDNA`);
      }
    });

    await test("POST /api/scrape: missing body → 400", async () => {
      const r = await jsonReq("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert(r.status === 400, `status=${r.status}`);
    });

    await test("POST /api/scrape: non-string url → 400", async () => {
      const r = await jsonReq("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: 42 }),
      });
      assert(r.status === 400, `status=${r.status}`);
    });

    const ssrfCases: Array<{ url: string; reason: string }> = [
      { url: "http://127.0.0.1/", reason: "loopback" },
      { url: "http://10.0.0.1/", reason: "10/8" },
      { url: "http://192.168.1.1/", reason: "192.168/16" },
      { url: "http://172.16.5.5/", reason: "172.16/12" },
      { url: "http://169.254.169.254/", reason: "link-local / cloud metadata" },
      { url: "http://[::1]/", reason: "IPv6 loopback" },
      { url: "file:///etc/passwd", reason: "unsupported protocol" },
      { url: "javascript:alert(1)", reason: "unsupported protocol" },
      { url: "ftp://example.com/", reason: "unsupported protocol" },
    ];
    for (const c of ssrfCases) {
      await test(`POST /api/scrape → 400 for ${c.reason} (${c.url})`, async () => {
        const r = await jsonReq("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: c.url }),
        });
        assert(r.status === 400, `status=${r.status} body=${JSON.stringify(r.body)}`);
        assert(typeof r.body.error === "string", "no error field");
      });
    }

    await test("POST /api/workspaces/:id/build: missing body → 400", async () => {
      const workspace = await createWorkspace(SITE, { rootDir: workspaceRoot });
      const r = await jsonReq(`/api/workspaces/${workspace.id}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert(r.status === 400, `status=${r.status}`);
    });

    await test("POST /api/workspaces/:id/build: bogus templateId → 400", async () => {
      const workspace = await createWorkspace(SITE, { rootDir: workspaceRoot });
      const r = await jsonReq(`/api/workspaces/${workspace.id}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: "does-not-exist" }),
      });
      assert(r.status === 400, `status=${r.status}`);
      assert(String(r.body.error || "").includes("Unknown"), JSON.stringify(r.body));
    });

    await test("POST /api/workspaces/:id/build creates job, preview, and export ZIP", async () => {
      const workspace = await createWorkspace(SITE, { rootDir: workspaceRoot });
      const start = await jsonReq(`/api/workspaces/${workspace.id}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: "editorial-serif", model: "local" }),
      });
      assert(start.status === 202, `status=${start.status} body=${JSON.stringify(start.body)}`);
      assert(typeof start.body.jobId === "string", "missing job id");
      const job = await waitForJob(start.body.jobId);
      assert(job.status === "complete", JSON.stringify(job));
      assert(job.redesign?.pages?.length === 3, `redesign pages=${job.redesign?.pages?.length}`);
      assert(job.exportUrl === `/api/workspaces/${workspace.id}/export.zip`, job.exportUrl);

      const preview = await fetch(`${BASE}/api/workspaces/${workspace.id}/preview/index.html`);
      assert(preview.status === 200, `preview status=${preview.status}`);
      const html = await preview.text();
      assert(html.includes("Example Plumbing"), "preview missing brand");
      assert(html.startsWith("<!doctype html>"), "preview missing doctype");

      const zipRes = await fetch(`${BASE}/api/workspaces/${workspace.id}/export.zip`);
      assert(zipRes.status === 200, `zip status=${zipRes.status}`);
      const zip = await JSZip.loadAsync(Buffer.from(await zipRes.arrayBuffer()));
      const names = Object.keys(zip.files).sort();
      assert(names.includes("index.html"), names.join(","));
      assert(names.includes("services.html"), names.join(","));
      assert(names.includes("contact.html"), names.join(","));
      assert(names.includes("styles.css"), names.join(","));
      assert(names.includes("README.txt"), names.join(","));
    });

    await test("GET /api/jobs/:jobId unknown → 404", async () => {
      const r = await jsonReq("/api/jobs/not-a-real-job", { method: "GET" });
      assert(r.status === 404, `status=${r.status}`);
    });

    await test("responses are application/json", async () => {
      const r = await fetch(`${BASE}/api/health`);
      const ct = r.headers.get("content-type") || "";
      assert(ct.includes("application/json"), `ct=${ct}`);
    });

    await test("unknown route → SPA fallback returns HTML (or 404 in test mode)", async () => {
      const r = await fetch(`${BASE}/__unknown_route_${Date.now()}`);
      assert(r.status === 200 || r.status === 404, `status=${r.status}`);
    });

    const pass = results.filter((r) => r.pass).length;
    const fail = results.filter((r) => !r.pass).length;
    console.log("\n=== HTTP TEST RESULTS ===");
    for (const r of results) {
      if (r.pass) console.log(`  PASS  ${r.name}`);
      else console.log(`  FAIL  ${r.name}\n         ${r.detail}`);
    }
    console.log(`\nTotal: ${pass} passed, ${fail} failed (${results.length} total)`);
    console.log(`Pass rate: ${((pass / results.length) * 100).toFixed(1)}%`);
    child.kill();
    await rm(workspaceRoot, { recursive: true, force: true });
    process.exit(fail > 0 ? 1 : 0);
  } catch (e: any) {
    console.error("Test harness error:", e?.message || e);
    child.kill();
    await rm(workspaceRoot, { recursive: true, force: true });
    process.exit(2);
  }
})();
