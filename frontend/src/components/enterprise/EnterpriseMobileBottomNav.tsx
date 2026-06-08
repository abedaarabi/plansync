"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEnterpriseMobileNav } from "@/hooks/useEnterpriseMobileNav";
import { hapticTap } from "@/lib/haptic";

type EnterpriseMobileBottomNavProps = {
  onOpenMore: () => void;
};

/**
 * Primary mobile navigation — fixed tab bar above the home indicator.
 * Replaces hamburger-only navigation on viewports below `lg`.
 */
export function EnterpriseMobileBottomNav({ onOpenMore }: EnterpriseMobileBottomNavProps) {
  const router = useRouter();
  const { tabs, isTabActive } = useEnterpriseMobileNav();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--enterprise-border)]/90 bg-[color-mix(in_srgb,var(--enterprise-surface)_94%,transparent)] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_-16px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden"
      aria-label="Main navigation"
      style={{ height: "var(--enterprise-bottomnav-offset)" }}
    >
      <ul className="mx-auto flex h-[var(--enterprise-bottomnav-h)] max-w-lg items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab);

          if (tab.isMore) {
            return (
              <li key={tab.id} className="flex min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    hapticTap();
                    onOpenMore();
                  }}
                  className="flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[var(--enterprise-text-muted)] transition-all duration-150 active:scale-[0.97] active:bg-[var(--enterprise-hover-surface)]"
                >
                  <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="max-w-full truncate text-[11px] font-medium leading-tight">
                    {tab.label}
                  </span>
                </button>
              </li>
            );
          }

          return (
            <li key={tab.id} className="flex min-w-0 flex-1">
              <Link
                href={tab.href}
                prefetch
                onClick={(e) => {
                  if (tab.disabled) {
                    e.preventDefault();
                    return;
                  }
                  hapticTap();
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                    e.preventDefault();
                    router.push(tab.href, { scroll: false });
                  }
                }}
                aria-current={active ? "page" : undefined}
                aria-disabled={tab.disabled || undefined}
                className={`flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-all duration-150 active:scale-[0.97] ${
                  active
                    ? "text-[var(--enterprise-primary)]"
                    : "text-[var(--enterprise-text-muted)] active:bg-[var(--enterprise-hover-surface)]"
                } ${tab.disabled ? "pointer-events-none opacity-40" : ""}`}
              >
                <Icon
                  className={`h-[22px] w-[22px] shrink-0 ${active ? "scale-105" : ""}`}
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                <span
                  className={`max-w-full truncate text-[11px] leading-tight ${active ? "font-semibold" : "font-medium opacity-80"}`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
