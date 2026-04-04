"use client";

import { apiUrl } from "@/lib/api-url";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter, ScrollText, Search, UserRound, X } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { toast } from "sonner";
import { userInitials } from "@/lib/user-initials";
import { qk } from "@/lib/queryKeys";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

/** Stable across Node SSR and browser so audit “When” cells don’t hydration-mismatch. */
const AUDIT_WHEN_FMT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatAuditWhen(iso: string) {
  return AUDIT_WHEN_FMT.format(new Date(iso));
}

type AuditRow = {
  id: string;
  type: string;
  createdAt: string;
  actor: { id: string; name: string; email: string; image: string | null } | null;
  metadata: unknown;
  actionLabel: string;
  summary: string;
  detail: string;
};

type AuditCategory = "all" | "files" | "coordination" | "project";
type DatePreset = "all" | "24h" | "7d" | "30d" | "90d";

/** `all` | `__none__` (no actor) | user id */
type UserFilter = string;

function rowCategory(type: string): Exclude<AuditCategory, "all"> {
  const t = type.toUpperCase();
  if (t.startsWith("FILE_") || t.startsWith("FOLDER_")) {
    return "files";
  }
  if (
    t.startsWith("ISSUE_") ||
    t.startsWith("RFI_") ||
    t.startsWith("PUNCH_") ||
    t.startsWith("FIELD_REPORT_")
  ) {
    return "coordination";
  }
  if (t.startsWith("PROJECT_")) return "project";
  return "coordination";
}

function dateCutoff(preset: DatePreset): Date | null {
  if (preset === "all") return null;
  const d = new Date();
  if (preset === "24h") {
    d.setTime(d.getTime() - 24 * 60 * 60 * 1000);
    return d;
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function matchesSearch(row: AuditRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const label = (row.actionLabel || row.type.replace(/_/g, " ")).toLowerCase();
  const summary = (row.summary ?? "").toLowerCase();
  const detail = (row.detail ?? "").toLowerCase();
  const actor = `${row.actor?.name ?? ""} ${row.actor?.email ?? ""}`.toLowerCase();
  return (
    label.includes(s) ||
    summary.includes(s) ||
    detail.includes(s) ||
    row.type.toLowerCase().includes(s) ||
    actor.includes(s)
  );
}

function filterRows(
  rows: AuditRow[],
  q: string,
  category: AuditCategory,
  datePreset: DatePreset,
  userFilter: UserFilter,
): AuditRow[] {
  const cutoff = dateCutoff(datePreset);
  return rows.filter((row) => {
    if (cutoff && new Date(row.createdAt) < cutoff) return false;
    if (category !== "all" && rowCategory(row.type) !== category) return false;
    if (userFilter !== "all") {
      if (userFilter === "__none__") {
        if (row.actor != null) return false;
      } else if (row.actor?.id !== userFilter) {
        return false;
      }
    }
    if (!matchesSearch(row, q)) return false;
    return true;
  });
}

function buildActorOptions(items: AuditRow[]) {
  const map = new Map<string, { id: string; name: string; email: string }>();
  let hasNoActor = false;
  for (const row of items) {
    if (!row.actor) {
      hasNoActor = true;
      continue;
    }
    if (!map.has(row.actor.id)) {
      map.set(row.actor.id, {
        id: row.actor.id,
        name: row.actor.name,
        email: row.actor.email,
      });
    }
  }
  const actors = [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  return { actors, hasNoActor };
}

export function ProjectAuditClient({ projectId, subhead }: { projectId: string; subhead: string }) {
  const { primary } = useEnterpriseWorkspace();
  const isAdmin = primary?.role === "ADMIN" || primary?.role === "SUPER_ADMIN";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AuditCategory>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");

  const { data, isPending, error } = useQuery({
    queryKey: qk.projectAudit(projectId),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/audit-logs?limit=200`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not load audit log");
      return res.json() as Promise<{
        projectName: string;
        items: AuditRow[];
      }>;
    },
  });

  async function downloadFormat(format: "xlsx" | "pdf") {
    const res = await fetch(
      apiUrl(`/api/v1/projects/${projectId}/audit-logs/export?format=${format}`),
      {
        credentials: "include",
      },
    );
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? "Download failed");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base =
      (data?.projectName ?? "project").replace(/[^\w\- ]+/g, "").slice(0, 60) || "project";
    a.download = `${base}-audit.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const items = data?.items;
  const actorOptions = useMemo(() => buildActorOptions(items ?? []), [items]);

  const filtered = useMemo(
    () => filterRows(items ?? [], search, category, datePreset, userFilter),
    [items, search, category, datePreset, userFilter],
  );
  const totalLoaded = items?.length ?? 0;

  const hasActiveFilters =
    search.trim() !== "" || category !== "all" || datePreset !== "all" || userFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setDatePreset("all");
    setUserFilter("all");
  }

  return (
    <div className="enterprise-animate-in mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col gap-3 border-b border-slate-200/80 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-xl">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
              aria-hidden
            >
              <ScrollText className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
            </span>
            <span>Project audit log</span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
            {subhead}
          </p>
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() =>
                void downloadFormat("xlsx").catch((e: Error) => toast.error(e.message))
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4 shrink-0" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => void downloadFormat("pdf").catch((e: Error) => toast.error(e.message))}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              <Download className="h-4 w-4 shrink-0" />
              PDF
            </button>
          </div>
        ) : null}
      </header>

      <section
        className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-white shadow-[var(--enterprise-shadow-xs)]"
        aria-label="Audit events"
      >
        {isPending ? (
          <div className="flex min-h-[min(320px,50vh)] flex-1 items-center justify-center px-4 py-12">
            <EnterpriseLoadingState
              variant="minimal"
              message="Loading audit log…"
              label="Loading audit log"
            />
          </div>
        ) : error ? (
          <p className="p-6 text-center text-sm text-red-600">{(error as Error).message}</p>
        ) : totalLoaded === 0 ? (
          <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
            No project-scoped events yet. Opens from the viewer, uploads, moves, and deletes will
            appear here.
          </p>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-3 py-3 sm:px-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Filter className="h-4 w-4 text-slate-500" aria-hidden />
                  Filters
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Search
                  </span>
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Summary, details, user…"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--enterprise-primary)]/40 focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                    />
                  </span>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Category
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AuditCategory)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none focus:border-[var(--enterprise-primary)]/40 focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                  >
                    <option value="all">All categories</option>
                    <option value="files">Files &amp; folders</option>
                    <option value="coordination">Issues, RFIs, punch &amp; reports</option>
                    <option value="project">Project</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                    User
                  </span>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none focus:border-[var(--enterprise-primary)]/40 focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                  >
                    <option value="all">All users</option>
                    {actorOptions.hasNoActor ? (
                      <option value="__none__">No user (system)</option>
                    ) : null}
                    {actorOptions.actors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.email ? ` — ${a.email}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Time range
                  </span>
                  <select
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none focus:border-[var(--enterprise-primary)]/40 focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                  >
                    <option value="all">All time</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-500" role="status" aria-live="polite">
                Showing{" "}
                <span className="font-semibold tabular-nums text-slate-700">{filtered.length}</span>{" "}
                of {totalLoaded} loaded events
                {hasActiveFilters && filtered.length === 0 ? " — try adjusting filters." : null}
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
                No events match your filters.
                {hasActiveFilters ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="font-medium text-[var(--enterprise-primary)] hover:underline"
                    >
                      Clear filters
                    </button>
                  </>
                ) : null}
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Desktop / tablet */}
                <div className="hidden min-h-0 flex-1 overflow-auto md:block">
                  <table className="w-full min-w-[600px] table-fixed text-left text-[13px]">
                    <colgroup>
                      <col className="w-[10.5rem]" />
                      <col className="w-[7rem]" />
                      <col />
                      <col className="w-[min(13rem,20%)]" />
                      <col className="w-[min(17rem,26%)]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                      <tr>
                        <th className="py-2.5 pl-4 pr-2">When</th>
                        <th className="py-2.5 pr-2">Action</th>
                        <th className="py-2.5 pr-2">Summary</th>
                        <th className="py-2.5 pr-2">User</th>
                        <th className="py-2.5 pr-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((row) => {
                        const label = row.actionLabel || row.type.replace(/_/g, " ").toLowerCase();
                        const summary = row.summary ?? "—";
                        const detail = row.detail ?? "—";
                        return (
                          <tr
                            key={row.id}
                            className="align-top transition-colors hover:bg-slate-50/90"
                          >
                            <td className="whitespace-nowrap py-2.5 pl-4 text-xs text-slate-600">
                              {formatAuditWhen(row.createdAt)}
                            </td>
                            <td className="py-2.5 pr-2">
                              <span className="inline-flex max-w-full rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium leading-tight text-slate-800">
                                {label}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-[13px] text-slate-800">
                              <span className="line-clamp-2">{summary}</span>
                            </td>
                            <td className="py-2.5 pr-2 text-slate-600">
                              {row.actor ? (
                                <div className="flex items-start gap-2">
                                  <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-blue-100 to-slate-100 text-[10px] font-semibold text-slate-800">
                                    {row.actor.image ? (
                                      // eslint-disable-next-line @next/next/no-img-element -- profile URL from API
                                      <img
                                        src={row.actor.image}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      userInitials(row.actor.name, row.actor.email)
                                    )}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-xs font-medium text-slate-800">
                                      {row.actor.name}
                                    </span>
                                    <span className="block truncate text-[11px] text-slate-500">
                                      {row.actor.email}
                                    </span>
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-xs leading-snug text-slate-600">
                              <span className="line-clamp-3">{detail}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="min-h-0 flex-1 space-y-3 overflow-auto p-3 md:hidden">
                  {filtered.map((row) => {
                    const label = row.actionLabel || row.type.replace(/_/g, " ").toLowerCase();
                    const summary = row.summary ?? "—";
                    const detail = row.detail ?? "—";
                    return (
                      <li key={row.id}>
                        <article className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span className="inline-flex max-w-[85%] rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-800">
                              {label}
                            </span>
                            <time
                              className="shrink-0 text-xs tabular-nums text-slate-500"
                              dateTime={row.createdAt}
                            >
                              {formatAuditWhen(row.createdAt)}
                            </time>
                          </div>
                          <p className="mt-2 text-sm font-medium leading-snug text-slate-900">
                            {summary}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{detail}</p>
                          {row.actor ? (
                            <div className="mt-3 flex items-center gap-2.5 border-t border-slate-100 pt-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-blue-100 to-slate-100 text-[11px] font-semibold text-slate-800">
                                {row.actor.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={row.actor.image}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  userInitials(row.actor.name, row.actor.email)
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {row.actor.name}
                                </p>
                                <p className="truncate text-xs text-slate-500">{row.actor.email}</p>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
