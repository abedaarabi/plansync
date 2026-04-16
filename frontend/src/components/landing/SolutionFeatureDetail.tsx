"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SolutionSlug } from "@/lib/landingContent";
import { LANDING_FEATURE_BULLETS } from "@/lib/landingContent";
import { SOLUTION_ICON_COLORS, SOLUTION_ICONS } from "./solutionIcons";
import { AnimateIn } from "./AnimateIn";
import { BrowserMockup } from "./BrowserMockup";
import { LandingVideoModal } from "./YouTubeEmbeds";
import { YOUTUBE_PDF_VERSION_CONTROL_ID } from "./constants";

type SolutionFeatureDetailProps = {
  slug: SolutionSlug;
  onGoToFreeViewer: () => void;
  className?: string;
};

/** Text column — glass card aligned with solution page system. */
const PANEL =
  "relative overflow-hidden rounded-3xl border border-slate-200/75 bg-white p-7 shadow-[0_24px_48px_-20px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.03] sm:p-8 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-slate-200/70 before:to-transparent lg:p-9";

/** Shared "check" icon for bullet lists — takes accent color class as a prop. */
function BulletCheck({ colorClass }: { colorClass: string }) {
  return (
    <svg
      className={`mt-0.5 h-4 w-4 shrink-0 ${colorClass}`}
      fill="none"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path
        d="M5 8.5l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Primary CTA button for detail pages. */
function DetailCta({
  href,
  onClick,
  label,
  colorBg,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  colorBg: string;
}) {
  const cls = `mt-7 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] ${colorBg}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {label}
        <ArrowRight className="h-4 w-4 shrink-0" />
      </button>
    );
  }
  return (
    <Link href={href ?? "/sign-in"} className={cls}>
      {label}
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

export function SolutionFeatureDetail({
  slug,
  onGoToFreeViewer,
  className = "",
}: SolutionFeatureDetailProps) {
  const colors = SOLUTION_ICON_COLORS[slug];

  const block = (() => {
    switch (slug) {
      case "viewer":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
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
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                The most powerful free plan viewer
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Open any PDF instantly in your browser. Calibrate scale, measure distances and
                areas, annotate, and export — all locally. No files leave your device. Ever.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS.viewer.map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta
                onClick={onGoToFreeViewer}
                label="Try the free viewer"
                colorBg={colors.solidBg}
              />
            </div>
          </AnimateIn>
        );

      case "issues":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Pin issues directly on the drawing
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Click anywhere on a plan to drop an issue pin. Assign it, set priority, attach
                photos. Your team gets notified instantly. Track from Open to Resolved without
                leaving PlanSync.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS.issues.map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="See how issues work" colorBg={colors.solidBg} />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
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
        );

      case "rfis":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">RFIs</span>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600 ring-1 ring-violet-200">
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
                      color: "bg-emerald-500",
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
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-slate-200 hover:bg-white"
                    >
                      <span className="font-mono text-xs text-slate-400">#{rfi.num}</span>
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
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Formal RFIs in seconds
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Convert any issue into a formal RFI. Track responses, attach drawings, and close
                them out — all in one place. No more RFIs buried in email threads.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS.rfis.map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Start Pro Trial" colorBg={colors.solidBg} />
            </div>
          </AnimateIn>
        );

      case "om-handover":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Handover data your FM team can use
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Move from project closeout to operations without losing context. PlanSync keeps
                handover packages, asset records, and recurring operational workflows connected in
                one system.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["om-handover"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Start Pro Trial" colorBg={colors.solidBg} />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Handover package</span>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-600 ring-1 ring-teal-200">
                    Ready
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {["Asset register", "O&M manuals", "Inspection templates"].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700"
                    >
                      <span>{item}</span>
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">
                        Linked
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
          </AnimateIn>
        );

      case "om-assets":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Asset register</span>
                  <span className="text-xs text-slate-500">248 assets</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {["AHU-01", "CHWP-03", "FD-2F-17"].map((asset) => (
                    <div
                      key={asset}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                    >
                      <span className="text-sm font-medium text-slate-700">{asset}</span>
                      <span className="text-xs text-slate-400">4 documents</span>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Asset data that stays organized
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Build a maintainable asset register with documents, specifications, and lifecycle
                context. Teams find the right equipment record quickly when operations begin.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["om-assets"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Explore O&M assets" colorBg={colors.solidBg} />
            </div>
          </AnimateIn>
        );

      case "om-maintenance":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Preventive maintenance made practical
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Schedule recurring maintenance tasks, capture service outcomes, and keep operational
                records complete from day one of occupancy.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["om-maintenance"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta
                href="/sign-in"
                label="Start maintenance planning"
                colorBg={colors.solidBg}
              />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Maintenance calendar</span>
                  <span className="text-xs text-slate-500">This week · 12 tasks</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { name: "Filter replacement", due: "Today" },
                    { name: "Pump inspection", due: "Wed" },
                    { name: "Emergency lighting test", due: "Fri" },
                  ].map((job) => (
                    <div
                      key={job.name}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700"
                    >
                      <span>{job.name}</span>
                      <span className="text-xs text-slate-400">{job.due}</span>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
          </AnimateIn>
        );

      case "om-work-orders":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Work orders</span>
                  <span className="text-xs text-slate-500">9 open</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { id: "WO-1024", title: "HVAC fault", priority: "High" },
                    { id: "WO-1028", title: "Leak check", priority: "Med" },
                    { id: "WO-1031", title: "Lighting repair", priority: "Low" },
                  ].map((wo) => (
                    <div
                      key={wo.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700"
                    >
                      <span>
                        <span className="font-mono text-xs text-slate-400">{wo.id} </span>
                        {wo.title}
                      </span>
                      <span className="text-xs text-slate-400">{wo.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Work orders with clear ownership
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Convert maintenance needs into trackable work orders with priorities, assignees, and
                auditable completion history your team can trust.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["om-work-orders"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Manage work orders" colorBg={colors.solidBg} />
            </div>
          </AnimateIn>
        );

      case "om-inspections":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Repeatable inspections across your portfolio
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Use standardized templates, run inspections in the field, and record findings in a
                structured format that supports long-term compliance.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["om-inspections"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Run inspections" colorBg={colors.solidBg} />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Inspection runs</span>
                  <span className="text-xs text-slate-500">5 due</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { name: "Fire safety monthly", status: "Scheduled" },
                    { name: "HVAC quarterly", status: "Due" },
                    { name: "Lift compliance", status: "Scheduled" },
                  ].map((run) => (
                    <div
                      key={run.name}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700"
                    >
                      <span>{run.name}</span>
                      <span className="text-xs text-slate-400">{run.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
          </AnimateIn>
        );

      case "om-tenant-portal":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Tenant requests</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 ring-1 ring-blue-200">
                    4 new
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {["AC too warm", "Lobby light out", "Water pressure issue"].map((req) => (
                    <div
                      key={req}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700"
                    >
                      {req}
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Tenant portal for faster issue intake
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Give tenants a clean way to report operational issues while your team tracks and
                resolves requests with full status visibility.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["om-tenant-portal"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Launch tenant portal" colorBg={colors.solidBg} />
            </div>
          </AnimateIn>
        );

      case "om-fm-dashboard":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                FM dashboard for daily operations clarity
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                See open work, overdue inspections, and asset workload trends in one dashboard so
                teams can prioritize action without context switching.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["om-fm-dashboard"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="View FM dashboard" colorBg={colors.solidBg} />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Open work", value: "29" },
                    { label: "Overdue", value: "6", highlight: true },
                    { label: "Inspections due", value: "12" },
                    { label: "High priority", value: "4", highlight: true },
                  ].map(({ label, value, highlight }) => (
                    <div
                      key={label}
                      className={`rounded-xl border p-3 ${highlight ? "border-rose-100 bg-rose-50/50" : "border-slate-100 bg-slate-50/60"}`}
                    >
                      <div className="text-xs text-slate-500">{label}</div>
                      <div
                        className={`mt-1 text-xl font-bold ${highlight ? "text-rose-600" : "text-slate-900"}`}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
          </AnimateIn>
        );

      case "takeoff":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Measure once. Take off everywhere.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Draw measurement zones directly on your drawings. PlanSync calculates quantities
                automatically. Export to CSV or PDF in one click.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS.takeoff.map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Start Pro Trial" colorBg={colors.solidBg} />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
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
        );

      case "audit":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Site audit — Block A</span>
                  <span className="rounded-full bg-lime-50 px-3 py-1 text-xs font-medium text-lime-700 ring-1 ring-lime-200">
                    In progress
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { ref: "A-01", item: "Rebar cover — Level 2 slab", result: "Pass" },
                    { ref: "A-02", item: "Concrete pour consistency", result: "NCR raised" },
                    { ref: "A-03", item: "Formwork alignment — Grid C", result: "Pass" },
                    { ref: "A-04", item: "Waterproofing membrane lap", result: "Action req." },
                  ].map((row) => (
                    <div
                      key={row.ref}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                    >
                      <span className="font-mono text-xs text-slate-400">{row.ref}</span>
                      <span className="min-w-0 flex-1 text-sm text-slate-700">{row.item}</span>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                          row.result === "Pass"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.result === "NCR raised"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </BrowserMockup>
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                Structured audits tied to your drawings
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Run systematic site quality audits against the actual plans. Capture
                non-conformances in the field, assign corrective actions to the right person, and
                produce a signed-off audit report — all in one workflow.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS.audit.map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Start Pro Trial" colorBg={colors.solidBg} />
            </div>
          </AnimateIn>
        );

      case "proposal":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                From takeoff to winning bid — in one tool
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Pull quantities directly from your PlanSync takeoff, attach drawing references, and
                produce professional bid documents that give clients the confidence to say yes.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS.proposal.map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Start Pro Trial" colorBg={colors.solidBg} />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">
                    Proposal — Office Block B
                  </span>
                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-600 ring-1 ring-purple-200">
                    Draft
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { trade: "Concrete works", qty: "1,240 m²", value: "$62,000" },
                    { trade: "Reinforcement", qty: "38 t", value: "$34,200" },
                    { trade: "Formwork", qty: "2,100 m²", value: "$18,900" },
                  ].map((line) => (
                    <div
                      key={line.trade}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm"
                    >
                      <span className="text-slate-700">{line.trade}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400">{line.qty}</span>
                        <span className="font-semibold text-slate-900">{line.value}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50/60 p-3 text-sm">
                    <span className="font-semibold text-slate-900">Total</span>
                    <span className="font-bold text-purple-700">$115,100</span>
                  </div>
                </div>
              </div>
            </BrowserMockup>
          </AnimateIn>
        );

      case "cloud-storage":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Project storage</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                    Encrypted
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { name: "Structural — Rev 04.pdf", size: "12.4 MB" },
                    { name: "RFI-017_attachments.zip", size: "4.1 MB" },
                    { name: "Zone A — takeoff.csv", size: "128 KB" },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-slate-800">{row.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{row.size}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-800">
                  Stored in your workspace cloud · TLS in transit · access by team members only
                </p>
              </div>
            </BrowserMockup>
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                One place for every project file
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Pro keeps drawings, issues, RFIs, and attachments in sync in one workspace. No more
                guessing which email had the latest sheet — your team opens the same cloud-backed
                project from the trailer or the office.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["cloud-storage"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Start Pro Trial" colorBg={colors.solidBg} />
            </div>
          </AnimateIn>
        );

      case "pdf-version-control":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <BrowserMockup variant="elevated">
              <div className="relative aspect-4/3 overflow-hidden">
                <LandingVideoModal
                  videoId={YOUTUBE_PDF_VERSION_CONTROL_ID}
                  title="PlanSync PDF version control demo"
                  playAriaLabel="Play PDF version control demo video"
                  posterAlt="PlanSync PDF version control demo thumbnail"
                  thumbnailMode="icon"
                  thumbnailLabel="PDF version control"
                  thumbnailIcon={SOLUTION_ICONS["pdf-version-control"]}
                  thumbnailBadgeClassName={`${SOLUTION_ICON_COLORS["pdf-version-control"].bg} ${SOLUTION_ICON_COLORS["pdf-version-control"].text} ${SOLUTION_ICON_COLORS["pdf-version-control"].ring} border`}
                  className="absolute inset-0 rounded-none shadow-none"
                />
              </div>
            </BrowserMockup>
            <div className={PANEL}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                PDF version control built for construction sets
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Stop losing track of which PDF is on the trailer wall versus the one in the bid
                package. PlanSync keeps revisions ordered, labeled, and easy to open so everyone is
                looking at the same approved drawing.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS["pdf-version-control"].map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="See revisions in Pro" colorBg={colors.solidBg} />
            </div>
          </AnimateIn>
        );

      case "schedule":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className={`order-2 lg:order-1 ${PANEL}`}>
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                One schedule next to your drawings
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Keep milestones and lookahead tasks where your team already works — tied to the same
                project, roles, and notifications as issues and RFIs, so the plan and the calendar
                do not drift apart.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {LANDING_FEATURE_BULLETS.schedule.map((b) => (
                  <li key={b} className="flex gap-3">
                    <BulletCheck colorClass={colors.text} />
                    <span className="text-sm leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
              <DetailCta href="/sign-in" label="Plan with Pro" colorBg={colors.solidBg} />
            </div>
            <BrowserMockup variant="elevated" className="order-1 lg:order-2">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-semibold text-slate-900">Project schedule</span>
                  <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700 ring-1 ring-pink-100">
                    Week of Apr 14
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { name: "Steel delivery — Area B", start: "Apr 16", end: "Apr 18", pct: 72 },
                    { name: "MEP rough-in Level 3", start: "Apr 21", end: "May 02", pct: 35 },
                    { name: "Drywall close + inspection", start: "May 05", end: "May 12", pct: 0 },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{row.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {row.start} → {row.end}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/90">
                        <div
                          className="h-full rounded-full bg-pink-500 transition-[width]"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 rounded-lg border border-pink-100 bg-pink-50/40 px-3 py-2 text-xs text-pink-900">
                  Drag dates or update status — supers and PMs see the same live bar in the
                  workspace.
                </p>
              </div>
            </BrowserMockup>
          </AnimateIn>
        );
    }
  })();

  return <div className={className}>{block}</div>;
}
