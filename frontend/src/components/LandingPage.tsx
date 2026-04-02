"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Menu, Play, X } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { fetchMe } from "@/lib/api-client";
import { LANDING_FAQ } from "@/lib/landingContent";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

/* ── Constants ─────────────────────────────────────────────── */

const LANDING_PDF_INPUT_ID = "landing-pdf-input";
const YOUTUBE_VIDEO_ID = "B3aR-qLvCFo";

/** Sections linked by the fixed side nav (order = top to bottom). */
const LANDING_SECTION_ANCHORS = [
  { id: "hero", label: "Home" },
  { id: "walkthrough", label: "Demo" },
  { id: "compare", label: "Pricing" },
  { id: "features", label: "Features" },
  { id: "faq", label: "FAQ" },
  { id: "cta", label: "Start" },
] as const;

function isPdfFile(f: File): boolean {
  return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
}

/* ── YouTube embed (poster → iframe on click) ─────────────── */

function HeroYouTubeEmbed() {
  const [playing, setPlaying] = useState(false);
  const posterUrl = `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg`;

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`}
        title="PlanSync walkthrough"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group absolute inset-0 flex items-center justify-center"
      aria-label="Play walkthrough video"
    >
      <Image
        src={posterUrl}
        alt="PlanSync walkthrough video thumbnail"
        fill
        className="object-cover"
        unoptimized
      />
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--landing-cta)] shadow-xl shadow-blue-600/30 transition group-hover:scale-110 group-hover:bg-[var(--landing-cta-bright)] sm:h-20 sm:w-20">
        <Play className="h-6 w-6 translate-x-0.5 text-white sm:h-8 sm:w-8" fill="white" />
      </div>
      <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/30" />
    </button>
  );
}

/* ── AnimateIn ─────────────────────────────────────────────── */

function AnimateIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const style = reducedMotion
    ? { opacity: 1, transform: "none" as const }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(20px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/* ── Feature data ──────────────────────────────────────────── */

const FREE_FEATURES = [
  "Open any PDF",
  "Calibrate scale",
  "Measure & markup",
  "Annotate drawings",
  "Export marked PDF",
  "Works offline",
  "Files never leave device",
];

const PRO_FEATURES = [
  "Cloud storage 20GB",
  "Unlimited projects",
  "Team collaboration",
  "Issues on drawings",
  "RFIs workflow",
  "Quantity takeoff",
  "Version history",
  "AI drawing summary",
  "Priority support",
];

/* ── Side section nav (timeline + scroll spy) ──────────────── */

function LandingSideNav() {
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<string>(LANDING_SECTION_ANCHORS[0].id);

  useEffect(() => {
    const ids = LANDING_SECTION_ANCHORS.map((s) => s.id);
    const update = () => {
      const marker = window.scrollY + Math.min(168, window.innerHeight * 0.22);
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function goTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="On this page"
      className="pointer-events-none fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 md:block"
    >
      <div className="pointer-events-auto pr-5 lg:pr-8">
        <div className="relative inline-flex flex-col items-end">
          {/* Rail — passes through dot centers */}
          <div
            className="pointer-events-none absolute right-[9px] top-4 bottom-4 w-px rounded-full bg-gradient-to-b from-slate-200/0 via-slate-300/80 to-slate-200/0"
            aria-hidden
          />

          <ul className="relative flex flex-col gap-5">
            {LANDING_SECTION_ANCHORS.map(({ id, label }) => {
              const isActive = active === id;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      goTo(id);
                    }}
                    className={`group flex items-center gap-3 rounded-full py-1.5 pl-4 pr-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)] focus-visible:ring-offset-2 ${
                      isActive
                        ? "bg-white/70 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm"
                        : "hover:bg-white/50"
                    }`}
                    aria-label={`Go to ${label}`}
                    aria-current={isActive ? "location" : undefined}
                  >
                    <span
                      className={`max-w-[6.5rem] text-right text-[13px] font-semibold leading-snug tracking-tight sm:max-w-[9rem] ${
                        isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"
                      }`}
                    >
                      {label}
                    </span>

                    <span className="relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                      <span
                        className={`absolute inset-0 rounded-full transition-[box-shadow,background-color] ${
                          isActive
                            ? "bg-white shadow-sm ring-2 ring-[var(--landing-cta)]/35"
                            : "bg-white/90 ring-[1.5px] ring-slate-200/90 group-hover:ring-slate-300"
                        }`}
                        aria-hidden
                      />
                      <span
                        className={`relative rounded-full transition-all ${
                          isActive
                            ? "h-2 w-2 bg-[var(--landing-cta)]"
                            : "h-1.5 w-1.5 bg-slate-300 group-hover:bg-slate-400"
                        }`}
                      />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}

/* ── Browser Mockup ────────────────────────────────────────── */

function BrowserMockup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.04] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100/90 bg-gradient-to-b from-slate-50 to-slate-50/80 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-slate-300" />
          <div className="h-3 w-3 rounded-full bg-slate-300" />
          <div className="h-3 w-3 rounded-full bg-slate-300" />
        </div>
        <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md bg-slate-100 text-[11px] text-slate-400">
          plansync.dev
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export function LandingPage() {
  const router = useRouter();
  const setPdf = useViewerStore((s) => s.setPdf);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const { data: me } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  const blockLocalPdf = meHasProWorkspace(me ?? null);
  const isLoggedIn = !!me?.user;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleFileChange = useCallback(
    (files: FileList | null) => {
      if (blockLocalPdf || !files) return;
      const pdf = Array.from(files).find(isPdfFile);
      if (!pdf) return;
      setMobileOpen(false);
      const url = URL.createObjectURL(pdf);
      setPdf(url, pdf.name, pdf.size);
      router.push("/viewer");
    },
    [blockLocalPdf, setPdf, router, setMobileOpen],
  );

  function openFreePdf() {
    if (blockLocalPdf) {
      router.push("/projects");
      return;
    }
    pdfInputRef.current?.click();
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen landing-atmosphere">
      {/* Hidden file input */}
      <input
        ref={pdfInputRef}
        id={LANDING_PDF_INPUT_ID}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => {
          handleFileChange(e.target.files);
          e.target.value = "";
        }}
      />

      {/* ═══════════ SECTION 1 — NAV ═══════════ */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-slate-200/80 bg-white/95 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md"
            : "border-b border-transparent bg-white/70 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
            <span className="text-base font-bold text-slate-900">PlanSync</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#walkthrough"
              className="text-sm text-slate-600 transition hover:text-slate-900"
            >
              Watch demo
            </a>
            <a href="#features" className="text-sm text-slate-600 transition hover:text-slate-900">
              Features
            </a>
            <a href="#compare" className="text-sm text-slate-600 transition hover:text-slate-900">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-slate-600 transition hover:text-slate-900">
              FAQ
            </a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            {isLoggedIn ? (
              <Link
                href="/projects"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Sign In
              </Link>
            )}
            <button
              type="button"
              onClick={openFreePdf}
              className="btn-shine relative overflow-hidden rounded-full bg-[var(--landing-cta)] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
            >
              Start Free &rarr;
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-slate-100/90 bg-white/95 px-6 pb-6 pt-4 backdrop-blur-md md:hidden">
            <div className="flex flex-col gap-4">
              <a
                href="#walkthrough"
                className="text-sm text-slate-600"
                onClick={() => setMobileOpen(false)}
              >
                Watch demo
              </a>
              <a
                href="#features"
                className="text-sm text-slate-600"
                onClick={() => setMobileOpen(false)}
              >
                Features
              </a>
              <a
                href="#compare"
                className="text-sm text-slate-600"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="text-sm text-slate-600"
                onClick={() => setMobileOpen(false)}
              >
                FAQ
              </a>
              <hr className="border-slate-100" />
              {isLoggedIn ? (
                <Link href="/projects" className="text-sm font-medium text-slate-700">
                  Dashboard
                </Link>
              ) : (
                <Link href="/sign-in" className="text-sm font-medium text-slate-700">
                  Sign In
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openFreePdf();
                }}
                className="btn-shine relative overflow-hidden rounded-full bg-[var(--landing-cta)] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
              >
                Start Free &rarr;
              </button>
            </div>
          </div>
        )}
      </nav>

      <LandingSideNav />

      <main>
        {/* ═══════════ SECTION 2 — HERO ═══════════ */}
        <section
          id="hero"
          className="landing-dots relative scroll-mt-20 overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-48 lg:pb-32"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-slate-50/30"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-24 top-16 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.22),transparent_68%)] blur-2xl sm:-left-32 sm:h-[28rem] sm:w-[28rem]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-20 top-32 h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_70%)] blur-2xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <AnimateIn className="mx-auto max-w-3xl text-center">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--landing-cta)]" aria-hidden />
                Plans, issues &amp; RFIs in one workspace
              </p>
              <h1 className="text-4xl font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
                The <span className="text-gradient-blue">construction drawing</span> workspace your
                team actually uses
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:mt-8 sm:text-xl">
                Stop working off the wrong revision. PlanSync keeps every drawing, issue, and RFI in
                one place — free to start, no signup needed.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={openFreePdf}
                  className="btn-shine relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[var(--landing-cta)] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-[var(--landing-cta-bright)] hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98]"
                >
                  Open a PDF Free <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-7 py-3.5 text-base font-semibold text-slate-800 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white"
                >
                  Start Pro Trial
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>No installation</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>No credit card</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>Works in your browser</span>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ═══════════ WALKTHROUGH VIDEO ═══════════ */}
        <section
          id="walkthrough"
          className="scroll-mt-20 border-t border-slate-200/60 bg-white/90 py-20 backdrop-blur-sm sm:py-28"
        >
          <div className="mx-auto max-w-4xl px-6">
            <AnimateIn className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--landing-cta)]">
                Walkthrough
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                See PlanSync in action
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-slate-500">
                Watch a 2-minute overview — open a PDF, calibrate, measure, and mark up. No editing,
                just the real workflow.
              </p>
            </AnimateIn>

            <AnimateIn className="mx-auto mt-12 max-w-3xl" delay={150}>
              <BrowserMockup>
                <div className="relative aspect-video bg-black">
                  <HeroYouTubeEmbed />
                </div>
              </BrowserMockup>
              <p className="mt-4 text-center text-xs text-slate-400">
                <a
                  href={`https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-slate-600"
                >
                  Open on YouTube &rarr;
                </a>
              </p>
            </AnimateIn>

            {/* Quick preview GIF */}
            <AnimateIn className="mx-auto mt-16 max-w-3xl" delay={200}>
              <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
                Quick preview
              </p>
              <h3 className="mt-3 text-center text-xl font-bold tracking-tight text-slate-900">
                The viewer in motion
              </h3>
              <p className="mx-auto mt-3 max-w-lg text-center text-sm text-slate-500">
                A short, silent loop of the real workflow — open a PDF, calibrate scale, measure,
                and export. No sound needed.
              </p>
              <div className="mt-8">
                <BrowserMockup>
                  <div className="relative aspect-video bg-slate-900">
                    <Image
                      src="/images/cta/gifcta.gif"
                      alt="PlanSync viewer demo — open PDF, calibrate, measure, markup"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </BrowserMockup>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ═══════════ SECTION 3 — FREE vs PRO ═══════════ */}
        <section
          className="scroll-mt-20 border-t border-slate-200/50 bg-white/70 py-24 backdrop-blur-[2px] sm:py-32"
          id="compare"
        >
          <div className="mx-auto max-w-4xl px-6">
            <AnimateIn className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Free to start. Pro when you&apos;re ready.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
                Everything you need to view construction PDFs — upgrade when your team needs
                collaboration.
              </p>
            </AnimateIn>

            <div className="mt-16 grid gap-8 md:grid-cols-2">
              {/* Free */}
              <AnimateIn delay={100}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-8 shadow-[var(--enterprise-shadow-card)]">
                  <div className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Free
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-900">$0</div>
                  <p className="mt-1 text-sm text-slate-500">No signup needed</p>
                  <p className="mt-1 text-sm text-slate-500">Local PDF viewer</p>

                  <ul className="mt-8 flex flex-1 flex-col gap-3">
                    {FREE_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                          strokeWidth={2.5}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={openFreePdf}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Open PDF Free <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </AnimateIn>

              {/* Pro */}
              <AnimateIn delay={200}>
                <div className="relative flex h-full flex-col rounded-2xl border-2 border-[var(--landing-cta)] bg-white p-8 shadow-[0_20px_50px_-20px_rgba(37,99,235,0.25),var(--enterprise-shadow-card)]">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--landing-cta)] px-4 py-1 text-xs font-semibold text-white shadow-md shadow-blue-600/30">
                    Most Popular
                  </div>

                  <div className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--landing-cta)]">
                    Pro
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-900">
                    $19<span className="text-lg font-normal text-slate-500">/month</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Everything in Free +</p>

                  <ul className="mt-8 flex flex-1 flex-col gap-3">
                    {PRO_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
                          strokeWidth={2.5}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/sign-in"
                    className="btn-shine relative mt-8 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[var(--landing-cta)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--landing-cta-bright)]"
                  >
                    Start 14-day Trial <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </AnimateIn>
            </div>
          </div>
        </section>

        {/* ═══════════ SECTION 4 — FEATURES SHOWCASE ═══════════ */}
        <section
          className="scroll-mt-20 border-t border-slate-200/50 bg-gradient-to-b from-slate-50/90 to-slate-100/30 py-24 sm:py-32"
          id="features"
        >
          <div className="mx-auto max-w-6xl px-6">
            <AnimateIn className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Built for construction professionals
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
                Every tool you need to manage drawings, issues, and RFIs — in one platform.
              </p>
            </AnimateIn>

            {/* Feature 1 — Viewer (image left, text right) */}
            <AnimateIn className="mt-20 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <BrowserMockup>
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src="/images/measure.png"
                    alt="PlanSync free PDF viewer with measurement tools"
                    fill
                    className="object-cover"
                  />
                </div>
              </BrowserMockup>
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  The most powerful free plan viewer
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-500">
                  Open any PDF instantly in your browser. Calibrate scale, measure distances and
                  areas, annotate, and export — all locally. No files leave your device. Ever.
                </p>
                <button
                  type="button"
                  onClick={openFreePdf}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Try the free viewer <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </AnimateIn>

            {/* Feature 2 — Issues (text left, image right) */}
            <AnimateIn className="mt-24 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="order-2 lg:order-1">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Pin issues directly on the drawing
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-500">
                  Click anywhere on a plan to drop an issue pin. Assign it, set priority, attach
                  photos. Your team gets notified instantly. Track from Open to Resolved without
                  leaving PlanSync.
                </p>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  See how issues work <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src="/images/markup.png"
                    alt="PlanSync issue pins on a construction drawing"
                    fill
                    className="object-cover"
                  />
                </div>
              </BrowserMockup>
            </AnimateIn>

            {/* Feature 3 — RFIs (image left, text right) */}
            <AnimateIn className="mt-24 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">RFIs</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                    3 Open
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { num: "001", title: "Wall thickness?", status: "Open", color: "bg-red-500" },
                    {
                      num: "002",
                      title: "Door spec change",
                      status: "Answered",
                      color: "bg-green-500",
                    },
                    {
                      num: "003",
                      title: "Rebar spacing",
                      status: "Pending",
                      color: "bg-yellow-500",
                    },
                  ].map((rfi) => (
                    <div
                      key={rfi.num}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
                    >
                      <span className="text-xs font-mono text-slate-400">#{rfi.num}</span>
                      <span className="flex-1 text-sm text-slate-700">{rfi.title}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${rfi.color}`} />
                        <span className="text-xs text-slate-500">{rfi.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Formal RFIs in seconds
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-500">
                  Convert any issue into a formal RFI. Track responses, attach drawings, and close
                  them out — all in one place. No more RFIs buried in email threads.
                </p>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Start Pro Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </AnimateIn>

            {/* Feature 4 — Takeoff (text left, image right) */}
            <AnimateIn className="mt-24 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="order-2 lg:order-1">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Measure once. Take off everywhere.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-500">
                  Draw measurement zones directly on your drawings. PlanSync calculates quantities
                  automatically. Export to CSV or PDF in one click.
                </p>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Start Pro Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src="/images/calibrate.png"
                    alt="PlanSync quantity takeoff with colored zones on a construction drawing"
                    fill
                    className="object-cover"
                  />
                </div>
              </BrowserMockup>
            </AnimateIn>
          </div>
        </section>

        {/* ═══════════ SECTION 5 — FAQ ═══════════ */}
        <section
          className="scroll-mt-20 border-t border-slate-200/50 bg-[var(--enterprise-bg)] py-24 sm:py-32"
          id="faq"
        >
          <div className="mx-auto max-w-3xl px-6">
            <AnimateIn className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Frequently asked questions
              </h2>
            </AnimateIn>

            <div className="mt-14">
              {LANDING_FAQ.map((item, i) => (
                <AnimateIn key={item.q} delay={i * 50}>
                  <details className="group border-b border-slate-200 last:border-0">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[15px] font-semibold text-slate-900 transition-colors hover:text-[var(--landing-cta)] sm:py-6 [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <p className="pb-5 pr-8 text-sm leading-relaxed text-slate-500 sm:pb-6">
                      {item.a}
                    </p>
                  </details>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ SECTION 6 — FINAL CTA ═══════════ */}
        <section id="cta" className="relative scroll-mt-20 overflow-hidden bg-[#0F172A]">
          {/* Grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: "60px 60px",
            }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
            <AnimateIn>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Start for free today
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-slate-400">
                Open a PDF in seconds — no signup needed.
                <br />
                Upgrade to Pro when your team is ready.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={openFreePdf}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]"
                >
                  Open PDF Free <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-transparent px-7 py-3.5 text-base font-semibold text-white transition hover:border-slate-500 hover:bg-white/5"
                >
                  Start Pro Trial
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>No installation</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>No credit card</span>
              </div>
            </AnimateIn>
          </div>
        </section>
      </main>

      {/* ═══════════ SECTION 7 — FOOTER ═══════════ */}
      <footer className="bg-[#0F172A] text-white">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-8 sm:pt-20">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0"
                  unoptimized
                />
                <span className="text-base font-bold">PlanSync</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                The construction drawing workspace for teams who can&apos;t afford to work off the
                wrong information.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Product
              </h4>
              <ul className="mt-4 flex flex-col gap-3">
                <li>
                  <a
                    href="#features"
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a href="#compare" className="text-sm text-slate-300 transition hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={openFreePdf}
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    Free Viewer
                  </button>
                </li>
                <li>
                  <span className="text-sm text-slate-500">Changelog</span>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Company
              </h4>
              <ul className="mt-4 flex flex-col gap-3">
                <li>
                  <span className="text-sm text-slate-500">About</span>
                </li>
                <li>
                  <span className="text-sm text-slate-500">Blog</span>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/company/plansyncdev/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Legal
              </h4>
              <ul className="mt-4 flex flex-col gap-3">
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <span className="text-sm text-slate-500">Terms of Service</span>
                </li>
                <li>
                  <span className="text-sm text-slate-500">Cookie Policy</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
            <p className="text-xs text-slate-500" suppressHydrationWarning>
              &copy; {new Date().getFullYear()} PlanSync. All rights reserved.
            </p>
            <button
              type="button"
              onClick={openFreePdf}
              className="inline-flex items-center gap-2 text-xs font-medium text-sky-400 transition hover:text-sky-300"
            >
              Open public PDF viewer <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
