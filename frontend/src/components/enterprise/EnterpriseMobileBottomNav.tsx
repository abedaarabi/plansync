"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEnterpriseMobileNav } from "@/hooks/useEnterpriseMobileNav";
import { hapticTap } from "@/lib/haptic";

type EnterpriseMobileBottomNavProps = {
  onOpenMore: () => void;
};

/**
 * Primary mobile navigation — solid tab bar (no glass), field-tool hierarchy.
 */
export function EnterpriseMobileBottomNav({ onOpenMore }: EnterpriseMobileBottomNavProps) {
  const router = useRouter();
  const { tabs, isTabActive } = useEnterpriseMobileNav();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
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
                  className="flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[var(--enterprise-text-muted)] transition-colors active:bg-[var(--enterprise-hover-surface)]"
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="max-w-full truncate text-[10px] font-medium leading-tight tracking-tight">
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
                className={`flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 transition-colors ${
                  active
                    ? "text-[var(--enterprise-primary)]"
                    : "text-[var(--enterprise-text-muted)] active:bg-[var(--enterprise-hover-surface)]"
                } ${tab.disabled ? "pointer-events-none opacity-40" : ""}`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span
                  className={`max-w-full truncate text-[10px] leading-tight tracking-tight ${active ? "font-semibold" : "font-medium"}`}
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
