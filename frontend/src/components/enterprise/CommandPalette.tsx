"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  ClipboardCheck,
  FileStack,
  LayoutDashboard,
  MessageSquareQuote,
  Package,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { useProjectNavHref } from "./useProjectNavHref";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

type Cmd = { id: string; label: string; hint?: string; href: string; icon: typeof LayoutDashboard };

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const { hrefFor } = useProjectNavHref();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo((): Cmd[] => {
    return [
      {
        id: "dash",
        label: "Go to Dashboard",
        hint: "Overview & KPIs",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        id: "account",
        label: "Account",
        hint: "Profile & sign out",
        href: "/account",
        icon: UserRound,
      },
      {
        id: "org",
        label: "Organization",
        hint: "Branding & invites",
        href: "/organization",
        icon: Building2,
      },
      {
        id: "projects",
        label: "Projects",
        hint: "PDFs & folders",
        href: "/projects",
        icon: FileStack,
      },
      {
        id: "invite-member",
        label: "Invite member",
        hint: "Email invites & seats",
        href: "/organization?tab=invite-member",
        icon: Users,
      },
      {
        id: "materials",
        label: "Materials database",
        hint: "Catalog, Excel import",
        href: wid ? `/workspaces/${wid}/materials` : "#",
        icon: Package,
      },
      {
        id: "rfi",
        label: "Open RFIs",
        hint: "Requests for information",
        href: hrefFor("rfi"),
        icon: MessageSquareQuote,
      },
      {
        id: "punch",
        label: "Open Punch List",
        hint: "Field punch items",
        href: hrefFor("punch"),
        icon: ClipboardCheck,
      },
      {
        id: "reports",
        label: "Open Field Reports",
        hint: "Daily logs & photos",
        href: hrefFor("reports"),
        icon: ClipboardList,
      },
    ];
  }, [hrefFor, wid]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(s) || (c.hint && c.hint.toLowerCase().includes(s)),
    );
  }, [q, commands]);

  const run = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
      setQ("");
      setIdx(0);
    },
    [router, onClose],
  );

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
    setQ("");
    setIdx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onNav = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter" && filtered[idx]) {
        e.preventDefault();
        run(filtered[idx].href);
      }
    };
    window.addEventListener("keydown", onNav);
    return () => window.removeEventListener("keydown", onNav);
  }, [open, filtered, idx, run]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-[#0c1222]/55 pt-[min(16vh,140px)] backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label="Command palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="enterprise-animate-in w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/95 shadow-[var(--enterprise-shadow-floating)] backdrop-blur-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/40 px-4 py-3">
          <Search
            className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
          />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            placeholder="Search commands…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]"
          />
          <kbd className="hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--enterprise-text-muted)] sm:inline">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[min(52vh,420px)] overflow-y-auto p-2 enterprise-scrollbar">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
              No matches
            </li>
          )}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            const active = i === idx;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => run(c.href)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-text)] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]"
                      : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.label}</span>
                    {c.hint && (
                      <span className="block text-xs text-[var(--enterprise-text-muted)]">
                        {c.hint}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/35 px-4 py-2.5 text-[10px] font-medium text-[var(--enterprise-text-muted)]">
          <span className="opacity-90">Navigate with ↑↓ · Enter to run</span>
        </div>
      </div>
    </div>
  );
}
