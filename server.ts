import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Item 1: Universal Website Analyzer (10-page deep scraping)
  app.post("/api/analyze", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const results: any[] = [];
      const visited = new Set<string>();
      const queue = [{ url, depth: 0 }];
      const maxPages = 10;
      const maxDepth = 2;

      const baseUrlOrigin = new URL(url).origin;

      while (queue.length > 0 && results.length < maxPages) {
        const { url: currentUrl, depth } = queue.shift()!;
        if (visited.has(currentUrl) || depth > maxDepth) continue;
        visited.add(currentUrl);

        try {
          const response = await fetch(currentUrl, {
            headers: { "User-Agent": "Mozilla/5.0 SiteReimaginerBot/1.0" }
          });
          const html = await response.text();
          const $ = cheerio.load(html);

          const title = $("title").text();
          const description = $('meta[name="description"]').attr("content") || "";
          const verbiage = $("body").text().replace(/\s+/g, " ").trim().substring(0, 3000);
          
          const stylesheets: string[] = [];
          $('link[rel="stylesheet"]').each((_, el) => {
            const href = $(el).attr("href");
            if (href) stylesheets.push(href);
          });

          results.push({
            url: currentUrl,
            title,
            description,
            verbiage,
            stylesheets
          });

          if (depth < maxDepth) {
            $("a[href]").each((_, el) => {
              let href = $(el).attr("href");
              if (href) {
                try {
                   const absoluteUrl = new URL(href, currentUrl).href;
                   if (absoluteUrl.startsWith(baseUrlOrigin) && !visited.has(absoluteUrl)) {
                     queue.push({ url: absoluteUrl, depth: depth + 1 });
                   }
                } catch (e) {}
              }
            });
          }
        } catch (e) {
          console.error(`Failed to scrape ${currentUrl}`);
        }
      }

      res.json({ pages: results, siteInfo: { url, mainTitle: results[0]?.title || url } });
    } catch (error) {
       res.status(500).json({ error: "Analysis failed" });
    }
  });

  // Item 11: Robust API (Example Export API)
  app.post("/api/export", async (req, res) => {
    const { project } = req.body;
    res.json({ message: "Export ready", project });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
