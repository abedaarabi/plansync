"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Download, Maximize2 } from "lucide-react";
import { STORY_ASSET_ROWS, STORY_SLIDES, type StorySlide } from "@/lib/storyPresentationContent";
import { BrowserMockup } from "./BrowserMockup";
import { MarketingShell } from "./MarketingShell";
import { StoryHandoverGapChart, StoryTimeLeakChart } from "./StoryCharts";
import "./story-presentation.css";

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="PlanSync">
      <Image
        src="/icon.svg"
        alt=""
        width={large ? 36 : 28}
        height={large ? 36 : 28}
        className={large ? "h-9 w-9 rounded-lg" : "h-7 w-7 rounded-md"}
        unoptimized
      />
      <span
        className={`font-bold tracking-tight text-[var(--story-ink)] ${large ? "text-xl" : "text-base"}`}
      >
        Plan<span className="text-[var(--landing-cta)]">Sync</span>
      </span>
    </div>
  );
}

function SlideChrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <BrandMark />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--story-faint)]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function MetaRow({ items }: { items: { label: string; body: string }[] }) {
  return (
    <div className="mt-auto grid gap-4 pt-8 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-sm font-semibold text-[var(--story-ink)]">{item.label}</p>
          <p className="mt-1 text-sm text-[var(--story-muted)]">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <div className="relative min-h-[14rem] overflow-hidden rounded-2xl border border-[var(--story-line)] bg-[var(--story-panel-soft)] shadow-sm sm:min-h-0">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 45vw"
      />
      <span className="absolute bottom-3 left-3 rounded-full border border-white/40 bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-200">
        {caption}
      </span>
    </div>
  );
}

// fallow-ignore-next-line complexity
function SlideBody({ slide }: { slide: StorySlide }) {
  switch (slide.id) {
    case "opening":
      return (
        <div className="grid h-full gap-6 lg:grid-cols-2 lg:gap-10">
          <SlideChrome label={slide.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {slide.eyebrow}
            </p>
            <h2 className="mt-3 max-w-[14ch] text-balance text-3xl font-bold tracking-tight text-[var(--story-ink)] sm:text-4xl lg:text-[2.75rem]">
              {slide.title}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--story-muted)] sm:text-lg">
              {slide.sub}
            </p>
            <MetaRow items={[...slide.meta]} />
          </SlideChrome>
          <div className="relative min-h-[16rem] overflow-hidden rounded-2xl lg:min-h-0">
            <Image
              src={slide.image}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      );
    case "agenda":
      return (
        <SlideChrome label={slide.label}>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--story-ink)] sm:text-4xl">
            {slide.title}
          </h2>
          <ol className="mt-8 max-w-xl divide-y divide-[var(--story-line)]">
            {slide.items.map((item) => (
              <li
                key={item.n}
                className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 py-3.5 text-base text-[var(--story-ink-soft)] sm:text-lg"
              >
                <span className="font-semibold text-[var(--landing-cta)]">{item.n}</span>
                <span>{item.title}</span>
                <em className="text-sm not-italic text-[var(--story-faint)]">{item.time}</em>
              </li>
            ))}
          </ol>
        </SlideChrome>
      );
    case "problem":
      return (
        <div className="grid h-full gap-6 lg:grid-cols-2 lg:gap-10">
          <SlideChrome label={slide.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {slide.eyebrow}
            </p>
            <h2 className="mt-3 max-w-[20ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
              {slide.title}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--story-muted)] sm:text-base">
              {slide.lede}
            </p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {slide.problems.map((p) => (
                <li
                  key={p.n}
                  className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border border-[var(--story-line)] bg-[var(--story-panel)] px-3.5 py-3"
                >
                  <span className="font-semibold text-[var(--landing-cta)]">{p.n}</span>
                  <div>
                    <p className="font-semibold text-[var(--story-ink)]">{p.title}</p>
                    <p className="mt-0.5 text-sm text-[var(--story-muted)]">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SlideChrome>
          <Shot src={slide.image} alt="" caption={slide.imageCaption} />
        </div>
      );
    case "charts":
      return (
        <SlideChrome label={slide.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[22ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
            {slide.title}
          </h2>
          <div className="mt-5 grid flex-1 gap-4 lg:grid-cols-2">
            <StoryTimeLeakChart />
            <StoryHandoverGapChart />
          </div>
        </SlideChrome>
      );
    case "desired":
      return (
        <SlideChrome label={slide.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[20ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
            {slide.title}
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
            {slide.flow.map((step, i) => (
              <div key={step.tag} className="contents">
                {i > 0 ? (
                  <div
                    className="hidden items-center justify-center text-sky-500 sm:flex"
                    aria-hidden
                  >
                    →
                  </div>
                ) : null}
                <div className="rounded-2xl border border-[var(--story-accent-ring)] bg-[var(--story-accent-wash)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-400">
                    {step.tag}
                  </p>
                  <h3 className="mt-2 font-semibold text-[var(--story-ink)]">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--story-muted)]">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-xl text-base text-[var(--story-muted)]">{slide.footer}</p>
        </SlideChrome>
      );
    case "howItWorks":
      return (
        <SlideChrome label={slide.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[20ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
            {slide.title}
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {slide.steps.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-[var(--story-line)] bg-[var(--story-panel)] p-4 shadow-sm"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--story-accent-wash)] text-sm font-bold text-[var(--landing-cta)] ring-1 ring-[var(--story-accent-ring)]">
                  {step.n}
                </span>
                <h3 className="mt-3 font-semibold text-[var(--story-ink)]">{step.title}</h3>
                <p className="mt-1 text-sm text-[var(--story-muted)]">{step.body}</p>
              </div>
            ))}
          </div>
        </SlideChrome>
      );
    case "value":
      return (
        <div className="grid h-full gap-6 lg:grid-cols-2 lg:gap-10">
          <SlideChrome label={slide.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {slide.eyebrow}
            </p>
            <h2 className="mt-3 max-w-[18ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
              {slide.title}
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {slide.values.map((v) => (
                <div key={v.title} className="border-l-2 border-[var(--landing-cta)]/50 pl-3">
                  <p className="font-semibold text-[var(--story-ink)]">{v.title}</p>
                  <p className="mt-1 text-sm text-[var(--story-muted)]">{v.body}</p>
                </div>
              ))}
            </div>
          </SlideChrome>
          <Shot src={slide.image} alt="" caption={slide.imageCaption} />
        </div>
      );
    case "assets":
      return (
        <div className="grid h-full gap-6 lg:grid-cols-2 lg:gap-10">
          <SlideChrome label={slide.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {slide.eyebrow}
            </p>
            <h2 className="mt-3 max-w-[16ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
              {slide.title}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--story-muted)] sm:text-base">
              {slide.lede}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {slide.panels.map((panel) => (
                <div
                  key={panel.title}
                  className="rounded-xl border border-[var(--story-line)] bg-[var(--story-panel)] p-3.5"
                >
                  <h3 className="text-sm font-semibold text-[var(--story-ink)]">{panel.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--story-muted)]">
                    {panel.body}
                  </p>
                </div>
              ))}
            </div>
          </SlideChrome>
          <div className="flex items-center">
            <BrowserMockup variant="elevated" className="w-full max-w-md lg:ml-auto">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-[var(--story-line)] pb-4">
                  <span className="text-sm font-semibold text-[var(--story-ink)]">
                    Asset register
                  </span>
                  <span className="text-xs text-[var(--story-muted)]">{slide.assetCount}</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {STORY_ASSET_ROWS.map((row) => (
                    <div
                      key={row.tag}
                      className="flex items-center justify-between rounded-xl border border-[var(--story-line)] bg-[var(--story-panel-soft)] p-3"
                    >
                      <span className="text-sm font-medium text-[var(--story-ink-soft)]">
                        {row.tag}
                      </span>
                      <span className="text-xs text-[var(--story-faint)]">{row.docs}</span>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
          </div>
        </div>
      );
    case "outcomes":
      return (
        <SlideChrome label={slide.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[18ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
            {slide.title}
          </h2>
          <div className="mt-6 grid flex-1 gap-3 sm:grid-cols-2">
            {slide.outcomes.map((o) => (
              <div
                key={o.label}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--story-line)] bg-[var(--story-panel)] p-4 shadow-sm"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--story-faint)]">
                  {o.label}
                </p>
                <p className="text-sm text-rose-400">{o.before}</p>
                <p className="text-sm font-medium text-emerald-400">{o.after}</p>
              </div>
            ))}
          </div>
        </SlideChrome>
      );
    case "pilot":
      return (
        <div className="grid h-full gap-6 lg:grid-cols-2 lg:gap-10">
          <SlideChrome label={slide.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
              {slide.eyebrow}
            </p>
            <h2 className="mt-3 max-w-[16ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
              {slide.title}
            </h2>
            <ol className="mt-6 flex flex-col gap-3">
              {slide.steps.map((step, i) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2rem_1fr] gap-3 text-sm text-[var(--story-muted)]"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--story-accent-wash)] text-xs font-bold text-[var(--landing-cta)] ring-1 ring-[var(--story-accent-ring)]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--story-ink)]">{step.title}</p>
                    <p className="mt-0.5">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </SlideChrome>
          <Shot src={slide.image} alt="" caption={slide.imageCaption} />
        </div>
      );
    case "questions":
      return (
        <SlideChrome label={slide.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[20ch] text-balance text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
            {slide.title}
          </h2>
          <ol className="mt-6 columns-1 gap-x-10 space-y-3 md:columns-2">
            {slide.questions.map((item) => (
              <li
                key={item.q}
                className="break-inside-avoid text-sm text-[var(--story-muted)] sm:text-base"
              >
                <strong className="font-semibold text-[var(--story-ink)]">{item.q}</strong>
                {item.a ? ` ${item.a}` : null}
              </li>
            ))}
          </ol>
        </SlideChrome>
      );
    case "close":
      return (
        <SlideChrome label={slide.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {slide.eyebrow}
          </p>
          <h2 className="mt-3 max-w-[16ch] text-balance text-3xl font-bold tracking-tight text-[var(--story-ink)] sm:text-4xl">
            {slide.title}
          </h2>
          <p className="mt-4 max-w-md text-xl font-semibold tracking-tight text-[var(--story-ink-soft)]">
            {slide.closeLine}
          </p>
          <MetaRow items={[...slide.meta]} />
        </SlideChrome>
      );
    default:
      return null;
  }
}

function StoryDeckInner() {
  const t = useTranslations("storyPresentation");
  const msg = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
  const [index, setIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [presenting, setPresenting] = useState(false);
  const total = STORY_SLIDES.length;
  const slide = STORY_SLIDES[index]!;

  const go = useCallback(
    (n: number) => {
      setIndex(Math.max(0, Math.min(total - 1, n)));
    },
    [total],
  );

  const togglePresent = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
      else if (e.key === "f" || e.key === "F") {
        void togglePresent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, total, togglePresent]);

  useEffect(() => {
    const onFs = () => {
      setPresenting(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function downloadPdf() {
    window.print();
  }

  return (
    <div
      className={`story-deck mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 ${presenting ? "story-presenting" : ""}`}
    >
      <div className="story-no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-cta)]">
            {msg("eyebrow", "Story")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--story-ink)] sm:text-3xl">
            {msg("pageTitle", "From first drawing to day-one ops")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--story-muted)]">
            {msg(
              "pageBody",
              "A short story about complex builds, scattered delivery, and a cleaner path through PlanSync.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--story-line)] bg-[var(--story-panel)] px-4 py-2.5 text-sm font-semibold text-[var(--story-ink-soft)] shadow-sm transition hover:border-slate-300"
          >
            <Download className="h-4 w-4" aria-hidden />
            {msg("downloadPdf", "Download PDF")}
          </button>
          <button
            type="button"
            onClick={() => void togglePresent()}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--landing-cta)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[var(--landing-cta-bright)]"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
            {msg("present", "Present")}
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="story-stage story-no-print flex flex-col rounded-3xl border border-[var(--story-line)] bg-transparent p-4 shadow-sm sm:p-6 lg:p-8"
      >
        <div
          className="h-1 overflow-hidden rounded-full bg-[var(--story-line)]"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-[var(--landing-cta)] transition-[width] duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex-1">{SlideBody({ slide })}</div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--story-line)] pt-4">
          <p className="truncate text-xs font-medium text-[var(--story-faint)]">
            {slide.chromeTitle}
          </p>
          <div className="flex items-center gap-1.5">
            {STORY_SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`${msg("goToSlide", "Go to slide")} ${i + 1}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-[var(--landing-cta)]"
                    : "w-2 bg-[var(--story-faint)] hover:bg-[var(--story-muted)]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--story-line)] bg-[var(--story-panel)] text-[var(--story-ink-soft)] disabled:opacity-40"
              aria-label={msg("previous", "Previous slide")}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-[var(--story-muted)]">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === total - 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--story-line)] bg-[var(--story-panel)] text-[var(--story-ink-soft)] disabled:opacity-40"
              aria-label={msg("next", "Next slide")}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Print stack: all slides for PDF */}
      <div className="story-print-only">
        {STORY_SLIDES.map((s) => (
          <section key={s.id} className="story-print-slide">
            <SlideBody slide={s} />
          </section>
        ))}
      </div>
    </div>
  );
}

export function StoryPresentationClient() {
  return (
    <MarketingShell>
      <StoryDeckInner />
    </MarketingShell>
  );
}
