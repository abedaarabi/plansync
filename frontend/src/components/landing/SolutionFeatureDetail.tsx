"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { SolutionSlug } from "@/lib/landingContent";
import { LANDING_FEATURE_BULLETS } from "@/lib/landingContent";
import { AnimateIn } from "./AnimateIn";
import { BrowserMockup } from "./BrowserMockup";

type SolutionFeatureDetailProps = {
  slug: SolutionSlug;
  onGoToFreeViewer: () => void;
  className?: string;
};

export function SolutionFeatureDetail({
  slug,
  onGoToFreeViewer,
  className = "",
}: SolutionFeatureDetailProps) {
  const block = (() => {
    switch (slug) {
      case "viewer":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
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
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                The most powerful free plan viewer
              </h2>
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
                onClick={onGoToFreeViewer}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-cta)] transition hover:text-[var(--landing-cta-bright)]"
              >
                Try the free viewer <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </AnimateIn>
        );
      case "issues":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Pin issues directly on the drawing
              </h2>
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
        );
      case "rfis":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
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
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Formal RFIs in seconds
              </h2>
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
        );
      case "om-handover":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Handover data your FM team can use
              </h2>
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
        );
      case "om-assets":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
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
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Asset data that stays organized
              </h2>
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
        );
      case "om-maintenance":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Preventive maintenance made practical
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Schedule recurring maintenance tasks, capture service outcomes, and keep operational
                records complete from day one of occupancy.
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
                  <span className="text-sm font-semibold text-slate-900">Maintenance calendar</span>
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
        );
      case "om-work-orders":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
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
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Work orders with clear ownership
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Convert maintenance needs into trackable work orders with priorities, assignees, and
                auditable completion history your team can trust.
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
        );
      case "om-inspections":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Repeatable inspections across your portfolio
              </h2>
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
        );
      case "om-tenant-portal":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
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
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Tenant portal for faster issue intake
              </h2>
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
        );
      case "om-fm-dashboard":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                FM dashboard for daily operations clarity
              </h2>
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
        );
      case "takeoff":
        return (
          <AnimateIn className="grid items-center gap-10 scroll-mt-24 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white/90 lg:p-8 lg:shadow-[var(--enterprise-shadow-card)] lg:backdrop-blur-sm">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Measure once. Take off everywhere.
              </h2>
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
        );
    }
  })();

  return <div className={className}>{block}</div>;
}
