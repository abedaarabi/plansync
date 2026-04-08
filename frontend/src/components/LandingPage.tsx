"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  Hammer,
  LayoutDashboard,
  MapPin,
  Menu,
  Monitor,
  Play,
  Ruler,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { fetchMe } from "@/lib/api-client";
import {
  LANDING_FAQ,
  LANDING_FEATURE_BULLETS,
  LANDING_HOW_IT_WORKS,
  LANDING_HOW_IT_WORKS_SECTION,
  LANDING_SOLUTIONS,
  LANDING_SOLUTIONS_SECTION,
} from "@/lib/landingContent";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";

/* ── Constants ─────────────────────────────────────────────── */

const YOUTUBE_WALKTHROUGH_ID = "B3aR-qLvCFo";
const YOUTUBE_HERO_DEMO_ID = "iaMkrdq1kko";

/* ── YouTube embed (poster → iframe on click) ─────────────── */

function YouTubePosterEmbed({
  videoId,
  title,
  playAriaLabel,
  posterAlt,
  /** Above-the-fold hero: no lazy + hints LCP (walkthrough stays lazy). */
  posterPriority = false,
}: {
  videoId: string;
  title: string;
  playAriaLabel: string;
  posterAlt: string;
  posterPriority?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const posterUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group absolute inset-0 flex items-center justify-center"
      aria-label={playAriaLabel}
    >
      <Image
        src={posterUrl}
        alt={posterAlt}
        fill
        className="object-cover"
        priority={posterPriority}
        loading={posterPriority ? undefined : "lazy"}
        fetchPriority={posterPriority ? "high" : undefined}
        sizes="(max-width: 1024px) 100vw, 50vw"
        unoptimized
      />
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--landing-cta)] shadow-xl shadow-blue-600/30 transition group-hover:scale-110 group-hover:bg-[var(--landing-cta-bright)] sm:h-20 sm:w-20">
        <Play className="h-6 w-6 translate-x-0.5 text-white sm:h-8 sm:w-8" fill="white" />
      </div>
      <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/30" />
    </button>
  );
}

function HeroYouTubeEmbed() {
  return (
    <YouTubePosterEmbed
      videoId={YOUTUBE_WALKTHROUGH_ID}
      title="PlanSync walkthrough"
      playAriaLabel="Play walkthrough video"
      posterAlt="PlanSync walkthrough video thumbnail"
    />
  );
}

/** YouTube demo — poster loads with the hero (no observer flash); iframe only after play. */
function LandingHeroDemoVideo() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative aspect-video overflow-hidden bg-slate-900">
      {reducedMotion ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800 px-4 text-center text-[12px] leading-relaxed text-slate-400">
          <span>Plan viewer demo (animation reduced for your motion settings)</span>
          <a
            href={`https://youtu.be/${YOUTUBE_HERO_DEMO_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400 underline decoration-sky-400/50 underline-offset-2 transition hover:text-sky-300"
          >
            Watch on YouTube
          </a>
        </div>
      ) : (
        <YouTubePosterEmbed
          videoId={YOUTUBE_HERO_DEMO_ID}
          title="PlanSync viewer demo — open PDF, calibrate, measure, markup"
          playAriaLabel="Play PlanSync viewer demo video"
          posterAlt="PlanSync viewer demo video thumbnail"
          posterPriority
        />
      )}
    </div>
  );
}

/* ── AnimateIn ─────────────────────────────────────────────── */

function AnimateIn({
  children,
  className = "",
  delay = 0,
  /** Above-the-fold: no opacity-0 flash (better LCP / no “blank hero”). */
  instant = false,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  instant?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(() => instant || reducedMotion);

  useEffect(() => {
    if (instant || reducedMotion) {
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
  }, [instant, reducedMotion]);

  const style =
    instant || reducedMotion
      ? { opacity: 1, transform: "none" as const }
      : {
          opacity: visible ? 1 : 0,
          transform: visible ? "none" : "translateY(20px)",
          transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        };

  return (
    <div ref={ref} id={id} className={className} style={style}>
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

/* ── Browser Mockup ────────────────────────────────────────── */

const SOLUTION_ICONS = {
  viewer: Monitor,
  issues: MapPin,
  rfis: ClipboardList,
  "om-handover": ClipboardCheck,
  "om-assets": Building2,
  "om-maintenance": Wrench,
  "om-work-orders": Hammer,
  "om-inspections": ClipboardCheck,
  "om-tenant-portal": Users,
  "om-fm-dashboard": LayoutDashboard,
  takeoff: Ruler,
} as const;

function SolutionsDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const solutionGroups = [
    {
      title: "Core",
      items: LANDING_SOLUTIONS.filter((s) =>
        ["viewer", "issues", "rfis", "takeoff"].includes(s.slug),
      ),
    },
    {
      title: "O&M + FM",
      items: LANDING_SOLUTIONS.filter((s) => s.slug.startsWith("om-")),
    },
  ] as const;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-0.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        Solutions
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(calc(100vw-2rem),54rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/[0.05]"
        >
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {solutionGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-slate-200/70 bg-slate-50/35 p-2"
              >
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {group.title}
                </p>
                <div className="mt-1 space-y-0.5">
                  {group.items.map((s) => {
                    const Icon = SOLUTION_ICONS[s.slug];
                    return (
                      <a
                        key={s.slug}
                        href={`#solution-${s.slug}`}
                        role="menuitem"
                        className="group flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition duration-150 hover:-translate-y-px hover:border-slate-200/80 hover:bg-white"
                        onClick={() => setOpen(false)}
                      >
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)] transition duration-150 group-hover:bg-[color-mix(in_srgb,var(--landing-cta)_16%,white)] group-hover:text-[var(--landing-cta-bright)]"
                          aria-hidden
                        >
                          <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold tracking-tight text-slate-900 transition group-hover:text-slate-950">
                            {s.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500 transition group-hover:text-slate-600">
                            {s.description}
                          </span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BrowserMockup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--enterprise-shadow-card)] ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100/95 bg-linear-to-b from-slate-50 to-white px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/95 shadow-sm ring-1 ring-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/95 shadow-sm ring-1 ring-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/95 shadow-sm ring-1 ring-black/10" />
        </div>
        <div className="mx-auto flex h-7 min-w-0 max-w-[min(16rem,72%)] flex-1 items-center justify-center rounded-lg bg-slate-100/90 px-3 text-[11px] font-medium tracking-tight text-slate-500 ring-1 ring-slate-200/80">
          <span className="truncate">plansync.dev</span>
        </div>
        <span className="w-[52px] shrink-0" aria-hidden />
      </div>
      {children}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export function LandingPage() {
  const router = useRouter();

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

  function goToFreeViewer() {
    if (blockLocalPdf) {
      router.push("/projects");
      return;
    }
    router.push("/viewer");
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen landing-atmosphere">
      {/* ═══════════ SECTION 1 — NAV ═══════════ */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background,box-shadow,border-color] duration-300 ${
          scrolled
            ? "border-slate-200/90 bg-white/98 shadow-[0_10px_36px_-14px_rgba(15,23,42,0.055)] backdrop-blur-md"
            : "border-slate-200/70 bg-white/96 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="PlanSync home">
            <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
            <span className="text-base font-bold tracking-tight text-slate-900">
              Plan<span className="text-blue-600">Sync</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            <SolutionsDropdown />
            <a
              href="#walkthrough"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Watch demo
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Features
            </a>
            <a
              href="#compare"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
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
              onClick={goToFreeViewer}
              className="btn-shine relative overflow-hidden rounded-full bg-[var(--landing-cta)] px-5 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_35%,transparent)] transition hover:bg-[var(--landing-cta-bright)] hover:ring-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)]"
            >
              Start Free &rarr;
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="text-slate-800 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-slate-200/80 bg-white px-6 pb-6 pt-4 md:hidden">
            <div className="flex flex-col gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Solutions
              </p>
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
                {LANDING_SOLUTIONS.map((s) => (
                  <a
                    key={s.slug}
                    href={`#solution-${s.slug}`}
                    className="text-sm font-medium text-slate-700"
                    onClick={() => setMobileOpen(false)}
                  >
                    {s.title}
                  </a>
                ))}
              </div>
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
                  goToFreeViewer();
                }}
                className="btn-shine relative overflow-hidden rounded-full bg-[var(--landing-cta)] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
              >
                Start Free &rarr;
              </button>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* ═══════════ SECTION 2 — HERO (construction SaaS) ═══════════ */}
        <section
          id="hero"
          className="relative isolate min-h-dvh scroll-mt-20 overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20 lg:flex lg:items-center lg:py-24 xl:py-28"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <Image
              src="/images/cta/CTA-constraction-hero.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-[center_36%]"
              priority
              quality={75}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.3)_0%,rgba(15,23,42,0.52)_38%,rgba(15,23,42,0.68)_62%,rgba(2,6,23,0.88)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_45%,rgba(37,99,235,0.1)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.22),inset_0_-100px_150px_rgba(0,0,0,0.42)]"
            aria-hidden
          />

          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: "60px 60px",
            }}
            aria-hidden
          />

          <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
            <AnimateIn instant>
              <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-14">
                <div className="text-center lg:text-left">
                  <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--landing-cta)_35%,transparent)] bg-[color-mix(in_srgb,var(--landing-cta)_12%,rgba(15,23,42,0.55))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100 shadow-sm backdrop-blur-md lg:inline-flex">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--landing-cta)]"
                      aria-hidden
                    />
                    Plans · issues · RFIs · one system
                  </p>
                  <h1 className="text-balance text-4xl font-bold leading-[1.12] tracking-tight text-blue-50 sm:text-5xl lg:text-[52px] lg:leading-[1.06]">
                    Plans, issues, and RFIs —{" "}
                    <span className="text-blue-200 [text-shadow:0_1px_28px_rgba(37,99,235,0.45)]">
                      one source of truth
                    </span>{" "}
                    for your team
                  </h1>
                  <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-blue-100/88 sm:mt-8 sm:text-xl lg:mx-0">
                    Everyone works from the same drawings. Field issues and formal RFIs stay tied to
                    the plan — not buried in email. Start free in your browser; upgrade when your
                    team needs the cloud.
                  </p>

                  <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start">
                    <button
                      type="button"
                      onClick={goToFreeViewer}
                      className="btn-shine relative inline-flex min-h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--landing-cta)] px-8 py-3.5 text-base font-semibold text-[var(--landing-cta-text)] shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)] transition hover:bg-[var(--landing-cta-bright)] hover:shadow-xl hover:shadow-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98] sm:flex-none sm:px-9"
                    >
                      Open free viewer <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                    <Link
                      href="/sign-in"
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white/90 bg-white/[0.07] px-8 py-3.5 text-base font-semibold text-white shadow-sm backdrop-blur-sm transition hover:border-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:flex-none sm:px-9"
                    >
                      Start Pro Trial
                    </Link>
                  </div>

                  <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-blue-200/75 lg:justify-start">
                    <span>No installation</span>
                    <span className="hidden text-blue-400/45 sm:inline" aria-hidden>
                      &middot;
                    </span>
                    <span>No credit card</span>
                    <span className="hidden text-blue-400/45 sm:inline" aria-hidden>
                      &middot;
                    </span>
                    <span>Works in your browser</span>
                  </p>
                </div>

                <div className="mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
                  <BrowserMockup className="shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
                    <LandingHeroDemoVideo />
                  </BrowserMockup>
                  <p className="mt-3 text-center text-xs leading-relaxed text-blue-200/75 lg:text-left">
                    The viewer in motion — open a PDF, calibrate scale, measure, and mark up. Same
                    workflow your team uses in Pro.
                  </p>
                </div>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ═══════════ WALKTHROUGH VIDEO ═══════════ */}
        <section
          id="walkthrough"
          className="landing-band-white relative scroll-mt-20 border-t border-slate-200/70 py-24 sm:py-32"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.45] landing-dots"
            aria-hidden
          />
          <div className="relative mx-auto max-w-5xl px-6">
            <AnimateIn className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                Walkthrough
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                See PlanSync in action
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Watch a 2-minute overview — open a PDF, calibrate, measure, and mark up. No editing,
                just the real workflow.
              </p>
            </AnimateIn>

            <AnimateIn className="mx-auto mt-14 max-w-4xl" delay={150}>
              <BrowserMockup>
                <div className="relative aspect-video bg-black">
                  <HeroYouTubeEmbed />
                </div>
              </BrowserMockup>
              <p className="mt-4 text-center text-xs text-slate-500">
                <a
                  href={`https://www.youtube.com/watch?v=${YOUTUBE_WALKTHROUGH_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-[var(--landing-cta)] hover:decoration-[color-mix(in_srgb,var(--landing-cta)_45%,transparent)]"
                >
                  Open on YouTube &rarr;
                </a>
              </p>
            </AnimateIn>
          </div>
        </section>

        {/* ═══════════ HOW IT WORKS ═══════════ */}
        <section
          id="how-it-works"
          className="relative scroll-mt-20 border-t border-slate-200/70 bg-slate-50/80 py-24 sm:py-32"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4] landing-dots"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <AnimateIn className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                {LANDING_HOW_IT_WORKS_SECTION.eyebrow}
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {LANDING_HOW_IT_WORKS_SECTION.title}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {LANDING_HOW_IT_WORKS_SECTION.description}
              </p>
            </AnimateIn>

            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {LANDING_HOW_IT_WORKS.map((step, i) => (
                <AnimateIn key={step.title} delay={60 + i * 50}>
                  <div className="relative flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--landing-cta)_12%,white)] text-sm font-bold text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_25%,transparent)]"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ SOLUTIONS (summary) ═══════════ */}
        <section
          id="solutions"
          className="relative scroll-mt-20 border-t border-slate-200/70 bg-white py-24 sm:py-32"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] landing-dots"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <AnimateIn className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                {LANDING_SOLUTIONS_SECTION.eyebrow}
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {LANDING_SOLUTIONS_SECTION.title}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {LANDING_SOLUTIONS_SECTION.description}
              </p>
            </AnimateIn>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {LANDING_SOLUTIONS.map((s, i) => {
                const Icon = SOLUTION_ICONS[s.slug];
                return (
                  <AnimateIn key={s.slug} delay={80 + i * 60}>
                    <div
                      id={`solution-${s.slug}`}
                      className="flex h-full scroll-mt-24 flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[var(--enterprise-shadow-card)] transition hover:border-slate-200"
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)]"
                        aria-hidden
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
                        {s.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
                      <ul className="mt-4 flex flex-1 flex-col gap-2">
                        {s.bullets.map((b) => (
                          <li key={b} className="flex gap-2 text-sm leading-snug text-slate-600">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_70%,#64748b)]"
                              strokeWidth={2.5}
                              aria-hidden
                            />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <a
                        href={`#feature-${s.slug}`}
                        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                      >
                        Learn more <ArrowRight className="h-4 w-4 shrink-0" />
                      </a>
                    </div>
                  </AnimateIn>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════ SECTION 3 — FREE vs PRO ═══════════ */}
        <section
          className="landing-band-pricing relative scroll-mt-20 border-t border-slate-200/60 py-24 sm:py-32"
          id="compare"
        >
          <div className="relative mx-auto max-w-5xl px-6">
            <AnimateIn className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                Pricing
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Free to start. Pro when you&apos;re ready.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Everything you need to view construction PDFs — upgrade when your team needs
                collaboration.
              </p>
            </AnimateIn>

            <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:gap-10">
              {/* Free */}
              <AnimateIn delay={100}>
                <div className="flex h-full flex-col rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[var(--enterprise-shadow-card)] sm:p-9">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
                      aria-hidden
                    >
                      <Monitor className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Free
                      </div>
                      <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                        $0
                      </div>
                      <p className="mt-1 text-sm text-slate-600">No signup needed</p>
                      <p className="mt-0.5 text-sm text-slate-500">Local PDF viewer</p>
                    </div>
                  </div>

                  <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                    {FREE_FEATURES.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-3 rounded-xl px-1 py-1.5 text-sm text-slate-700"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                          strokeWidth={2.5}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={goToFreeViewer}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    Open free viewer <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </AnimateIn>

              {/* Pro */}
              <AnimateIn delay={200}>
                <div className="relative flex h-full flex-col rounded-3xl border-2 border-[var(--landing-cta)] bg-white p-8 shadow-[0_28px_56px_-24px_rgba(37,99,235,0.11),var(--enterprise-shadow-card)] ring-4 ring-[color-mix(in_srgb,var(--landing-cta)_12%,transparent)] sm:p-9">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--landing-cta)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25">
                    Most Popular
                  </div>

                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--landing-cta)_10%,white)] text-[var(--landing-cta)] ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_22%,transparent)]"
                      aria-hidden
                    >
                      <Cloud className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-widest text-[var(--landing-cta)]">
                        Pro
                      </div>
                      <div className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                        $49<span className="text-lg font-normal text-slate-500">/month</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">8 uses</p>
                      <p className="mt-0.5 text-sm text-slate-500">Everything in Free +</p>
                    </div>
                  </div>

                  <ul className="mt-8 flex flex-1 flex-col gap-2.5">
                    {PRO_FEATURES.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-3 rounded-xl px-1 py-1.5 text-sm text-slate-700"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--landing-cta)]"
                          strokeWidth={2.5}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/sign-in"
                    className="btn-shine relative mt-8 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--landing-cta)] py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
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
          className="landing-band-features relative scroll-mt-20 border-t border-slate-200/60 py-24 sm:py-32"
          id="features"
        >
          <div className="relative mx-auto max-w-6xl px-6">
            <AnimateIn className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                Features
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Built for construction professionals
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Every tool you need to manage drawings, issues, and RFIs — in one platform.
              </p>
            </AnimateIn>

            {/* Feature 1 — Viewer (image left, text right) */}
            <AnimateIn
              id="feature-viewer"
              className="mt-20 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <BrowserMockup>
                <div className="relative aspect-4/3 overflow-hidden">
                  <Image
                    src="/images/measure.png"
                    alt="PlanSync free PDF viewer with measurement tools"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    loading="lazy"
                    quality={78}
                  />
                </div>
              </BrowserMockup>
              <div className="lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  The most powerful free plan viewer
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Open any PDF instantly in your browser. Calibrate scale, measure distances and
                  areas, annotate, and export — all locally. No files leave your device. Ever.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS.viewer.map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={goToFreeViewer}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Try the free viewer <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </AnimateIn>

            {/* Feature 2 — Issues (text left, image right) */}
            <AnimateIn
              id="feature-issues"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Pin issues directly on the drawing
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Click anywhere on a plan to drop an issue pin. Assign it, set priority, attach
                  photos. Your team gets notified instantly. Track from Open to Resolved without
                  leaving PlanSync.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS.issues.map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  See how issues work <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="relative aspect-4/3 overflow-hidden">
                  <Image
                    src="/images/markup.png"
                    alt="PlanSync issue pins on a construction drawing"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    loading="lazy"
                    quality={78}
                  />
                </div>
              </BrowserMockup>
            </AnimateIn>

            {/* Feature 3 — RFIs (image left, text right) */}
            <AnimateIn
              id="feature-rfis"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <BrowserMockup>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-sm font-semibold text-slate-900">RFIs</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 ring-1 ring-blue-100">
                      3 open
                    </span>
                  </div>
                  <div className="mt-4 space-y-2.5">
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
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:border-slate-200 hover:bg-white"
                      >
                        <span className="text-xs font-mono text-slate-400">#{rfi.num}</span>
                        <span className="min-w-0 flex-1 text-sm text-slate-700">{rfi.title}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${rfi.color}`} />
                          <span className="text-xs text-slate-500">{rfi.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMockup>
              <div className="lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Formal RFIs in seconds
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Convert any issue into a formal RFI. Track responses, attach drawings, and close
                  them out — all in one place. No more RFIs buried in email threads.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS.rfis.map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Start Pro Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </AnimateIn>

            {/* Feature 4 — O&M + Handover (text left, image right) */}
            <AnimateIn
              id="feature-om-handover"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Handover data your FM team can use
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Move from project closeout to operations without losing context. PlanSync keeps
                  handover packages, asset records, and recurring operational workflows connected in
                  one system.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS["om-handover"].map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Start Pro Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-sm font-semibold text-slate-900">Handover package</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 ring-1 ring-blue-100">
                      Ready
                    </span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {["Asset register", "O&M manuals", "Inspection templates"].map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm text-slate-700"
                      >
                        <span>{item}</span>
                        <span className="text-xs text-slate-500">Linked</span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMockup>
            </AnimateIn>

            {/* Feature 5 — Assets (image left, text right) */}
            <AnimateIn
              id="feature-om-assets"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <BrowserMockup>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-sm font-semibold text-slate-900">Asset register</span>
                    <span className="text-xs text-slate-500">248 assets</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {["AHU-01", "CHWP-03", "FD-2F-17"].map((asset) => (
                      <div
                        key={asset}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                      >
                        <span className="text-sm text-slate-700">{asset}</span>
                        <span className="text-xs text-slate-500">Documents 4</span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMockup>
              <div className="lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Asset data that stays organized
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Build a maintainable asset register with documents, specifications, and lifecycle
                  context. Teams find the right equipment record quickly when operations begin.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS["om-assets"].map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Explore O&M assets <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </AnimateIn>

            {/* Feature 6 — Maintenance (text left, image right) */}
            <AnimateIn
              id="feature-om-maintenance"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Preventive maintenance made practical
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Schedule recurring maintenance tasks, capture service outcomes, and keep
                  operational records complete from day one of occupancy.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS["om-maintenance"].map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Start maintenance planning <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-sm font-semibold text-slate-900">
                      Maintenance calendar
                    </span>
                    <span className="text-xs text-slate-500">This week 12</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {["Filter replacement", "Pump inspection", "Emergency lighting test"].map(
                      (job) => (
                        <div
                          key={job}
                          className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm text-slate-700"
                        >
                          {job}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </BrowserMockup>
            </AnimateIn>

            {/* Feature 7 — Work Orders (image left, text right) */}
            <AnimateIn
              id="feature-om-work-orders"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <BrowserMockup>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-sm font-semibold text-slate-900">Work orders</span>
                    <span className="text-xs text-slate-500">Open 9</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {["WO-1024 HVAC fault", "WO-1028 Leak check", "WO-1031 Lighting repair"].map(
                      (wo) => (
                        <div
                          key={wo}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm text-slate-700"
                        >
                          <span>{wo}</span>
                          <span className="text-xs text-slate-500">Assigned</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </BrowserMockup>
              <div className="lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Work orders with clear ownership
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Convert maintenance needs into trackable work orders with priorities, assignees,
                  and auditable completion history your team can trust.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS["om-work-orders"].map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Manage work orders <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </AnimateIn>

            {/* Feature 8 — Inspections (text left, image right) */}
            <AnimateIn
              id="feature-om-inspections"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Repeatable inspections across your portfolio
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Use standardized templates, run inspections in the field, and record findings in a
                  structured format that supports long-term compliance.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS["om-inspections"].map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Run inspections <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-sm font-semibold text-slate-900">Inspection runs</span>
                    <span className="text-xs text-slate-500">Due 5</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {["Fire safety monthly", "HVAC quarterly", "Lift compliance"].map((run) => (
                      <div
                        key={run}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm text-slate-700"
                      >
                        <span>{run}</span>
                        <span className="text-xs text-slate-500">Scheduled</span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMockup>
            </AnimateIn>

            {/* Feature 9 — Tenant Portal (image left, text right) */}
            <AnimateIn
              id="feature-om-tenant-portal"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <BrowserMockup>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-sm font-semibold text-slate-900">Tenant requests</span>
                    <span className="text-xs text-slate-500">New 4</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {["AC too warm", "Lobby light out", "Water pressure issue"].map((req) => (
                      <div
                        key={req}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm text-slate-700"
                      >
                        {req}
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMockup>
              <div className="lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Tenant portal for faster issue intake
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Give tenants a clean way to report operational issues while your team tracks and
                  resolves requests with full status visibility.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS["om-tenant-portal"].map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Launch tenant portal <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </AnimateIn>

            {/* Feature 10 — FM Dashboard (text left, image right) */}
            <AnimateIn
              id="feature-om-fm-dashboard"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  FM dashboard for daily operations clarity
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  See open work, overdue inspections, and asset workload trends in one dashboard so
                  teams can prioritize action without context switching.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS["om-fm-dashboard"].map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  View FM dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Open work", "29"],
                      ["Overdue", "6"],
                      ["Inspections due", "12"],
                      ["High priority", "4"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                      >
                        <div className="text-xs text-slate-500">{label}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMockup>
            </AnimateIn>

            {/* Feature 11 — Takeoff (text left, image right) */}
            <AnimateIn
              id="feature-takeoff"
              className="mt-24 scroll-mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Measure once. Take off everywhere.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  Draw measurement zones directly on your drawings. PlanSync calculates quantities
                  automatically. Export to CSV or PDF in one click.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {LANDING_FEATURE_BULLETS.takeoff.map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--landing-cta)_75%,#64748b)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
                >
                  Start Pro Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <BrowserMockup className="order-1 lg:order-2">
                <div className="relative aspect-4/3 overflow-hidden">
                  <Image
                    src="/images/calibrate.png"
                    alt="PlanSync quantity takeoff with colored zones on a construction drawing"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    loading="lazy"
                    quality={78}
                  />
                </div>
              </BrowserMockup>
            </AnimateIn>
          </div>
        </section>

        {/* ═══════════ SECTION 5 — FAQ ═══════════ */}
        <section
          className="relative scroll-mt-20 border-t border-slate-200/60 bg-[var(--enterprise-bg)] py-24 sm:py-32"
          id="faq"
        >
          <div className="mx-auto max-w-3xl px-6">
            <AnimateIn className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
                FAQ
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600 sm:text-base">
                Billing, storage, and how Free vs Pro works.
              </p>
            </AnimateIn>

            <div className="mt-12 rounded-2xl border border-slate-200/90 bg-white p-1 shadow-[var(--enterprise-shadow-card)] sm:mt-14 sm:p-2">
              {LANDING_FAQ.map((item, i) => (
                <AnimateIn key={item.q} delay={i * 40}>
                  <details className="group border-b border-slate-100 last:border-0 first:rounded-t-xl last:rounded-b-xl open:bg-slate-50/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-4 text-left text-[15px] font-semibold text-slate-900 transition-colors hover:text-[var(--landing-cta)] sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 group-open:text-[var(--landing-cta)]" />
                    </summary>
                    <p className="px-4 pb-4 pr-10 text-sm leading-relaxed text-slate-600 sm:px-5 sm:pb-5">
                      {item.a}
                    </p>
                  </details>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ SECTION 6 — FINAL CTA ═══════════ */}
        <section
          id="cta"
          className="relative isolate scroll-mt-20 min-h-[26rem] overflow-hidden border-t border-white/[0.06] sm:min-h-[30rem]"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <Image
              src="/images/cta/CTA-constraction-hero.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-[center_32%] sm:object-[center_30%]"
              loading="lazy"
              fetchPriority="low"
              quality={75}
            />
          </div>
          {/* Top: photo reads clearly; bottom ~half ramps to deep slate (content sits in dark band) */}
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.2)_0%,rgba(15,23,42,0.28)_22%,rgba(15,23,42,0.42)_45%,rgba(15,23,42,0.78)_72%,rgba(2,6,23,0.97)_100%)]"
            aria-hidden
          />
          {/* Brand: subtle blue only in lower third — ties to app primary without muddying the whole frame */}
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_52%,rgba(37,99,235,0.14)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.2),inset_0_-100px_140px_rgba(0,0,0,0.55)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: "60px 60px",
            }}
            aria-hidden
          />

          <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center sm:px-8 sm:py-32 md:py-36">
            <AnimateIn>
              <h2 className="text-3xl font-bold tracking-tight text-blue-50 drop-shadow-[0_1px_20px_rgba(37,99,235,0.2)] sm:text-4xl">
                Start for free today
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-blue-100/85">
                Open the free viewer in seconds — no signup needed.
                <br />
                Upgrade to Pro when your team is ready.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={goToFreeViewer}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--landing-cta)] px-7 py-3.5 text-base font-semibold text-[var(--landing-cta-text)] shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] transition hover:bg-[var(--landing-cta-bright)] hover:shadow-[color-mix(in_srgb,var(--landing-cta)_38%,transparent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Open free viewer <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-white/90 bg-white/[0.07] px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Start Pro Trial
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-blue-200/70">
                <span>No installation</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>No credit card</span>
              </div>
            </AnimateIn>
          </div>
        </section>
      </main>

      {/* ═══════════ SECTION 7 — FOOTER ═══════════ */}
      <footer className="border-t border-slate-800/80 bg-[#0F172A] text-white">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-8 sm:pt-20">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0"
                  unoptimized
                />
                <span className="text-base font-bold tracking-tight">PlanSync</span>
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
                    href="#how-it-works"
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    How it works
                  </a>
                </li>
                <li>
                  <a
                    href="#solutions"
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    Solutions
                  </a>
                </li>
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
                    onClick={goToFreeViewer}
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    Free viewer
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
              onClick={goToFreeViewer}
              className="inline-flex items-center gap-2 text-xs font-medium text-sky-400 transition hover:text-sky-300"
            >
              Open free PDF viewer <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
