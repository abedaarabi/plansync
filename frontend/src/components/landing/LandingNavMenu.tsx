"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type LandingNavMenuItem = {
  href: string;
  label: string;
  description?: string;
};

type LandingNavMenuProps = {
  label: string;
  items: LandingNavMenuItem[];
  /** True when any child route should highlight the trigger */
  active?: boolean;
};

function itemIsActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LandingNavMenu({ label, items, active = false }: LandingNavMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const childActive = items.some((item) => itemIsActive(pathname, item.href));
  const highlight = active || childActive;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={`${menuId}-trigger`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`landing-type-nav inline-flex items-center gap-1 rounded-lg px-2.5 py-2 transition ${
          highlight || open
            ? "bg-slate-900/[0.04] text-slate-900"
            : "text-slate-600 hover:bg-slate-900/[0.03] hover:text-slate-900"
        }`}
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          className="absolute left-1/2 top-full z-50 mt-2 w-[min(18.5rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-[0_20px_42px_-24px_rgba(15,23,42,0.28)]"
        >
          {items.map((item) => {
            const isActive = itemIsActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 transition ${
                  isActive
                    ? "bg-slate-900/[0.04] text-slate-900"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                    {item.description}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
