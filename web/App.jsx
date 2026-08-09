import { useEffect, useState } from "react";
import packageInfo from "../package.json";
import {
  ArrowDownToLine,
  ArrowRight,
  AppWindow,
  Check,
  Code2,
  ExternalLink,
  FileSpreadsheet,
  ListFilter,
  PackageOpen,
  ScanSearch
} from "lucide-react";

const DOWNLOAD_PATH = "/downloads/amazon-product-analysis-extension.zip";
const GITHUB_URL = "https://github.com/prdiyora/Amazon-Product-Analysis";
const VERSION = packageInfo.version;

const products = [
  { title: "Oil sprayer, 200 ml", bought: "10K+", reviews: "8,421", score: 96 },
  { title: "Glass dispenser set", bought: "5K+", reviews: "2,104", score: 78 },
  { title: "Kitchen mister bottle", bought: "3K+", reviews: "947", score: 64 }
];

const features = [
  {
    icon: ScanSearch,
    title: "Analyze the page you chose",
    copy: "Search or filter directly on Amazon India or USA, then collect the current result page without repeating the query."
  },
  {
    icon: ListFilter,
    title: "Sort what matters",
    copy: "Rank products by bought count, then use lower review competition to break ties."
  },
  {
    icon: FileSpreadsheet,
    title: "Name every analysis",
    copy: "Use the default marketplace tab or optionally route a topic into its own named IN or USA tab."
  }
];

const steps = [
  {
    label: "Download",
    title: "Get the extension ZIP",
    copy: "Download and extract the package to a permanent folder on your computer."
  },
  {
    label: "Load",
    title: "Open Chrome extensions",
    copy: "Visit chrome://extensions, enable Developer mode, and choose Load unpacked."
  },
  {
    label: "Analyze",
    title: "Open Amazon and start",
    copy: "Open your category or search results, optionally name the Sheet tab, and start collecting."
  }
];

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
      {downloaded ? "Download started" : "Download extension"}
    </a>
  );
}

function ExtensionPreview() {
  return (
    <div className="signal-scan relative mx-auto w-full max-w-md overflow-hidden rounded-[24px_8px_24px_8px] border border-line bg-white p-4 shadow-[14px_16px_0_#d9f8e7] sm:p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px_4px_12px_4px] bg-ink font-mono text-xs font-bold text-white shadow-[4px_4px_0_#ff9900]">
            AP
          </span>
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
              Product intelligence
            </p>
            <p className="font-display text-lg font-bold tracking-[-0.04em] text-ink">
              Amazon Product Analysis
            </p>
          </div>
        </div>
        <span className="rounded-full border border-[#efbd68] bg-[#fff5dc] px-2 py-1 font-mono text-[10px] font-bold text-[#785000]">
          50 max
        </span>
      </div>

      <div className="rounded-xl border border-line bg-paper p-3">
        <div className="mb-2 flex items-center justify-between rounded-md bg-[#e9efff] px-2.5 py-2">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-muted">
            Sheet tab
          </span>
          <strong className="text-[10px] text-data">Umbrella Analysis - IN</strong>
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
          {products.map((product, index) => (
            <div
              className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-lg border border-line bg-white p-2.5"
              key={product.title}
            >
              <span className="font-mono text-xs font-bold text-muted">0{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-ink">{product.title}</p>
                <p className="mt-0.5 font-mono text-[9px] text-muted">
                  {product.bought} bought · {product.reviews} reviews
                </p>
              </div>
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
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
        <span className="text-xs font-bold">Named analysis ready</span>
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
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a
          className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-data"
          href="#top"
          aria-label="Amazon Product Analysis home"
        >
          <span className="grid size-10 place-items-center rounded-[12px_4px_12px_4px] bg-ink font-mono text-xs font-bold text-white shadow-[4px_4px_0_#ff9900]">
            AP
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-none tracking-[-0.04em]">
              Amazon Product Analysis
            </span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              Chrome extension
            </span>
          </span>
        </a>

        <div className="flex items-center gap-3">
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

            <h1 className="max-w-3xl font-display text-[clamp(3.2rem,8vw,6.7rem)] font-black uppercase leading-[0.83] tracking-[-0.075em]">
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
              Search and filter directly on Amazon, then compare up to 50 non-sponsored listings
              from the current page and save every topic in its own Google Sheet tab.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <DownloadButton />
              <a
                className="inline-flex items-center gap-2 text-sm font-bold text-ink underline decoration-line decoration-2 underline-offset-4 transition hover:decoration-data focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-data"
                href="#install"
              >
                Installation guide <ArrowRight size={16} />
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

          <div className="relative z-10 lg:pt-8">
            <div className="absolute -right-12 -top-12 size-36 rounded-[40px_12px_40px_12px] border-[18px] border-[#e9efff]" aria-hidden="true" />
            <ExtensionPreview />
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto grid max-w-7xl divide-y divide-line px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">
            {features.map(({ icon: Icon, title, copy }) => (
              <article className="px-0 py-9 first:pl-0 md:px-8 md:py-12 md:first:pl-0 md:last:pr-0" key={title}>
                <Icon className="mb-5 text-data" size={25} strokeWidth={2.2} />
                <h2 className="font-display text-2xl font-bold tracking-[-0.045em]">{title}</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-32" id="install">
          <div className="grid gap-14 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-data">
                Three steps
              </p>
              <h2 className="mt-4 max-w-sm font-display text-5xl font-black uppercase leading-[0.92] tracking-[-0.06em] sm:text-6xl">
                Download. Load. Analyze.
              </h2>
              <p className="mt-6 max-w-md leading-7 text-muted">
                The extension runs locally in Chrome. Its connected Apps Script sends product rows
                to the project Google Sheet.
              </p>
            </div>

            <ol className="divide-y divide-line border-y border-line">
              {steps.map((step, index) => (
                <li className="grid gap-3 py-7 sm:grid-cols-[72px_1fr] sm:gap-6" key={step.label}>
                  <span className="font-mono text-sm font-bold text-data">0{index + 1}</span>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                      {step.label}
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">{step.title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-5 pb-8 sm:px-8 lg:px-10">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px_10px_32px_10px] bg-ink px-6 py-16 text-white sm:px-12 lg:px-16 lg:py-20">
            <div className="absolute right-0 top-0 font-display text-[14rem] font-black leading-none text-white/[0.035]" aria-hidden="true">
              50
            </div>
            <div className="relative z-10 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
              <div>
                <PackageOpen className="mb-6 text-signal" size={34} />
                <h2 className="max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.055em] sm:text-6xl">
                  Your next product shortlist starts here.
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-[#b9ccc3]">
                  Download the ZIP, extract it, and load the folder in Chrome Developer mode.
                </p>
              </div>
              <DownloadButton />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>Amazon Product Analysis · Built for focused category research.</p>
        <a
          className="inline-flex items-center gap-1.5 font-bold text-ink hover:text-data focus-visible:outline-2 focus-visible:outline-data"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub <ExternalLink size={13} />
        </a>
      </footer>
    </div>
  );
}
