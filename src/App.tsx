import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Search,
  Sparkles,
  Layout,
  Smartphone,
  Monitor,
  Download,
  ChevronRight,
  ChevronLeft,
  BarChart2,
  ShieldCheck,
  Zap,
  Type,
  Palette,
  ImageIcon,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import { DESIGN_TEMPLATES } from "./templates";
import type {
  DesignTemplate,
  Redesign,
  RedesignPage,
  RedesignSection,
} from "./types";
import type { SiteSummary } from "./siteSummary";
import { renderSectionPreview, fontImportUrl } from "./render";

type Step =
  | "input"
  | "scraping"
  | "choose-template"
  | "generating"
  | "preview"
  | "dashboard";

interface BuildJobState {
  status: "queued" | "running" | "complete" | "failed";
  progress: number;
  error?: string;
  exportUrl?: string;
  previewUrl?: string;
  redesign?: Redesign;
}

export default function App() {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [siteSummary, setSiteSummary] = useState<SiteSummary | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(DESIGN_TEMPLATES[0].id);
  const [redesign, setRedesign] = useState<Redesign | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [viewport, setViewport] = useState<"mobile" | "desktop">("desktop");
  const [downloading, setDownloading] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo<DesignTemplate>(
    () =>
      DESIGN_TEMPLATES.find((t) => t.id === templateId) || DESIGN_TEMPLATES[0],
    [templateId],
  );

  async function handleScrape() {
    setError(null);
    if (!url) return;
    setStep("scraping");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Scrape failed (${res.status})`);
      }
      const j = await res.json();
      if (!j.workspaceId || !j.siteSummary) {
        throw new Error("Scrape did not create a workspace");
      }
      setWorkspaceId(j.workspaceId as string);
      setSiteSummary(j.siteSummary as SiteSummary);
      setExportUrl(null);
      setRedesign(null);
      setStep("choose-template");
    } catch (e: any) {
      setError(e?.message || "Scrape failed");
      setStep("input");
    }
  }

  async function handleRedesign() {
    if (!workspaceId) return;
    setError(null);
    setBuildProgress(0);
    setStep("generating");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Build failed (${res.status})`);
      }
      const { jobId } = await res.json();
      if (!jobId) throw new Error("Build did not return a job id");
      const job = await waitForBuildJob(jobId);
      if (job.status !== "complete" || !job.redesign) {
        throw new Error(job.error || "Build did not complete");
      }
      const r = job.redesign as Redesign;
      if (!r.pages || r.pages.length === 0) throw new Error("Empty redesign");
      setRedesign(r);
      setExportUrl(job.exportUrl || `/api/workspaces/${workspaceId}/export.zip`);
      setActivePage(0);
      setStep("preview");
    } catch (e: any) {
      setError(e?.message || "Build failed");
      setStep("choose-template");
    }
  }

  async function waitForBuildJob(jobId: string): Promise<BuildJobState> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Job polling failed (${res.status})`);
      }
      const { job } = (await res.json()) as { job: BuildJobState };
      setBuildProgress(job.progress || 0);
      if (job.status === "complete" || job.status === "failed") return job;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    throw new Error("Build timed out");
  }

  async function handleExport() {
    const href = exportUrl || (workspaceId ? `/api/workspaces/${workspaceId}/export.zip` : null);
    if (!href || !redesign) return;
    setDownloading(true);
    try {
      const link = document.createElement("a");
      link.href = href;
      link.download = `${redesign.brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-demo.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      setError(e?.message || "Export failed");
    } finally {
      setDownloading(false);
    }
  }

  function resetAll() {
    setStep("input");
    setUrl("");
    setSiteSummary(null);
    setWorkspaceId(null);
    setRedesign(null);
    setExportUrl(null);
    setBuildProgress(0);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans selection:bg-orange-500 selection:text-white">
      <nav className="border-b border-white/5 bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={resetAll}
            className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-80"
          >
            <div className="w-8 h-8 bg-gradient-to-tr from-orange-600 to-amber-400 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            Web<span className="text-orange-500">Swap</span>
          </button>
          <div className="text-xs text-gray-500 hidden md:block">
            Server-built static exports · 12 designer templates
          </div>
          {step === "preview" && redesign && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("dashboard")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-white/5 rounded-full transition-colors"
              >
                <BarChart2 className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={handleExport}
                disabled={downloading}
                className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />{" "}
                {downloading ? "Bundling…" : "Export 3-page ZIP"}
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-12 pb-24">
        {error && (
          <div className="max-w-3xl mx-auto mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" /> <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-xs opacity-60 hover:opacity-100"
            >
              dismiss
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "input" && <InputStep key="input" url={url} setUrl={setUrl} onGo={handleScrape} />}

          {step === "scraping" && (
            <LoadingStep
              key="scraping"
              title="Analyzing the source site"
              subtitle="Pulling copy, images, nav, and brand signal from up to 5 pages…"
              icon={<Search className="w-8 h-8 text-orange-500" />}
            />
          )}

          {step === "choose-template" && siteSummary && (
            <ChooseTemplateStep
              key="choose"
              site={siteSummary}
              templateId={templateId}
              setTemplateId={setTemplateId}
              onGo={handleRedesign}
              onBack={() => setStep("input")}
            />
          )}

          {step === "generating" && (
            <LoadingStep
              key="generating"
              title="Building the static redesign"
              subtitle={buildProgress ? `Local builder is creating preview and export files (${buildProgress}%).` : "Creating a validated blueprint, preview, and export ZIP…"}
              icon={<Sparkles className="w-8 h-8 text-amber-400" />}
            />
          )}

          {step === "preview" && redesign && siteSummary && (
            <PreviewStep
              key="preview"
              redesign={redesign}
              template={template}
              site={siteSummary}
              activePage={activePage}
              setActivePage={setActivePage}
              viewport={viewport}
              setViewport={setViewport}
              onChangeTemplate={() => setStep("choose-template")}
            />
          )}

          {step === "dashboard" && redesign && siteSummary && (
            <DashboardStep
              key="dashboard"
              redesign={redesign}
              site={siteSummary}
              onBack={() => setStep("preview")}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 opacity-60 text-sm">
          <p>© 2026 WebSwap. Built for Floyd-powered static site exports.</p>
          <div className="flex gap-6">
            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> SSRF-guarded scraper</span>
            <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Server-side API key</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InputStep({
  url,
  setUrl,
  onGo,
}: {
  key?: React.Key;
  url: string;
  setUrl: (v: string) => void;
  onGo: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto mt-16 text-center space-y-10"
    >
      <div className="space-y-6">
        <span className="px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-bold tracking-widest uppercase border border-orange-500/20">
          Stage 1 · Analyze the real website
        </span>
        <h1 className="text-6xl md:text-7xl font-display font-bold tracking-tight leading-[1.05]">
          Show your client a <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-amber-500">
            real redesign in 60 seconds.
          </span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Paste a URL. We scrape copy, images, brand, and nav. Then you pick a
          designer template and WebSwap builds a validated 3-page static demo
          ready to preview and export.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGo();
        }}
        className="relative group max-w-2xl mx-auto"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-amber-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />
        <div className="relative flex items-center bg-[#151518] rounded-2xl p-2 border border-white/10">
          <div className="pl-4 pr-3 text-gray-500">
            <Globe className="w-6 h-6" />
          </div>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 bg-transparent py-4 text-lg font-medium focus:outline-none placeholder:text-gray-600"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-all active:scale-95"
          >
            Analyze <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </form>
      <div className="text-xs text-gray-600">
        Template selection comes <span className="text-gray-400">after</span>{" "}
        the scrape so your choice is informed by what's actually on the site.
      </div>
    </motion.div>
  );
}

function LoadingStep({
  title,
  subtitle,
  icon,
}: {
  key?: React.Key;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-[60vh] space-y-8"
    >
      <div className="relative w-32 h-32 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="absolute inset-0 border-t-2 border-r-2 border-orange-500 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="absolute inset-4 border-b-2 border-l-2 border-amber-400/50 rounded-full"
        />
        {icon}
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="text-gray-500 font-medium">{subtitle}</p>
      </div>
    </motion.div>
  );
}

function ChooseTemplateStep({
  site,
  templateId,
  setTemplateId,
  onGo,
  onBack,
}: {
  key?: React.Key;
  site: SiteSummary;
  templateId: string;
  setTemplateId: (id: string) => void;
  onGo: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-10"
    >
      <ScrapeSummary site={site} onBack={onBack} />
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold tracking-widest uppercase border border-amber-500/20">
              Stage 2 · Pick a direction
            </span>
            <h2 className="text-3xl font-bold mt-3">Choose a designer template</h2>
            <p className="text-gray-400 mt-1">
              Each template is a full aesthetic system — palette, typography, layout DNA.
              The local builder applies the one you pick to the scraped content.
            </p>
          </div>
          <button
            onClick={onGo}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-100 active:scale-95 transition-all"
          >
            Generate 3-page demo <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DESIGN_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={t.id === templateId}
              onSelect={() => setTemplateId(t.id)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  key?: React.Key;
  template: DesignTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const p = template.palette;
  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-2xl border transition-all overflow-hidden group ${
        selected
          ? "border-orange-500 shadow-lg shadow-orange-900/20"
          : "border-white/10 hover:border-white/30"
      }`}
    >
      <div
        className="h-28 relative flex items-center justify-center px-4"
        style={{ background: p.bg }}
      >
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: p.primary,
              color: p.bg,
            }}
          >
            {template.name}
          </span>
        </div>
        <div className="absolute bottom-2 right-2 flex gap-1">
          {[p.primary, p.accent, p.text, p.muted].map((c, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full border border-white/20"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div className="p-4 bg-[#151518] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm">{template.name}</h4>
          {selected && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
        </div>
        <p className="text-xs text-gray-400 line-clamp-2">{template.blurb}</p>
        <div className="flex flex-wrap gap-1.5">
          {template.mood.slice(0, 3).map((m) => (
            <span
              key={m}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400"
            >
              {m}
            </span>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 font-mono">
          {template.typography.heading} · {template.typography.body}
        </div>
      </div>
    </button>
  );
}

function ScrapeSummary({
  site,
  onBack,
}: {
  site: SiteSummary;
  onBack: () => void;
}) {
  const heroImages = site.pages
    .flatMap((page) => page.images)
    .filter((i) => i.role === "hero" || i.role === "og");
  return (
    <div className="bg-[#101014] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-orange-400">
            Scrape complete
          </div>
          <h3 className="text-2xl font-bold mt-1">{site.brand.name}</h3>
          <p className="text-gray-400 max-w-xl text-sm mt-1 line-clamp-2">
            {site.brand.tagline || "—"}
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-xs px-4 py-2 border border-white/10 rounded-full hover:bg-white/5"
        >
          ← Scrape a different URL
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pages scraped" value={String(site.totals.pages)} />
        <Stat label="Images pulled" value={String(site.totals.images)} />
        <Stat label="Paragraphs" value={String(site.totals.paragraphs)} />
        <Stat label="Nav targets" value={String(site.totals.navTargets)} />
      </div>
      {heroImages.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-2 flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5" /> Key imagery
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {heroImages.slice(0, 8).map((img) => (
              <img
                key={img.src}
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="h-20 w-32 object-cover rounded-lg border border-white/10 shrink-0"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).style.display = "none")
                }
              />
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <TagRow label="Pages" items={site.pages.map((p) => p.path)} />
        <TagRow
          label="Brand colors detected"
          items={site.brand.detectedColors}
          swatches
        />
        <TagRow label="Fonts detected" items={site.brand.detectedFonts} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function TagRow({
  label,
  items,
  swatches,
}: {
  label: string;
  items: string[];
  swatches?: boolean;
}) {
  return (
    <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-gray-600 text-xs">—</span>
        )}
        {items.slice(0, 8).map((it) => (
          <span
            key={it}
            className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-300 font-mono flex items-center gap-1"
          >
            {swatches && (
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/20"
                style={{ background: it }}
              />
            )}
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewStep({
  redesign,
  template,
  site,
  activePage,
  setActivePage,
  viewport,
  setViewport,
  onChangeTemplate,
}: {
  key?: React.Key;
  redesign: Redesign;
  template: DesignTemplate;
  site: SiteSummary;
  activePage: number;
  setActivePage: (n: number) => void;
  viewport: "mobile" | "desktop";
  setViewport: (v: "mobile" | "desktop") => void;
  onChangeTemplate: () => void;
}) {
  const page = redesign.pages[activePage];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 lg:grid-cols-4 gap-6"
    >
      <aside className="lg:col-span-1 space-y-4">
        <section className="bg-[#151518] rounded-2xl p-5 border border-white/5 space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Template
            </div>
            <h4 className="font-bold">{template.name}</h4>
            <p className="text-xs text-gray-400">{template.blurb}</p>
          </div>
          <button
            onClick={onChangeTemplate}
            className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-semibold"
          >
            Try a different template
          </button>
        </section>

        <section className="bg-[#151518] rounded-2xl p-5 border border-white/5 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5" /> Viewport
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setViewport("desktop")}
              className={`py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                viewport === "desktop"
                  ? "bg-white text-black border-white"
                  : "text-gray-400 border-white/10 hover:border-white/30"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
            <button
              onClick={() => setViewport("mobile")}
              className={`py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                viewport === "mobile"
                  ? "bg-white text-black border-white"
                  : "text-gray-400 border-white/10 hover:border-white/30"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </button>
          </div>
        </section>

        <section className="bg-[#151518] rounded-2xl p-5 border border-white/5 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Layout className="w-3.5 h-3.5" /> Tokens
          </div>
          <TokenRow
            icon={<Palette className="w-3.5 h-3.5" />}
            label={template.palette.primary}
            swatch={template.palette.primary}
          />
          <TokenRow
            icon={<Palette className="w-3.5 h-3.5" />}
            label={template.palette.accent}
            swatch={template.palette.accent}
          />
          <TokenRow
            icon={<Type className="w-3.5 h-3.5" />}
            label={template.typography.heading}
          />
          <TokenRow
            icon={<Type className="w-3.5 h-3.5" />}
            label={template.typography.body}
          />
        </section>

        <section className="bg-[#151518] rounded-2xl p-5 border border-white/5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Source
          </div>
          <div className="text-xs text-gray-400 break-all">{site.rootUrl}</div>
        </section>
      </aside>

      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center gap-2 bg-[#151518] border border-white/5 rounded-full p-1 w-fit">
          {redesign.pages.map((p, i) => (
            <button
              key={p.slug}
              onClick={() => setActivePage(i)}
              className={`px-4 py-1.5 text-xs rounded-full font-semibold transition-all ${
                activePage === i
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {i + 1}. {p.title}
            </button>
          ))}
        </div>

        <div
          className="relative bg-white rounded-2xl overflow-hidden shadow-2xl transition-all duration-500"
          style={{
            width: viewport === "mobile" ? "390px" : "100%",
            margin: viewport === "mobile" ? "0 auto" : "0",
            height: "78vh",
          }}
        >
          <link
            rel="stylesheet"
            href={fontImportUrl(template.typography.heading, template.typography.body)}
          />
          <div
            className="h-full w-full overflow-y-auto overflow-x-hidden"
            style={{
              background: template.palette.bg,
              color: template.palette.text,
              fontFamily: `'${template.typography.body}', system-ui, sans-serif`,
            }}
          >
            <PreviewPage page={page} template={template} />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <button
            onClick={() => setActivePage(Math.max(0, activePage - 1))}
            disabled={activePage === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Previous page
          </button>
          <div>
            Page {activePage + 1} of {redesign.pages.length} · {page.sections.length} sections
          </div>
          <button
            onClick={() =>
              setActivePage(Math.min(redesign.pages.length - 1, activePage + 1))
            }
            disabled={activePage === redesign.pages.length - 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-30"
          >
            Next page <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TokenRow({
  icon,
  label,
  swatch,
}: {
  icon: React.ReactNode;
  label: string;
  swatch?: string;
}) {
  return (
    <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-gray-300">
        {icon}
        <span className="truncate max-w-[11rem]">{label}</span>
      </div>
      {swatch && (
        <span
          className="w-4 h-4 rounded-full border border-white/20"
          style={{ background: swatch }}
        />
      )}
    </div>
  );
}

function PreviewPage({
  page,
  template,
}: {
  page: RedesignPage;
  template: DesignTemplate;
}) {
  return (
    <>
      <header
        className="flex items-center justify-between px-8 py-6"
        style={{ color: template.palette.text }}
      >
        <div
          className="font-bold uppercase tracking-tight"
          style={{
            fontFamily: `'${template.typography.heading}', serif`,
            letterSpacing: "-0.02em",
          }}
        >
          {page.nav[0]?.label && page.nav[0].label.length < 16
            ? page.nav[0].label
            : page.title.split(" ")[0]}
        </div>
        <nav className="flex gap-6 text-xs font-medium opacity-70">
          {page.nav.slice(0, 5).map((n) => (
            <span key={n.label}>{n.label}</span>
          ))}
        </nav>
      </header>
      {page.sections.map((s, idx) => (
        <div key={idx}>{renderSectionPreview(s, template)}</div>
      ))}
      <footer
        className="px-8 py-8 text-xs opacity-60 border-t"
        style={{ borderColor: template.palette.muted + "30" }}
      >
        © {new Date().getFullYear()} · {page.title}
      </footer>
    </>
  );
}

function DashboardStep({
  redesign,
  site,
  onBack,
}: {
  key?: React.Key;
  redesign: Redesign;
  site: SiteSummary;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-10"
    >
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-orange-500" /> Demo Dashboard
          </h1>
          <p className="text-gray-400 mt-2">
            Metrics for {redesign.brand.name} · {site.rootUrl}
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-6 py-2 border border-white/10 rounded-full hover:bg-white/5"
        >
          Back to Preview
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Design Score", val: redesign.metrics.designScore, Icon: Layout },
          { label: "Content Clarity", val: redesign.metrics.contentClarity, Icon: Type },
          { label: "Load Speed", val: redesign.metrics.loadSpeed, Icon: Zap },
          { label: "Accessibility", val: redesign.metrics.accessibility, Icon: ShieldCheck },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-[#151518] p-6 rounded-2xl border border-white/5 space-y-4"
          >
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-orange-500">
              <stat.Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                {stat.label}
              </p>
              <h4 className="text-2xl font-bold mt-1">{stat.val}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#151518] p-8 rounded-3xl border border-white/5 h-96 flex flex-col">
          <h4 className="text-lg font-bold mb-6">Section Weight vs Target</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={redesign.chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="section" stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: "#ffffff05" }} contentStyle={{ backgroundColor: "#151518", border: "1px solid #ffffff10", borderRadius: "12px" }} />
              <Bar dataKey="weight" fill="#f97316" radius={[4, 4, 0, 0]} name="Actual" />
              <Bar dataKey="target" fill="#fbbf24" radius={[4, 4, 0, 0]} name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#151518] p-8 rounded-3xl border border-white/5 space-y-4">
          <h4 className="text-lg font-bold">Recommendations</h4>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
            {redesign.suggestions.map((s, i) => (
              <div
                key={i}
                className="flex gap-3 items-start bg-black/20 p-3 rounded-2xl border border-white/5"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
                <p className="text-sm text-gray-300">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export type { RedesignSection };
