"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const ENTERPRISE_SIDEBAR_COLLAPSED_KEY = "plansync-enterprise-sidebar-collapsed";
import { CommandPalette } from "./CommandPalette";
import { EnterpriseSidebar } from "./EnterpriseSidebar";
import { EnterpriseTopBar } from "./EnterpriseTopBar";
import { QueryProvider } from "@/providers/QueryProvider";
import { EnterpriseWorkspaceProvider } from "./EnterpriseWorkspaceContext";
import { ProjectSessionRedirect } from "./ProjectSessionRedirect";
import { UploadProgressDock } from "./UploadProgressDock";

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

  useEffect(() => {
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <QueryProvider>
      <EnterpriseWorkspaceProvider>
        <ProjectSessionRedirect />
        <div
          className="flex h-dvh min-h-0 w-full flex-col bg-[var(--enterprise-bg)] text-[var(--enterprise-text)] lg:flex-row"
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
            <main className="enterprise-scrollbar enterprise-main-canvas min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="enterprise-main-inner min-h-full">{children}</div>
            </main>
          </div>
          <CommandPalette open={commandOpen} onClose={closePalette} />
          <UploadProgressDock />
        </div>
      </EnterpriseWorkspaceProvider>
    </QueryProvider>
  );
}
