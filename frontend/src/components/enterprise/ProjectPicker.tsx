"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, Check, Building2, LayoutGrid } from "lucide-react";
import { ProjectLogo } from "./ProjectLogo";
import { useProjectNavHref } from "./useProjectNavHref";
import { setLastProjectId } from "@/lib/lastProject";
import Link from "next/link";

const MENU_WIDTH = 280;

function clampMenuLeft(left: number, menuWidth: number): number {
  if (typeof window === "undefined") return left;
  const pad = 12;
  const maxLeft = window.innerWidth - menuWidth - pad;
  return Math.max(pad, Math.min(left, maxLeft));
}

function menuWidthForViewport(): number {
  if (typeof window === "undefined") return MENU_WIDTH;
  return Math.min(MENU_WIDTH, Math.max(240, window.innerWidth - 24));
}

export function ProjectPicker() {
  const router = useRouter();
  const { projects, activeProject } = useProjectNavHref();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const q = search.toLowerCase();
  const filteredProjects = projects.filter((p) => {
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    const num = p.projectNumber?.toLowerCase() ?? "";
    return num.includes(q);
  });

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = menuWidthForViewport();
    setMenuPos({
      top: r.bottom + 6,
      left: clampMenuLeft(r.left, width),
      width,
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    const onMove = () => updateMenuPosition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (dropdownRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleSelect = (id: string) => {
    setLastProjectId(id);
    setIsOpen(false);
    setSearch("");
    router.push(`/projects/${id}`);
  };

  const menu =
    isOpen && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="enterprise-shadow-floating fixed z-[200] rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-1.5 shadow-[var(--enterprise-shadow-floating)]"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <div className="relative mb-1.5 px-2 pt-1">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--enterprise-text-muted)]" />
              <input
                autoFocus
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border-none bg-[var(--enterprise-bg)] pl-9 pr-3 text-[13px] text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]/60 focus:ring-2 focus:ring-[var(--enterprise-primary)]/25"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto px-1">
              <div className="mb-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--enterprise-text-muted)]/60">
                Projects
              </div>
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelect(project.id)}
                    className={`group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] transition-colors ${
                      activeProject?.id === project.id
                        ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]"
                        : "text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
                    }`}
                  >
                    <ProjectLogo
                      name={project.name}
                      logoUrl={project.logoUrl}
                      size={32}
                      className={
                        activeProject?.id === project.id
                          ? "border-[var(--enterprise-primary)]/25 shadow-sm"
                          : ""
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{project.name}</div>
                      <div className="truncate text-[11px] text-[var(--enterprise-text-muted)]">
                        {project.projectNumber?.trim()
                          ? `#${project.projectNumber}`
                          : project.projectType?.trim() || "—"}
                      </div>
                    </div>
                    {activeProject?.id === project.id && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                ))
              ) : (
                <div className="px-2 py-8 text-center text-[13px] text-[var(--enterprise-text-muted)]">
                  No projects found
                </div>
              )}
            </div>

            <div className="mt-1.5 border-t border-[var(--enterprise-border)]/60 p-1">
              <Link
                href="/projects"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                View all projects
              </Link>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative min-w-0 flex-1 sm:w-[260px] sm:flex-none sm:shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen((o) => !o);
        }}
        className="flex h-9 w-full min-w-0 max-w-full items-center justify-between gap-1.5 rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/95 px-2.5 text-[13px] font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30 sm:w-[260px] sm:max-w-[260px] sm:gap-2 sm:px-3 sm:text-[13.5px]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {activeProject ? (
            <ProjectLogo name={activeProject.name} logoUrl={activeProject.logoUrl} size={22} />
          ) : (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
              <Building2 className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="min-w-0 flex-1 truncate text-left">
            {activeProject?.name ?? "Select project"}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}
