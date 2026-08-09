import { useEffect, useState } from "react";
import packageInfo from "../package.json";
import extensionLogo from "../assets/amazon-product-analysis-logo.svg";
import {
  AlertTriangle,
  AppWindow,
  ArrowDownToLine,
  ArrowRight,
  Check,
  Code2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Globe2,
  Layers3,
  Link2,
  ListFilter,
  PackageOpen,
  Palette,
  Play,
  RefreshCw,
  Save,
  ScanSearch,
  Settings2,
  ShieldCheck,
  TableProperties,
  Upload,
  Zap
} from "lucide-react";

const DOWNLOAD_PATH = "/downloads/amazon-product-analysis-extension.zip";
const GITHUB_URL = "https://github.com/prdiyora/Amazon-Product-Analysis";
const VERSION = packageInfo.version;

const previewProducts = [
  { title: "Oil sprayer, 200 ml", bought: "10K+", reviews: "8,421", score: 96 },
  { title: "Glass dispenser set", bought: "5K+", reviews: "2,104", score: 78 },
  { title: "Kitchen mister bottle", bought: "3K+", reviews: "947", score: 64 }
];

const flowNodes = [
  {
    eyebrow: "Your Amazon page",
    title: "Search, category or filters",
    copy: "Choose the exact Amazon.in or Amazon.com results you want to study.",
    icon: ScanSearch
  },
  {
    eyebrow: "Extension engine",
    title: "Collect and enrich",
    copy: "Follow pagination, skip sponsored cards, and read each product detail page.",
    icon: Zap
  },
  {
    eyebrow: "Your Google Sheet",
    title: "Sort, color and reuse",
    copy: "Upsert products, rank demand signals, and keep every analysis easy to revisit.",
    icon: FileSpreadsheet
  }
];

const capabilityGroups = [
  {
    label: "Collect",
    icon: ScanSearch,
    title: "Work from the page you already chose",
    copy: "There is no duplicate brand or product search box. Search and filter on Amazon, then start from that current listing page.",
    points: [
      "Amazon India and Amazon USA support",
      "Up to 50 unique products per run",
      "Sponsored listings excluded",
      "Pagination followed automatically"
    ]
  },
  {
    label: "Enrich",
    icon: TableProperties,
    title: "Turn listings into usable product signals",
    copy: "The extension visits product pages when needed and captures the details required for product comparison.",
    points: [
      "ASIN, title, brand and canonical URL",
      "Price text, numeric price and currency",
      "Rating, reviews and bought count",
      "Category context and scrape health"
    ]
  },
  {
    label: "Organize",
    icon: Layers3,
    title: "Keep research clean as the Sheet grows",
    copy: "Choose a topic tab or use the marketplace default. Every new run appends a historical snapshot without removing previous rows.",
    points: [
      "Optional custom analysis tabs",
      "Separate IN and USA destinations",
      "Previous runs preserved, including repeated ASINs",
      "Light row colors identify each run after global sorting"
    ]
  },
  {
    label: "Recover",
    icon: ShieldCheck,
    title: "See failures and continue safely",
    copy: "Progress is saved during a run, upload failures can be retried, and structured diagnostics explain what needs attention.",
    points: [
      "Progressive save every 10 products",
      "Retry cached rows after upload failure",
      "Product-level status and errors",
      "Copyable diagnostics without sensitive URLs"
    ]
  }
];

const setupSteps = [
  {
    title: "Download and extract",
    copy: "Download the extension ZIP and extract it to a permanent folder. Chrome must keep access to this folder."
  },
  {
    title: "Load it in Chrome",
    copy: "Open chrome://extensions, turn on Developer mode, choose Load unpacked, and select the extracted folder."
  },
  {
    title: "Create the Google Sheet",
    copy: "Create a dedicated Sheet for this user, then open Extensions → Apps Script from that Sheet."
  },
  {
    title: "Connect the Sheet",
    copy: "Replace the editor code with apps-script/Code.gs. Select configureTargetSpreadsheet, click Run, and allow access."
  },
  {
    title: "Deploy the web app",
    copy: "Choose Deploy → New deployment → Web app. Set Execute as Me and access to Anyone, then deploy."
  },
  {
    title: "Save the /exec URL",
    copy: "Paste the generated script.google.com/macros/s/.../exec URL into the extension. No shared token is required."
  }
];

const runSteps = [
  {
    title: "Prepare the Amazon page",
    copy: "Open a category or search result on Amazon.in or Amazon.com and apply the filters you need.",
    icon: ScanSearch
  },
  {
    title: "Match the marketplace",
    copy: "Choose India or USA in the popup so it matches the active Amazon tab.",
    icon: Globe2
  },
  {
    title: "Choose the Sheet tab",
    copy: "Leave the analysis name blank for Amazon Products IN/USA, or enter a topic such as Umbrella Analysis.",
    icon: Layers3
  },
  {
    title: "Start the analysis",
    copy: "Click Start analysis and keep the source Amazon tab open and unchanged until the run finishes.",
    icon: Play
  },
  {
    title: "Watch safe progress",
    copy: "The popup reports each stage. Every 10 completed products are progressively saved to the same destination.",
    icon: Save
  },
  {
    title: "Open or retry",
    copy: "Open the exact Sheet tab after success. If only the upload fails, use Retry upload without scraping again.",
    icon: RefreshCw
  }
];

const sheetFieldGroups = [
  {
    label: "Context",
    fields: ["Run timestamp", "Category URL", "Category name", "Category path", "Marketplace"]
  },
  {
    label: "Identity",
    fields: ["ASIN", "Title", "Brand", "Product URL"]
  },
  {
    label: "Commercial",
    fields: ["Price", "Price value", "Currency", "Rating"]
  },
  {
    label: "Demand",
    fields: ["Review count", "Bought text", "Bought count"]
  },
  {
    label: "Quality",
    fields: ["Status", "Error"]
  }
];

function BrandLogo({ className = "size-10" }) {
  return (
    <img
      className={`${className} shrink-0`}
      src={extensionLogo}
      alt="Amazon Product Analysis extension logo"
    />
  );
}

function DownloadButton({ compact = false }) {
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!downloaded) return undefined;
    const timer = window.setTimeout(() => setDownloaded(false), 3000);
    return () => window.clearTimeout(timer);
  }, [downloaded]);

  return (
    <a
      className={`group inline-flex items-center justify-center gap-2 bg-signal font-bold text-ink shadow-[0_5px_0_#b86d00] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#b86d00] active:translate-y-1 active:shadow-[0_1px_0_#b86d00] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-data ${
        compact ? "rounded-lg px-4 py-2.5 text-sm" : "rounded-xl px-5 py-3.5"
      }`}
      href={DOWNLOAD_PATH}
      download
      onClick={() => setDownloaded(true)}
    >
      {downloaded ? <Check size={18} /> : <ArrowDownToLine size={18} />}
      {compact ? (
        <>
          <span className="sm:hidden">{downloaded ? "Started" : "Download"}</span>
          <span className="hidden sm:inline">{downloaded ? "Download started" : "Download extension"}</span>
        </>
      ) : downloaded ? (
        "Download started"
      ) : (
        "Download extension"
      )}
    </a>
  );
}

function SectionHeading({ eyebrow, title, copy, inverse = false }) {
  return (
    <div className="max-w-3xl">
      <p
        className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${
          inverse ? "text-signal" : "text-data"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-4 font-display text-4xl font-black uppercase leading-[0.92] tracking-[-0.055em] sm:text-6xl ${
          inverse ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {copy && (
        <p className={`mt-6 max-w-2xl leading-7 ${inverse ? "text-[#b9ccc3]" : "text-muted"}`}>
          {copy}
        </p>
      )}
    </div>
  );
}

function ExtensionPreview() {
  return (
    <div className="signal-scan relative mx-auto w-full max-w-md overflow-hidden rounded-[24px_8px_24px_8px] border border-line bg-white p-4 shadow-[14px_16px_0_#d9f8e7] sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo />
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
              Product intelligence
            </p>
            <p className="truncate font-display text-lg font-bold tracking-[-0.04em] text-ink">
              Amazon Product Analysis
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[#efbd68] bg-[#fff5dc] px-2 py-1 font-mono text-[10px] font-bold text-[#785000]">
          50 max
        </span>
      </div>

      <div className="rounded-xl border border-line bg-paper p-3">
        <div className="mb-2 flex items-center justify-between rounded-md bg-[#e9efff] px-2.5 py-2">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-muted">
            Sheet tab
          </span>
          <strong className="min-w-0 truncate text-[10px] text-data">Umbrella Analysis - IN</strong>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Live product signals
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#16794a]">
            <span className="size-2 rounded-full bg-[#1aaa68] shadow-[0_0_0_4px_rgba(26,170,104,.12)]" />
            Ready
          </span>
        </div>

        <div className="grid gap-2">
          {previewProducts.map((product, index) => (
            <div
              className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-lg border border-line p-2.5 ${
                index < 2 ? "bg-[#fff4d6]" : "bg-[#eaf2ff]"
              }`}
              key={product.title}
            >
              <span className="font-mono text-xs font-bold text-muted">0{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-ink">{product.title}</p>
                <p className="mt-0.5 font-mono text-[9px] text-muted">
                  {product.bought} bought · {product.reviews} reviews
                </p>
              </div>
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/70">
                <span
                  className="block h-full rounded-full bg-data"
                  style={{ width: `${product.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-ink px-4 py-3 text-white">
        <span className="text-xs font-bold">Current-page analysis ready</span>
        <span className="flex items-center gap-1 font-mono text-[10px] text-[#b9ccc3]">
          amazon.in <ArrowRight size={12} />
        </span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen overflow-hidden bg-paper text-ink">
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:gap-5 sm:px-8 lg:px-10">
        <a
          className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-data"
          href="#top"
          aria-label="Amazon Product Analysis home"
        >
          <BrandLogo />
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate font-display text-lg font-bold leading-none tracking-[-0.04em]">
              Amazon Product Analysis
            </span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              Chrome extension
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {[
            ["Features", "#features"],
            ["Setup", "#setup"],
            ["How to use", "#how-to-use"],
            ["Sheet data", "#sheet-data"]
          ].map(([label, href]) => (
            <a
              className="rounded-lg px-3 py-2 text-sm font-bold text-muted transition hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-data"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <a
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-muted transition hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-data sm:flex"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={17} />
            Source
          </a>
          <DownloadButton compact />
        </div>
      </header>

      <main id="top">
        <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.08fr_.92fr] lg:px-10 lg:pb-32">
          <div className="absolute -left-28 top-12 size-80 rounded-full bg-mint blur-3xl" aria-hidden="true" />
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              <AppWindow size={14} className="text-data" />
              Amazon.in + Amazon.com
            </div>

            <h1 className="max-w-3xl font-display text-[2.65rem] font-black uppercase leading-[0.86] tracking-[-0.075em] sm:text-[clamp(3.2rem,8vw,6.7rem)] sm:leading-[0.83]">
              Amazon research,
              <span className="relative ml-0 mt-3 block w-fit text-data sm:ml-16">
                made useful.
                <svg
                  className="absolute -bottom-3 left-0 w-full text-signal"
                  viewBox="0 0 560 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M3 13C126 3 341 2 557 9" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="mt-10 max-w-xl text-lg leading-8 text-muted sm:text-xl">
              Search and filter directly on Amazon, collect up to 50 non-sponsored products, and
              turn them into sorted, reusable Google Sheet research.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <DownloadButton />
              <a
                className="inline-flex items-center gap-2 text-sm font-bold text-ink underline decoration-line decoration-2 underline-offset-4 transition hover:decoration-data focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-data"
                href="#setup"
              >
                Read the full setup <ArrowRight size={16} />
              </a>
            </div>

            <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              <span>Version {VERSION}</span>
              <span className="size-1 rounded-full bg-signal" />
              <span>Manifest V3</span>
              <span className="size-1 rounded-full bg-signal" />
              <span>Free download</span>
            </p>
          </div>

          <div className="relative z-10 min-w-0 lg:pt-8">
            <div className="absolute -right-12 -top-12 size-36 rounded-[40px_12px_40px_12px] border-[18px] border-[#e9efff]" aria-hidden="true" />
            <ExtensionPreview />
          </div>
        </section>

        <section className="border-y border-line bg-white py-16 sm:py-20" aria-labelledby="flow-heading">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-data">
                  One continuous signal
                </p>
                <h2 id="flow-heading" className="mt-3 font-display text-3xl font-black uppercase tracking-[-0.05em] sm:text-4xl">
                  Amazon page → analysis → Sheet
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted">
                The extension uses the page you already prepared. No repeated keyword entry and no
                shared destination between users.
              </p>
            </div>

            <div className="flow-rail grid gap-3 lg:grid-cols-3">
              {flowNodes.map(({ eyebrow, title, copy, icon: Icon }, index) => (
                <article className="flow-node relative bg-paper p-6 lg:min-h-52" key={title}>
                  <div className="mb-8 flex items-center justify-between">
                    <Icon className="text-data" size={24} strokeWidth={2.2} />
                    <span className="font-mono text-[10px] font-bold text-muted">0{index + 1}</span>
                  </div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
                  <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.045em]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-32" id="features">
          <SectionHeading
            eyebrow="Complete feature set"
            title="Built for repeat research, not one-off exports."
            copy="Every part of the workflow is designed to keep a growing Amazon research Sheet accurate, understandable, and recoverable."
          />

          <div className="mt-16 border-y border-line">
            {capabilityGroups.map(({ label, icon: Icon, title, copy, points }) => (
              <article
                className="grid gap-8 border-b border-line py-10 last:border-b-0 md:grid-cols-[.48fr_1fr_1fr] md:gap-10 lg:py-12"
                key={label}
              >
                <div className="flex items-center gap-3 self-start">
                  <span className="grid size-11 place-items-center rounded-[12px_4px_12px_4px] bg-white text-data shadow-[4px_4px_0_#d9f8e7]">
                    <Icon size={21} />
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-data">
                    {label}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-3xl font-bold leading-tight tracking-[-0.05em]">{title}</h3>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-muted">{copy}</p>
                </div>
                <ul className="grid content-start gap-3">
                  {points.map((point) => (
                    <li className="flex items-start gap-3 text-sm leading-6" key={point}>
                      <Check className="mt-0.5 shrink-0 text-[#168a52]" size={16} strokeWidth={2.5} />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-ink py-24 text-white lg:py-32" id="setup">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
              <div className="lg:sticky lg:top-10 lg:self-start">
                <SectionHeading
                  eyebrow="One-time setup"
                  title="Connect Chrome to your own Sheet."
                  copy="Each user gets a separate Google Sheet and Apps Script endpoint. The extension stores that endpoint locally and does not need a shared token."
                  inverse
                />
                <div className="mt-8 rounded-[18px_6px_18px_6px] border border-white/15 bg-white/[0.05] p-5">
                  <div className="flex items-center gap-3 text-signal">
                    <Link2 size={20} />
                    <strong className="text-sm text-white">One endpoint per user</strong>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#b9ccc3]">
                    A user shares only their own <code className="text-white">/exec</code> URL with
                    their installed extension. Their rows stay in their configured Sheet.
                  </p>
                </div>
              </div>

              <ol className="border-y border-white/15">
                {setupSteps.map((step, index) => (
                  <li className="grid gap-4 border-b border-white/15 py-7 last:border-b-0 sm:grid-cols-[64px_1fr]" key={step.title}>
                    <span className="font-mono text-sm font-bold text-signal">0{index + 1}</span>
                    <div>
                      <h3 className="font-display text-2xl font-bold tracking-[-0.04em]">{step.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b9ccc3]">{step.copy}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-12 flex items-start gap-4 rounded-xl border border-[#ffcc7a]/30 bg-[#ff9900]/10 p-5">
              <Upload className="mt-0.5 shrink-0 text-signal" size={21} />
              <p className="text-sm leading-6 text-[#e7f0eb]">
                <strong className="text-white">After any Code.gs update:</strong> open Deploy →
                Manage deployments → Edit, choose New version, and deploy again. Saving the editor
                alone does not update the live <code>/exec</code> endpoint.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-32" id="how-to-use">
          <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <SectionHeading
                eyebrow="Every analysis"
                title="Six clear actions from page to rows."
                copy="Prepare the exact results on Amazon first. The extension then handles collection, enrichment, progressive upload, and the final Sheet link."
              />

              <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl border border-line bg-white p-5">
                  <Globe2 className="text-data" size={21} />
                  <p className="mt-3 text-sm font-bold">Default tabs</p>
                  <p className="mt-1 font-mono text-[10px] leading-5 text-muted">
                    Amazon Products IN<br />
                    Amazon Products USA
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-white p-5">
                  <Palette className="text-data" size={21} />
                  <p className="mt-3 text-sm font-bold">Run colors</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Products from one run share a light color, so large tabs remain readable.
                  </p>
                </div>
              </div>
            </div>

            <ol className="grid gap-4 sm:grid-cols-2">
              {runSteps.map(({ title, copy, icon: Icon }, index) => (
                <li
                  className="group relative overflow-hidden rounded-[20px_7px_20px_7px] border border-line bg-white p-6 transition hover:-translate-y-1 hover:border-[#aebdb5] hover:shadow-[8px_10px_0_#d9f8e7]"
                  key={title}
                >
                  <div className="mb-8 flex items-center justify-between">
                    <Icon className="text-data" size={23} />
                    <span className="font-mono text-[10px] font-bold text-muted">0{index + 1}</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold tracking-[-0.045em]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="flex gap-4 border-l-2 border-data bg-[#e9efff] p-5">
              <Settings2 className="shrink-0 text-data" size={20} />
              <p className="text-sm leading-6 text-[#29425f]">
                The endpoint, marketplace, and optional tab name are saved for the next popup open.
              </p>
            </div>
            <div className="flex gap-4 border-l-2 border-signal bg-[#fff4d6] p-5">
              <AlertTriangle className="shrink-0 text-[#9a6100]" size={20} />
              <p className="text-sm leading-6 text-[#5c4636]">
                CAPTCHA is not bypassed. Complete Amazon verification manually, then start again.
              </p>
            </div>
            <div className="flex gap-4 border-l-2 border-[#168a52] bg-[#e8f7ef] p-5">
              <ShieldCheck className="shrink-0 text-[#168a52]" size={20} />
              <p className="text-sm leading-6 text-[#27513d]">
                Use reasonable manual volume and keep the source page unchanged during a run.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white py-24 lg:py-32" id="sheet-data">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
              <div>
                <SectionHeading
                  eyebrow="What reaches Google Sheets"
                  title="Every row keeps its research context."
                  copy="The output combines identity, commercial signals, demand, and scrape quality. This makes filtering and comparison possible without reopening every product."
                />
                <div className="mt-8 flex items-center gap-3 text-sm font-bold text-data">
                  <Database size={19} />
                  18 structured columns
                </div>
              </div>

              <div className="grid gap-px overflow-hidden rounded-[24px_8px_24px_8px] border border-line bg-line sm:grid-cols-2">
                {sheetFieldGroups.map((group, index) => (
                  <article
                    className={`bg-paper p-6 ${index === sheetFieldGroups.length - 1 ? "sm:col-span-2" : ""}`}
                    key={group.label}
                  >
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-data">{group.label}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.fields.map((field) => (
                        <span className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-muted" key={field}>
                          {field}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              <article className="border-t-2 border-data pt-5">
                <ListFilter className="text-data" size={22} />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.04em]">Demand-first sorting</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Every progressive save re-sorts the whole tab: bought count highest first, then lower reviews for ties.
                </p>
              </article>
              <article className="border-t-2 border-data pt-5">
                <RefreshCw className="text-data" size={22} />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.04em]">History without Retry duplicates</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  New runs append snapshots—even for repeated ASINs—while retries inside one run update safely.
                </p>
              </article>
              <article className="border-t-2 border-data pt-5">
                <Palette className="text-data" size={22} />
                <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.04em]">Run-level color memory</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Light row colors show which products came from the same analysis run without separator rows.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px_10px_32px_10px] bg-ink px-6 py-16 text-white sm:px-12 lg:px-16 lg:py-20">
            <div className="absolute right-0 top-0 font-display text-[14rem] font-black leading-none text-white/[0.035]" aria-hidden="true">
              50
            </div>
            <div className="relative z-10 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
              <div>
                <PackageOpen className="mb-6 text-signal" size={34} />
                <h2 className="max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.055em] sm:text-6xl">
                  Your next product shortlist starts on Amazon.
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-[#b9ccc3]">
                  Download the ZIP, connect your Sheet once, and analyze the exact result pages you choose.
                </p>
              </div>
              <DownloadButton />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-xs text-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-3">
          <BrandLogo className="size-8" />
          <p>Amazon Product Analysis · Version {VERSION}</p>
        </div>
        <a
          className="inline-flex items-center gap-1.5 font-bold text-ink hover:text-data focus-visible:outline-2 focus-visible:outline-data"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
        >
          View source on GitHub <ExternalLink size={13} />
        </a>
      </footer>
    </div>
  );
}
