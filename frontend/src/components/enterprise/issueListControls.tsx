"use client";

/**
 * Shared filter-bar controls for issue-style list pages (issues, work orders,
 * tenant requests, RFIs): status chips, assignee select, sort select, and the
 * project → workspace members query wiring each list needs.
 */

import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { RotateCcw, SortAsc, Users } from "lucide-react";
import { fetchProject, fetchWorkspaceMembers, type WorkspaceMemberRow } from "@/lib/api-client";
import {
  OM_COMPACT_CHIP_ACTIVE,
  OM_COMPACT_CHIP_IDLE,
  OM_COMPACT_SELECT,
} from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";

export function useProjectWorkspaceMembers(projectId: string): {
  workspaceId: string | undefined;
  members: WorkspaceMemberRow[];
} {
  const { data: project } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
  const workspaceId = project?.workspaceId;
  const { data: membersRes } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  return { workspaceId, members: membersRes?.members ?? [] };
}

export type StatusChipDef<K extends string> = { key: K; label: string; Icon: LucideIcon };

export function StatusFilterChips<K extends string>({
  defs,
  value,
  onChange,
  filtersActive,
  onReset,
}: {
  defs: readonly StatusChipDef<K>[];
  value: K;
  onChange: (key: K) => void;
  filtersActive: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="mobile-chip-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Filter by status"
      >
        {defs.map((f) => {
          const TabIcon = f.Icon;
          const selected = value === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(f.key)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
                selected ? OM_COMPACT_CHIP_ACTIVE : OM_COMPACT_CHIP_IDLE
              }`}
              style={selected ? { backgroundColor: "var(--enterprise-primary)" } : undefined}
            >
              <TabIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {f.label}
            </button>
          );
        })}
      </div>
      {filtersActive ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
        >
          <RotateCcw className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
          Reset
        </button>
      ) : null}
    </div>
  );
}

const FIELD_LABEL_CLASS =
  "mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]";

export function AssigneeFilterSelect({
  id,
  value,
  onChange,
  members,
  className = "min-w-[9rem]",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  members: WorkspaceMemberRow[];
  className?: string;
}) {
  return (
    <label className={className}>
      <span className={FIELD_LABEL_CLASS}>
        <Users className="h-3.5 w-3.5" aria-hidden />
        Assignee
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={OM_COMPACT_SELECT}
      >
        <option value="ALL">All assignees</option>
        <option value="UNASSIGNED">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name || m.email || m.userId}
          </option>
        ))}
      </select>
    </label>
  );
}

export type SortSelectOption<K extends string> = { value: K; label: string };

export function SortSelect<K extends string>({
  id,
  value,
  onChange,
  options,
  className = "min-w-[9rem]",
}: {
  id: string;
  value: K;
  onChange: (value: K) => void;
  options: readonly SortSelectOption<K>[];
  className?: string;
}) {
  return (
    <label className={className}>
      <span className={FIELD_LABEL_CLASS}>
        <SortAsc className="h-3.5 w-3.5" aria-hidden />
        Sort
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as K)}
        className={OM_COMPACT_SELECT}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
