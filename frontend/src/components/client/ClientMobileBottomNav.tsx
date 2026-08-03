"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, FileStack, LayoutGrid, MapPin } from "lucide-react";
import { hapticTap } from "@/lib/haptic";

type Tab = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export function ClientMobileBottomNav({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_-16px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:hidden"
      aria-label="Client portal navigation"
      style={{ height: "var(--enterprise-bottomnav-offset)" }}
    >
      <ul className="flex h-[var(--enterprise-bottomnav-h)] items-stretch justify-around px-1">
        {tabs.slice(0, 5).map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.id} className="flex min-w-0 flex-1">
              <Link
                href={tab.href}
                onClick={(e) => {
                  hapticTap();
                  if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                    e.preventDefault();
                    router.push(tab.href, { scroll: false });
                  }
                }}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-all duration-150 active:scale-[0.97] ${
                  active ? "text-blue-600" : "text-slate-500 active:bg-slate-100"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
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

export const CLIENT_TAB_ICONS = {
  drawings: FileStack,
  issues: MapPin,
  reports: ClipboardList,
  proposals: LayoutGrid,
} as const;
