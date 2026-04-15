"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const ENTERPRISE_SIDEBAR_COLLAPSED_KEY = "plansync-enterprise-sidebar-collapsed";
import { CommandPalette } from "./CommandPalette";
import { EnterpriseSidebar } from "./EnterpriseSidebar";
import { EnterpriseTopBar } from "./EnterpriseTopBar";
import { UserMenu } from "./UserMenu";
import { QueryProvider } from "@/providers/QueryProvider";
import { EnterpriseWorkspaceProvider } from "./EnterpriseWorkspaceContext";
import { ProjectSessionRedirect } from "./ProjectSessionRedirect";
import { UploadProgressDock } from "./UploadProgressDock";
import { DEFAULT_ENTERPRISE_PRIMARY_HEX } from "@/lib/enterpriseTheme";

export function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [sidebarPrefsReady, setSidebarPrefsReady] = useState(false);

  const openPalette = useCallback(() => setCommandOpen(true), []);
  const closePalette = useCallback(() => setCommandOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((o) => !o), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleDesktopSidebar = useCallback(() => {
    setDesktopSidebarCollapsed((c) => !c);
  }, []);

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(ENTERPRISE_SIDEBAR_COLLAPSED_KEY);
      setDesktopSidebarCollapsed(raw === "1");
    } catch {
      /* private mode / quota */
    }
    setSidebarPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!sidebarPrefsReady) return;
    try {
      localStorage.setItem(ENTERPRISE_SIDEBAR_COLLAPSED_KEY, desktopSidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [desktopSidebarCollapsed, sidebarPrefsReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
      if (e.key === "Escape") setMobileNavOpen(false);

      if (e.key === "[" || e.key === "]") {
        const el = e.target;
        if (
          el instanceof HTMLElement &&
          (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
        ) {
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const mq = window.matchMedia("(min-width: 1024px)");
        if (!mq.matches) return;
        e.preventDefault();
        setDesktopSidebarCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverflowX = document.body.style.overflowX;
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overflowX = prevOverflowX;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const isWorkspaceGate = pathname === "/workspaces";

  return (
    <QueryProvider>
      <EnterpriseWorkspaceProvider>
        <ProjectSessionRedirect />
        {isWorkspaceGate ? (
          <div
            className="flex h-dvh min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[var(--enterprise-bg)] text-[var(--enterprise-text)]"
            style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}
          >
            <header className="flex h-[var(--enterprise-topbar-h)] shrink-0 items-center justify-between gap-3 border-b border-[var(--enterprise-border)]/80 bg-[color-mix(in_srgb,var(--enterprise-surface)_88%,transparent)] px-4 shadow-[0_1px_0_0_rgba(255,255,255,0.72)_inset] backdrop-blur-xl sm:px-6">
              <Link
                href="/projects"
                className="select-none text-[15px] font-bold tracking-tight text-[var(--enterprise-text)]"
              >
                Plan<span style={{ color: DEFAULT_ENTERPRISE_PRIMARY_HEX }}>Sync</span>
              </Link>
              <UserMenu />
            </header>
            <main className="enterprise-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none">
              <div className="enterprise-main-inner min-h-full min-w-0 max-w-full">{children}</div>
            </main>
            <CommandPalette open={commandOpen} onClose={closePalette} />
            <UploadProgressDock />
          </div>
        ) : (
          <div
            className="flex h-dvh min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[var(--enterprise-bg)] text-[var(--enterprise-text)] lg:flex-row"
            style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}
          >
            {mobileNavOpen && (
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-30 bg-[#0c1222]/50 backdrop-blur-sm lg:hidden"
                onClick={closeMobileNav}
              />
            )}
            <EnterpriseSidebar
              mobileOpen={mobileNavOpen}
              onCloseMobile={closeMobileNav}
              desktopCollapsed={desktopSidebarCollapsed}
            />
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:border-l lg:border-[var(--enterprise-border-subtle)]/80 lg:shadow-[var(--enterprise-shadow-inner)]">
              <EnterpriseTopBar
                onOpenCommandPalette={openPalette}
                onToggleMobileNav={toggleMobileNav}
                mobileNavOpen={mobileNavOpen}
                desktopSidebarCollapsed={desktopSidebarCollapsed}
                onToggleDesktopSidebar={toggleDesktopSidebar}
              />
              <main className="enterprise-scrollbar enterprise-main-canvas min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none">
                <div className="enterprise-main-inner min-h-full min-w-0 max-w-full">
                  {children}
                </div>
              </main>
            </div>
            <CommandPalette open={commandOpen} onClose={closePalette} />
            <UploadProgressDock />
          </div>
        )}
      </EnterpriseWorkspaceProvider>
    </QueryProvider>
  );
}
