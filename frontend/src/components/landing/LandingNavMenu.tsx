"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useLandingNavDropdown } from "./useLandingNavDropdown";

export type LandingNavMenuItem = {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

type LandingNavMenuProps = {
  label: string;
  items: LandingNavMenuItem[];
  /** True when any child route should highlight the trigger */
  active?: boolean;
  dark?: boolean;
};

function itemIsActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LandingNavMenu({
  label,
  items,
  active = false,
  dark = false,
}: LandingNavMenuProps) {
  const pathname = usePathname();
  const { open, toggle, close, rootRef, menuId } = useLandingNavDropdown();

  const childActive = items.some((item) => itemIsActive(pathname, item.href));
  const highlight = active || childActive;

  const triggerClass = dark
    ? highlight || open
      ? "bg-white/10 text-white"
      : "text-slate-300 hover:bg-white/6 hover:text-white"
    : highlight || open
      ? "bg-slate-900/4 text-slate-900"
      : "text-slate-600 hover:bg-slate-900/3 hover:text-slate-900";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={`${menuId}-trigger`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={toggle}
        className={`landing-type-nav inline-flex items-center gap-1 rounded-lg px-2.5 py-2 transition ${triggerClass}`}
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          className={
            dark
              ? "absolute left-1/2 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-white/12 bg-[rgba(11,18,32,0.98)] p-2 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.65)] backdrop-blur-md"
              : "absolute left-1/2 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-2 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.28)]"
          }
        >
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const isActive = itemIsActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    role="menuitem"
                    onClick={close}
                    className={`group flex items-start gap-3 rounded-lg px-2.5 py-2.5 transition ${
                      dark
                        ? isActive
                          ? "bg-white/10 text-white"
                          : "text-slate-200 hover:bg-white/6 hover:text-white"
                        : isActive
                          ? "bg-slate-900/4 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {Icon ? (
                      <span
                        className={`landing-icon landing-icon-sm mt-0.5 ${
                          isActive ? "landing-icon-accent" : ""
                        }`}
                        aria-hidden
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold tracking-tight">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span
                          className={`mt-0.5 block text-xs leading-snug ${
                            dark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
