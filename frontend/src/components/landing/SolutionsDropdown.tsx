"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Box,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  Gauge,
  HardHat,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useLandingNavDropdown } from "./useLandingNavDropdown";

const AUDIENCES = [
  { key: "owners", href: "/use-cases/owner-handover-and-operations", icon: Building2 },
  { key: "gc", href: "/use-cases/general-contractor-delivery", icon: HardHat },
  { key: "mep", href: "/use-cases/subcontractor-quantity-workflow", icon: Wrench },
  { key: "commissioning", href: "/solutions/om-handover", icon: ShieldCheck },
  { key: "facilityOps", href: "/use-cases/facility-team-service-operations", icon: Gauge },
] as const;

const FEATURED = [
  { key: "bim", href: "/solutions/bim-viewer", icon: Box },
  { key: "pdf", href: "/solutions/viewer", icon: FileSearch },
  { key: "handover", href: "/solutions/om-handover", icon: ClipboardCheck },
] as const;

type MenuTone = {
  itemClass: string;
  titleClass: string;
  mutedClass: string;
  labelClass: string;
};

function menuTone(dark: boolean): MenuTone {
  return {
    itemClass: dark
      ? "group flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-white/10 hover:bg-white/6"
      : "group flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-slate-200 hover:bg-slate-50",
    titleClass: dark
      ? "text-white group-hover:text-sky-200"
      : "text-slate-900 group-hover:text-blue-700",
    mutedClass: dark ? "text-slate-400" : "text-slate-500",
    labelClass: dark ? "text-slate-400" : "text-slate-500",
  };
}

function MenuRow({
  href,
  title,
  body,
  icon: Icon,
  accent = false,
  itemClass,
  titleClass,
  mutedClass,
  onNavigate,
}: MenuTone & {
  href: string;
  title: string;
  body: string;
  icon: LucideIcon;
  accent?: boolean;
  onNavigate: () => void;
  labelClass?: string;
}) {
  return (
    <li>
      <Link href={href} role="menuitem" onClick={onNavigate} className={itemClass}>
        <span
          className={`landing-icon landing-icon-sm mt-0.5 ${accent ? "landing-icon-accent" : ""}`}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className={`block text-sm font-semibold transition ${titleClass}`}>{title}</span>
          <span className={`mt-0.5 block text-xs leading-snug ${mutedClass}`}>{body}</span>
        </span>
      </Link>
    </li>
  );
}

function SolutionsMenuPanel({
  dark,
  menuId,
  triggerId,
  onClose,
}: {
  dark: boolean;
  menuId: string;
  triggerId: string;
  onClose: () => void;
}) {
  const t = useTranslations("solutionsMenu");
  const tone = menuTone(dark);

  return (
    <div
      id={menuId}
      role="menu"
      aria-labelledby={triggerId}
      aria-label={t("menuAria")}
      className={
        dark
          ? "absolute left-1/2 top-full z-50 mt-2 w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-white/12 bg-[rgba(11,18,32,0.98)] shadow-[0_28px_56px_-30px_rgba(0,0,0,0.7)] backdrop-blur-md"
          : "absolute left-1/2 top-full z-50 mt-2 w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_28px_56px_-30px_rgba(15,23,42,0.28)]"
      }
    >
      <div className="grid gap-0 sm:grid-cols-[1.15fr_0.85fr]">
        <div className="p-3 sm:p-3.5">
          <p
            className={`px-1 text-[11px] font-semibold uppercase tracking-[0.13em] ${tone.labelClass}`}
          >
            {t("audiencesLabel")}
          </p>
          <ul className="mt-2.5 grid gap-0.5">
            {AUDIENCES.map((item) => (
              <MenuRow
                key={item.key}
                href={item.href}
                icon={item.icon}
                title={t(`audiences.${item.key}.title`)}
                body={t(`audiences.${item.key}.body`)}
                onNavigate={onClose}
                {...tone}
              />
            ))}
          </ul>
        </div>

        <div
          className={
            dark
              ? "border-t border-white/10 bg-white/3 p-3 sm:border-l sm:border-t-0 sm:p-3.5"
              : "border-t border-slate-100 bg-slate-50/80 p-3 sm:border-l sm:border-t-0 sm:p-3.5"
          }
        >
          <p
            className={`px-1 text-[11px] font-semibold uppercase tracking-[0.13em] ${tone.labelClass}`}
          >
            {t("featuredLabel")}
          </p>
          <ul className="mt-2.5 flex flex-col gap-0.5">
            {FEATURED.map((item) => (
              <MenuRow
                key={item.key}
                href={item.href}
                icon={item.icon}
                title={t(`featured.${item.key}.title`)}
                body={t(`featured.${item.key}.body`)}
                accent
                onNavigate={onClose}
                {...tone}
              />
            ))}
          </ul>

          <Link
            href="/solutions"
            role="menuitem"
            onClick={onClose}
            className={
              dark
                ? "mt-3 inline-flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 text-xs font-semibold text-sky-300 transition hover:bg-white/8"
                : "mt-3 inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
            }
          >
            <span>{t("browseAll")}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

type SolutionsDropdownProps = {
  dark?: boolean;
};

export function SolutionsDropdown({ dark = false }: SolutionsDropdownProps) {
  const t = useTranslations("solutionsMenu");
  const { open, toggle, close, rootRef, menuId } = useLandingNavDropdown();
  const triggerId = `${menuId}-trigger`;

  const triggerClass = dark
    ? open
      ? "bg-white/10 text-white"
      : "text-slate-300 hover:bg-white/6 hover:text-white"
    : open
      ? "bg-slate-900/4 text-slate-900"
      : "text-slate-600 hover:bg-slate-900/3 hover:text-slate-900";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={triggerId}
        className={`landing-type-nav inline-flex items-center gap-1 rounded-lg px-2.5 py-2 transition ${triggerClass}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={toggle}
      >
        {t("trigger")}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      {open ? (
        <SolutionsMenuPanel dark={dark} menuId={menuId} triggerId={triggerId} onClose={close} />
      ) : null}
    </div>
  );
}
