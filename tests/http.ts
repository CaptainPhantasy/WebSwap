import { spawn, type ChildProcess } from "child_process";

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
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: any }> {
  const r = await fetch(BASE + path, init);
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: r.status, body };
}

(async function main() {
  // Start server with a deliberately invalid API key so /api/redesign returns 401
  const child: ChildProcess = spawn("npx", ["tsx", "server.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      ANTHROPIC_API_KEY: "sk-ant-invalid-test-key-for-auth-error-mapping",
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
    process.exit(2);
  }

  try {
    // ----- Health
    await test("GET /api/health → 200, model, templateCount=12", async () => {
      const r = await jsonReq("/api/health", { method: "GET" });
      assert(r.status === 200, `status=${r.status}`);
      assert(r.body.status === "ok", r.body.status);
      assert(r.body.model === "claude-opus-4-7", r.body.model);
      assert(r.body.templateCount === 12, `templateCount=${r.body.templateCount}`);
    });

    // ----- Templates
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

    // ----- /api/scrape input validation
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

    // ----- /api/scrape SSRF variants (server-side)
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

    // ----- /api/redesign input validation
    await test("POST /api/redesign: missing body → 400", async () => {
      const r = await jsonReq("/api/redesign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert(r.status === 400, `status=${r.status}`);
    });

    await test("POST /api/redesign: missing templateId → 400", async () => {
      const r = await jsonReq("/api/redesign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: { rootUrl: "https://x.com" } }),
      });
      assert(r.status === 400, `status=${r.status}`);
    });

    await test("POST /api/redesign: bogus templateId → 400", async () => {
      const r = await jsonReq("/api/redesign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: { rootUrl: "https://x.com", pages: [], brand: {}, allImages: [] },
          templateId: "does-not-exist",
        }),
      });
      assert(r.status === 400, `status=${r.status}`);
      assert(String(r.body.error || "").includes("Unknown"), JSON.stringify(r.body));
    });

    // ----- /api/redesign auth error mapping (invalid API key → 401)
    await test("POST /api/redesign: invalid API key → 401 (SDK AuthenticationError mapped)", async () => {
      const r = await jsonReq("/api/redesign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: {
            rootUrl: "https://example.com",
            origin: "https://example.com",
            scrapedAt: new Date().toISOString(),
            brand: { name: "Example", tagline: "Test", detectedColors: [], detectedFonts: [], emails: [], phones: [], socials: [] },
            pages: [
              {
                url: "https://example.com/",
                path: "/",
                title: "Example",
                metaDescription: "Example site",
                h1: ["Hello"],
                h2: [],
                navLinks: [],
                ctas: [],
                paragraphs: ["Example paragraph that is long enough to be valid content."],
                images: [],
              },
            ],
            allImages: [],
          },
          templateId: "editorial-serif",
        }),
      });
      assert(
        r.status === 401,
        `expected 401 for bogus API key, got ${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`,
      );
    });

    // ----- Response headers / basic hardening
    await test("responses are application/json", async () => {
      const r = await fetch(`${BASE}/api/health`);
      const ct = r.headers.get("content-type") || "";
      assert(ct.includes("application/json"), `ct=${ct}`);
    });

    await test("unknown route → SPA fallback returns HTML (or 404 in test mode)", async () => {
      const r = await fetch(`${BASE}/__unknown_route_${Date.now()}`);
      // In test/dev mode vite returns index.html; either 200 html or 404 is acceptable
      assert(r.status === 200 || r.status === 404, `status=${r.status}`);
    });

    // Print results
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
    process.exit(fail > 0 ? 1 : 0);
  } catch (e: any) {
    console.error("Test harness error:", e?.message || e);
    child.kill();
    process.exit(2);
  }
})();
