"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { EnterpriseSidebar } from "./EnterpriseSidebar";
import { EnterpriseTopBar } from "./EnterpriseTopBar";
import { QueryProvider } from "@/providers/QueryProvider";
import { EnterpriseWorkspaceProvider } from "./EnterpriseWorkspaceContext";
import { UploadProgressDock } from "./UploadProgressDock";

const SIDEBAR_STORAGE_KEY = "plansync-enterprise-sidebar-v1";

export function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const openPalette = useCallback(() => setCommandOpen(true), []);
  const closePalette = useCallback(() => setCommandOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((e) => {
      const next = !e;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "expanded" : "collapsed");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
      if (e.key === "Escape") setMobileNavOpen(false);
      if (e.key === "[" || e.key === "]") {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
        if (!window.matchMedia("(min-width: 1024px)").matches) return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

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

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed"
      ) {
        setSidebarExpanded(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <QueryProvider>
      <EnterpriseWorkspaceProvider>
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
            expanded={sidebarExpanded}
          />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:border-l lg:border-[var(--enterprise-border-subtle)]/80 lg:shadow-[var(--enterprise-shadow-inner)]">
            <EnterpriseTopBar
              onOpenCommandPalette={openPalette}
              onOpenMobileNav={openMobileNav}
              sidebarExpanded={sidebarExpanded}
              onToggleSidebar={toggleSidebar}
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
