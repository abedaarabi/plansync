"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { pathAfterWorkspaceSwitch, workspaceGateUrl } from "@/lib/workspacePreference";

export function WorkspaceSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { me, primary, setActiveWorkspaceId } = useEnterpriseWorkspace();
  const list = me?.workspaces ?? [];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (list.length < 2 || !primary) return null;

  const currentId = primary.workspace.id;
  const label = primary.workspace.name?.trim() || "Workspace";

  function onPick(workspaceId: string) {
    if (workspaceId === currentId) {
      setOpen(false);
      return;
    }
    setActiveWorkspaceId(workspaceId);
    setOpen(false);
    router.push(pathAfterWorkspaceSwitch(pathname, workspaceId));
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[10rem] items-center gap-1 rounded-lg border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/95 px-2 py-1.5 text-left text-[12px] font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25 sm:max-w-[14rem] sm:gap-1.5 sm:px-2.5 sm:py-2 sm:text-[13px]"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Current workspace: ${label}. Change workspace.`}
      >
        <Building2
          className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] sm:h-4 sm:w-4"
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Workspaces"
          className="fixed left-2 right-2 top-[calc(var(--enterprise-topbar-offset,3.5rem)+0.25rem)] z-[100] max-h-[min(20rem,60vh)] overflow-y-auto rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-[var(--enterprise-shadow-floating)] sm:absolute sm:inset-x-auto sm:left-0 sm:right-auto sm:top-[calc(100%+6px)] sm:mt-0 sm:w-[min(calc(100vw-2rem),16rem)]"
        >
          {list.map((mw) => {
            const id = mw.workspace.id;
            const selected = id === currentId;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onPick(id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{mw.workspace.name}</span>
                  {mw.workspace.slug ? (
                    <span className="truncate text-xs text-[var(--enterprise-text-muted)]">
                      {mw.workspace.slug}
                    </span>
                  ) : null}
                </span>
                {selected ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
          <div className="border-t border-[var(--enterprise-border)] px-2 py-1.5">
            <Link
              href={workspaceGateUrl("/projects")}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2 text-center text-xs font-medium text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)]"
            >
              All workspaces…
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
