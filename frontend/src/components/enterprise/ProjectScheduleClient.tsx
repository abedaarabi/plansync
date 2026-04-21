"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChartGantt,
  ChevronDown,
  ChevronRight,
  Link2,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  fetchProjectSchedule,
  fetchProjectSession,
  fetchTakeoffLinesForProject,
  ProRequiredError,
  putProjectSchedule,
  type ScheduleTaskStatus,
  type ScheduleTaskInput,
  type ScheduleTaskRow,
  type TakeoffLineRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseAddPulseWrap } from "@/components/enterprise/EnterpriseAddPulseWrap";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { AccessRestricted } from "@/components/enterprise/AccessRestricted";
import { useTaskCreation } from "@/components/enterprise/useTaskCreation";

type Props = { projectId: string };

const AUTOSAVE_MS = 900;
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMELINE_PX_PER_DAY = 8;
const TIMELINE_MIN_WIDTH_PX = 720;
const TIMELINE_MAX_WIDTH_PX = 28000;

const STATUS_OPTIONS: { value: ScheduleTaskStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
];

const SCHEDULE_BTN_SECONDARY =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-surface)] disabled:cursor-not-allowed disabled:opacity-60";

const SCHEDULE_BTN_PRIMARY =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--enterprise-primary-deep)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-surface)] disabled:cursor-not-allowed disabled:opacity-60";

const SCHEDULE_ICON_BTN =
  "cursor-pointer rounded p-1 text-[var(--enterprise-text-muted)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] hover:text-[var(--enterprise-text)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]";

function normalizeStatus(status: string | null | undefined): ScheduleTaskStatus {
  if (status === "in_progress") return "in_progress";
  if (status === "delayed") return "delayed";
  if (status === "completed") return "completed";
  return "not_started";
}

function statusPalette(status: ScheduleTaskStatus): {
  barBg: string;
  progressBg: string;
  pillBg: string;
  pillText: string;
} {
  switch (status) {
    case "completed":
      return {
        barBg: "bg-emerald-500/85",
        progressBg: "bg-emerald-300/95",
        pillBg: "bg-emerald-100",
        pillText: "text-emerald-700",
      };
    case "delayed":
      return {
        barBg: "bg-rose-500/85",
        progressBg: "bg-rose-300/95",
        pillBg: "bg-rose-100",
        pillText: "text-rose-700",
      };
    case "in_progress":
      return {
        barBg: "bg-blue-500/85",
        progressBg: "bg-blue-300/95",
        pillBg: "bg-blue-100",
        pillText: "text-blue-700",
      };
    case "not_started":
    default:
      return {
        barBg: "bg-slate-400/85",
        progressBg: "bg-slate-200/95",
        pillBg: "bg-slate-200",
        pillText: "text-slate-700",
      };
  }
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={`h-1 w-full overflow-hidden rounded-full bg-[var(--enterprise-border)]/80 ${className ?? ""}`}
      aria-label={`Progress ${clamped}%`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div
        className="h-full rounded-full bg-[var(--enterprise-primary)] transition-[width] duration-150"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
}

function makeRow(partial?: Partial<ScheduleTaskInput>): ScheduleTaskInput {
  const start = new Date();
  const end = addDays(start, 14);
  return {
    id: nanoid(),
    title: partial?.title ?? "New task",
    parentId: partial?.parentId ?? null,
    sortOrder: partial?.sortOrder ?? 0,
    startDate: partial?.startDate ?? toYmd(start),
    endDate: partial?.endDate ?? toYmd(end),
    isMilestone: partial?.isMilestone ?? false,
    progressPercent: partial?.progressPercent ?? 0,
    status: partial?.status ?? "not_started",
    takeoffLineIds: partial?.takeoffLineIds ?? [],
  };
}

function normalizeTaskTitle(title: string): string {
  const t = title.trim();
  return t.length > 0 ? t : "Untitled task";
}

function normalizeTasksForSave(tasks: ScheduleTaskInput[]): ScheduleTaskInput[] {
  return tasks.map((t) => ({
    ...t,
    title: normalizeTaskTitle(t.title),
  }));
}

function sortForDisplay(tasks: ScheduleTaskInput[]): ScheduleTaskInput[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const childrenByParent = new Map<string | null, ScheduleTaskInput[]>();
  for (const task of tasks) {
    const parentKey = task.parentId && byId.has(task.parentId) ? task.parentId : null;
    const arr = childrenByParent.get(parentKey) ?? [];
    arr.push(task);
    childrenByParent.set(parentKey, arr);
  }
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  const out: ScheduleTaskInput[] = [];
  const visited = new Set<string>();

  function walk(parentId: string | null) {
    const kids = childrenByParent.get(parentId) ?? [];
    for (const kid of kids) {
      if (visited.has(kid.id)) continue;
      visited.add(kid.id);
      out.push(kid);
      walk(kid.id);
    }
  }

  walk(null);
  return out;
}

function timelineRange(tasks: ScheduleTaskInput[]): { min: Date; max: Date } {
  const today = new Date();
  if (tasks.length === 0) {
    return { min: addDays(today, -7), max: addDays(today, 28) };
  }
  let minT = parseYmd(tasks[0].startDate).getTime();
  let maxT = parseYmd(tasks[0].endDate).getTime();
  for (const x of tasks) {
    minT = Math.min(minT, parseYmd(x.startDate).getTime());
    maxT = Math.max(maxT, parseYmd(x.endDate).getTime());
  }
  return { min: addDays(new Date(minT), -4), max: addDays(new Date(maxT), 4) };
}

function barLayout(
  start: Date,
  end: Date,
  min: Date,
  max: Date,
): { leftPct: number; widthPct: number } {
  const span = Math.max(1, max.getTime() - min.getTime());
  const s = Math.max(min.getTime(), start.getTime());
  const e = Math.min(max.getTime(), end.getTime());
  const left = ((s - min.getTime()) / span) * 100;
  const width = Math.max(0.5, ((e - s) / span) * 100);
  return { leftPct: left, widthPct: width };
}

function snapToLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Map horizontal position on the timeline to a calendar date. */
function clientXToDate(clientX: number, rect: DOMRect, min: Date, max: Date): Date {
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const span = Math.max(1, max.getTime() - min.getTime());
  const t = min.getTime() + (x / rect.width) * span;
  return new Date(t);
}

type GanttDragState =
  | {
      kind: "resize-left" | "resize-right";
      taskId: string;
      pointerId: number;
      rowEl: HTMLElement;
    }
  | {
      kind: "move";
      taskId: string;
      pointerId: number;
      rowEl: HTMLElement;
      originClientX: number;
      origStart: Date;
      origEnd: Date;
    };

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Month bands for the top header row (proportional to calendar time). */
function monthBands(min: Date, max: Date): { leftPct: number; widthPct: number; label: string }[] {
  const span = Math.max(1, max.getTime() - min.getTime());
  const bands: { leftPct: number; widthPct: number; label: string }[] = [];
  let cur = new Date(min.getFullYear(), min.getMonth(), 1);
  const endT = max.getTime();
  while (cur.getTime() < endT) {
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const segStart = Math.max(monthStart.getTime(), min.getTime());
    const segEnd = Math.min(nextMonth.getTime(), max.getTime());
    if (segEnd > segStart) {
      bands.push({
        leftPct: ((segStart - min.getTime()) / span) * 100,
        widthPct: ((segEnd - segStart) / span) * 100,
        label: monthStart.toLocaleString(undefined, { month: "short", year: "numeric" }),
      });
    }
    cur = nextMonth;
  }
  if (bands.length === 0) {
    bands.push({
      leftPct: 0,
      widthPct: 100,
      label: min.toLocaleString(undefined, { month: "short", year: "numeric" }),
    });
  }
  return bands;
}

/** Vertical grid at each week start (Monday), with label position. */
function weekGrid(min: Date, max: Date): { leftPct: number }[] {
  const span = Math.max(1, max.getTime() - min.getTime());
  const out: { leftPct: number }[] = [];
  let w = startOfWeekMonday(min);
  while (w.getTime() < min.getTime()) w = addDays(w, 7);
  const endT = max.getTime();
  let guard = 0;
  while (w.getTime() <= endT && guard++ < 104) {
    const leftPct = ((w.getTime() - min.getTime()) / span) * 100;
    out.push({ leftPct });
    w = addDays(w, 7);
  }
  return out;
}

function todayLinePct(min: Date, max: Date): number | null {
  const now = new Date();
  const t = now.getTime();
  if (t < min.getTime() || t > max.getTime()) return null;
  const span = Math.max(1, max.getTime() - min.getTime());
  return ((t - min.getTime()) / span) * 100;
}

function SubtaskTreeConnector({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  const lane = 14;
  const elbowLeft = (depth - 1) * lane + 6;
  return (
    <div className="pointer-events-none relative h-6 shrink-0" style={{ width: depth * lane + 16 }}>
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-y-0 border-l border-[var(--enterprise-border)]"
          style={{ left: i * lane + 6 }}
          aria-hidden
        />
      ))}
      <div
        className="absolute top-1/2 h-px w-3 -translate-y-1/2 border-t border-[var(--enterprise-border)]"
        style={{ left: elbowLeft }}
        aria-hidden
      />
    </div>
  );
}

function rowToInput(r: ScheduleTaskRow): ScheduleTaskInput {
  return {
    id: r.id,
    title: r.title,
    parentId: r.parentId,
    sortOrder: r.sortOrder,
    startDate: r.startDate,
    endDate: r.endDate,
    isMilestone: r.isMilestone,
    progressPercent: r.progressPercent,
    status: normalizeStatus(r.status),
    takeoffLineIds: r.takeoffLineIds ?? [],
  };
}

function takeoffSummaryLabel(ids: string[], byId: Map<string, TakeoffLineRow>): string {
  if (ids.length === 0) return "Link takeoff";
  const names = ids
    .slice(0, 2)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r) => (r!.label?.trim() ? r!.label : (r!.material?.name ?? "Line")));
  if (ids.length <= 2) return names.join(", ") || `${ids.length} line(s)`;
  return `${names.join(", ")} +${ids.length - 2}`;
}

type TakeoffPickerProps = {
  open: boolean;
  onClose: () => void;
  lines: TakeoffLineRow[];
  selected: string[];
  onApply: (ids: string[]) => void;
};

function TakeoffLinksPicker({ open, onClose, lines, selected, onApply }: TakeoffPickerProps) {
  const [q, setQ] = useState("");
  const [local, setLocal] = useState<string[]>(selected);
  useEffect(() => {
    if (open) setLocal(selected);
  }, [open, selected]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return lines;
    return lines.filter((row) => {
      const blob = [row.label, row.material?.name, row.fileName, row.quantity, row.unit, row.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(t);
    });
  }, [lines, q]);

  if (!open) return null;

  function toggle(id: string) {
    setLocal((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="takeoff-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(560px,85vh)] w-full max-w-lg flex-col rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-lg">
        <div className="flex items-center justify-between border-b border-[var(--enterprise-border)] px-4 py-3">
          <h2
            id="takeoff-picker-title"
            className="text-sm font-semibold text-[var(--enterprise-text)]"
          >
            Link quantity takeoff lines
          </h2>
          <button type="button" className={SCHEDULE_ICON_BTN} onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-[var(--enterprise-border)] px-4 py-2">
          <input
            type="search"
            className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm text-[var(--enterprise-text)]"
            placeholder="Search label, material, sheet…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
              No takeoff lines match. Add quantities in Quantity Takeoff first.
            </li>
          ) : (
            filtered.map((row) => {
              const checked = local.includes(row.id);
              const primary = row.label?.trim() || row.material?.name || "Takeoff line";
              const sub = [row.fileName, row.quantity + " " + row.unit, row.material?.name]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={row.id}>
                  <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 hover:bg-[var(--enterprise-bg)]">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[var(--enterprise-primary)]"
                      checked={checked}
                      onChange={() => toggle(row.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--enterprise-text)]">
                        {primary}
                      </span>
                      <span className="block text-xs text-[var(--enterprise-text-muted)]">
                        {sub}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex justify-end gap-2 border-t border-[var(--enterprise-border)] px-4 py-3">
          <button type="button" className={SCHEDULE_BTN_SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={SCHEDULE_BTN_PRIMARY}
            onClick={() => {
              onApply(local);
              onClose();
            }}
          >
            Apply ({local.length})
          </button>
        </div>
      </div>
    </div>
  );
}

type TaskDetailPanelProps = {
  task: ScheduleTaskInput | null;
  onClose: () => void;
  onChange: (id: string, patch: Partial<ScheduleTaskInput>) => void;
  onAddSubtask: (parentId: string) => void;
};

function TaskDetailPanel({ task, onClose, onChange, onAddSubtask }: TaskDetailPanelProps) {
  if (!task) return null;
  return (
    <aside
      className="no-print fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-2xl"
      aria-hidden={false}
      aria-label="Task details"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--enterprise-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Task details</h2>
          <button
            type="button"
            className={SCHEDULE_ICON_BTN}
            onClick={onClose}
            aria-label="Close details panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          <label className="block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Name
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
              value={task.title}
              onChange={(e) => onChange(task.id, { title: e.target.value })}
              onBlur={(e) => onChange(task.id, { title: normalizeTaskTitle(e.target.value) })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Start
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
                value={task.startDate}
                onChange={(e) => onChange(task.id, { startDate: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              End
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-sm text-[var(--enterprise-text)]"
                value={task.endDate}
                onChange={(e) => onChange(task.id, { endDate: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Status
            <select
              className="mt-1 h-9 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-sm text-[var(--enterprise-text)]"
              value={normalizeStatus(task.status)}
              onChange={(e) => onChange(task.id, { status: normalizeStatus(e.target.value) })}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Progress ({Math.max(0, Math.min(100, Math.round(task.progressPercent)))}%)
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              className="mt-2 w-full accent-[var(--enterprise-primary)]"
              value={task.progressPercent}
              onChange={(e) => onChange(task.id, { progressPercent: Number(e.target.value) })}
            />
            <div className="mt-2">
              <ProgressBar value={task.progressPercent} />
            </div>
          </label>
          <button
            type="button"
            className={`${SCHEDULE_BTN_SECONDARY} bg-[var(--enterprise-bg)]`}
            onClick={() => onAddSubtask(task.id)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add subtask
          </button>
        </div>
      </div>
    </aside>
  );
}

export function ProjectScheduleClient({ projectId }: Props) {
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  const scheduleQuery = useQuery({
    queryKey: qk.projectSchedule(projectId),
    queryFn: () => fetchProjectSchedule(projectId),
    enabled: Boolean(session?.uiMode === "internal" && session.settings.modules.schedule !== false),
  });

  const takeoffEnabled = Boolean(session?.settings.modules.takeoff);
  const takeoffQuery = useQuery({
    queryKey: [...qk.projectSchedule(projectId), "takeoff-lines"],
    queryFn: () => fetchTakeoffLinesForProject(projectId),
    enabled: Boolean(
      session?.uiMode === "internal" && takeoffEnabled && session.settings.modules.schedule,
    ),
  });

  const takeoffById = useMemo(() => {
    const m = new Map<string, TakeoffLineRow>();
    for (const row of takeoffQuery.data ?? []) m.set(row.id, row);
    return m;
  }, [takeoffQuery.data]);

  const [draft, setDraft] = useState<ScheduleTaskInput[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const draftRef = useRef<ScheduleTaskInput[] | null>(null);
  draftRef.current = draft;
  const [saveUi, setSaveUi] = useState<"saved" | "saving" | "pending" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (scheduleQuery.data && !dirty) {
      setDraft(scheduleQuery.data.map(rowToInput));
    }
  }, [scheduleQuery.data, dirty]);

  const allRows = useMemo(() => (draft ? sortForDisplay(draft) : []), [draft]);
  const byId = useMemo(() => new Map(allRows.map((t) => [t.id, t])), [allRows]);
  const childCountByParent = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of allRows) {
      if (!t.parentId || !byId.has(t.parentId)) continue;
      m.set(t.parentId, (m.get(t.parentId) ?? 0) + 1);
    }
    return m;
  }, [allRows, byId]);
  const depthById = useMemo(() => {
    const out = new Map<string, number>();
    for (const task of allRows) {
      let depth = 0;
      let cur = task.parentId;
      const seen = new Set<string>();
      while (cur) {
        if (seen.has(cur)) break;
        seen.add(cur);
        const p = byId.get(cur);
        if (!p) break;
        depth += 1;
        cur = p.parentId;
      }
      out.set(task.id, depth);
    }
    return out;
  }, [allRows, byId]);
  const taskNumberById = useMemo(() => {
    const childrenByParent = new Map<string | null, ScheduleTaskInput[]>();
    for (const t of allRows) {
      const parentKey = t.parentId && byId.has(t.parentId) ? t.parentId : null;
      const arr = childrenByParent.get(parentKey) ?? [];
      arr.push(t);
      childrenByParent.set(parentKey, arr);
    }
    for (const arr of childrenByParent.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    }
    const out = new Map<string, string>();
    function walk(parentId: string | null, prefix: number[]) {
      const kids = childrenByParent.get(parentId) ?? [];
      kids.forEach((child, idx) => {
        const next = [...prefix, idx + 1];
        out.set(child.id, next.join("."));
        walk(child.id, next);
      });
    }
    walk(null, []);
    return out;
  }, [allRows, byId]);
  const rows = useMemo(() => {
    function isHiddenByCollapsed(task: ScheduleTaskInput): boolean {
      const seen = new Set<string>();
      let cur = task.parentId;
      while (cur) {
        if (seen.has(cur)) break;
        seen.add(cur);
        if (collapsedTaskIds.has(cur)) return true;
        cur = byId.get(cur)?.parentId ?? null;
      }
      return false;
    }
    return allRows.filter((t) => !isHiddenByCollapsed(t));
  }, [allRows, collapsedTaskIds, byId]);
  const range = useMemo(() => timelineRange(rows), [rows]);
  const timelineWidthPx = useMemo(() => {
    const days = Math.max(30, Math.ceil((range.max.getTime() - range.min.getTime()) / DAY_MS));
    return Math.min(
      TIMELINE_MAX_WIDTH_PX,
      Math.max(TIMELINE_MIN_WIDTH_PX, days * TIMELINE_PX_PER_DAY),
    );
  }, [range]);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const dragStateRef = useRef<GanttDragState | null>(null);

  const saveMutation = useMutation({
    mutationFn: (tasks: ScheduleTaskInput[]) =>
      putProjectSchedule(projectId, { tasks: normalizeTasksForSave(tasks) }),
    onMutate: () => {
      setSaveUi((prev) => (prev === "saving" ? prev : "saving"));
    },
    onSuccess: async (saved, variables) => {
      // Guard against race conditions: if user edited again while this request was in flight,
      // ignore stale response data so we don't clobber newer local changes.
      if (draftRef.current !== variables) {
        setSaveUi((prev) => (prev === "saving" ? "pending" : prev));
        return;
      }
      setDirty(false);
      setDraft(saved.map(rowToInput));
      setSaveUi("saved");
      setLastSavedAt(new Date());
      queryClient.setQueryData(qk.projectSchedule(projectId), saved);
    },
    onError: (e: unknown) => {
      setSaveUi("error");
      if (e instanceof ProRequiredError) {
        toast.error("PlanSync Pro is required for the construction schedule.");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not save schedule");
    },
  });

  useEffect(() => {
    if (!dirty || draft === null) return;
    const t = window.setTimeout(() => {
      const payload = draftRef.current;
      if (!payload) return;
      saveMutation.mutate(payload);
    }, AUTOSAVE_MS);
    setSaveUi((prev) => (prev === "saving" || prev === "pending" ? prev : "pending"));
    return () => window.clearTimeout(t);
  }, [draft, dirty, saveMutation]);

  useEffect(() => {
    if (allRows.length === 0) {
      setCollapsedTaskIds(new Set());
      return;
    }
    const rowIds = new Set(allRows.map((t) => t.id));
    setCollapsedTaskIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (rowIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [allRows]);

  useEffect(() => {
    const valid = new Set(allRows.map((t) => t.id));
    setSelectedTaskIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [allRows]);

  const selectedCount = selectedTaskIds.size;
  const selectedVisibleCount = useMemo(
    () => rows.filter((t) => selectedTaskIds.has(t.id)).length,
    [rows, selectedTaskIds],
  );

  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (!el || rows.length === 0) return;
    el.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < rows.length;
  }, [rows.length, selectedVisibleCount]);

  const toggleTaskSelected = useCallback((id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<ScheduleTaskInput>) => {
    setDirty(true);
    setDraft((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev));
  }, []);

  const removeRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const base = draftRef.current ?? [];
    const drop = new Set<string>();
    const stack = [...ids];
    while (stack.length) {
      const x = stack.pop()!;
      drop.add(x);
      for (const t of base) {
        if (t.parentId === x) stack.push(t.id);
      }
    }
    setDirty(true);
    setDraft((prev) => {
      if (!prev) return prev;
      return prev
        .filter((t) => !drop.has(t.id))
        .map((t) => (t.parentId && drop.has(t.parentId) ? { ...t, parentId: null } : t));
    });
    setDetailTaskId((prev) => (prev && drop.has(prev) ? null : prev));
    setSelectedTaskIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const id of drop) next.delete(id);
      return next.size === prev.size ? prev : next;
    });
  }, []);

  const removeRow = useCallback(
    (id: string) => {
      removeRows([id]);
    },
    [removeRows],
  );

  const deleteSelectedTasks = useCallback(() => {
    const ids = [...selectedTaskIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} selected task(s) and their subtasks? This cannot be undone.`,
      )
    )
      return;
    removeRows(ids);
    setSelectedTaskIds(new Set());
    setConfirmDeleteTaskId(null);
  }, [selectedTaskIds, removeRows]);

  const createTask = useCallback(
    (opts: { parentId: string | null; seed?: Partial<ScheduleTaskInput> }) => {
      const created = makeRow({ parentId: opts.parentId, ...opts.seed });
      setDirty(true);
      setDraft((prev) => {
        const next = prev ?? [];
        const siblings = next.filter((t) => t.parentId === opts.parentId);
        const maxOrder = siblings.reduce((m, t) => Math.max(m, t.sortOrder), -1);
        return [...next, { ...created, sortOrder: maxOrder + 1 }];
      });
      setDetailTaskId(created.id);
      return created.id;
    },
    [],
  );

  const addRow = useCallback(() => {
    createTask({ parentId: null });
  }, [createTask]);

  const addChild = useCallback(
    (parentId: string) => {
      createTask({ parentId });
    },
    [createTask],
  );

  const addSibling = useCallback(
    (taskId: string) => {
      const base = draftRef.current?.find((t) => t.id === taskId);
      if (!base) return;
      createTask({
        parentId: base.parentId,
        seed: { startDate: base.startDate, endDate: base.endDate },
      });
    },
    [createTask],
  );

  const indentRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setDirty(true);
    setDraft((prev) => {
      if (!prev) return prev;
      let next = [...prev];
      const display = sortForDisplay(next);
      const indexById = new Map(display.map((t, i) => [t.id, i]));
      const byIdMap = new Map(next.map((t) => [t.id, t]));
      const inDisplayOrder = display.map((t) => t.id).filter((id) => ids.includes(id));

      function isDescendant(nodeId: string, maybeAncestorId: string): boolean {
        let cur = byIdMap.get(nodeId)?.parentId ?? null;
        const seen = new Set<string>();
        while (cur) {
          if (seen.has(cur)) break;
          seen.add(cur);
          if (cur === maybeAncestorId) return true;
          cur = byIdMap.get(cur)?.parentId ?? null;
        }
        return false;
      }

      for (const id of inDisplayOrder) {
        const idx = indexById.get(id);
        if (idx == null || idx <= 0) continue;
        const candidateParent = display[idx - 1];
        if (!candidateParent || candidateParent.id === id) continue;
        if (isDescendant(candidateParent.id, id)) continue;
        const siblings = next.filter((t) => t.parentId === candidateParent.id && t.id !== id);
        const maxOrder = siblings.reduce((m, t) => Math.max(m, t.sortOrder), -1);
        next = next.map((t) =>
          t.id === id ? { ...t, parentId: candidateParent.id, sortOrder: maxOrder + 1 } : t,
        );
        const changed = next.find((t) => t.id === id);
        if (changed) byIdMap.set(id, changed);
      }
      return next;
    });
  }, []);

  const outdentRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setDirty(true);
    setDraft((prev) => {
      if (!prev) return prev;
      let next = [...prev];
      const display = sortForDisplay(next);
      const byIdMap = new Map(next.map((t) => [t.id, t]));
      const inDisplayOrder = display.map((t) => t.id).filter((id) => ids.includes(id));
      for (const id of inDisplayOrder) {
        const row = byIdMap.get(id);
        if (!row?.parentId) continue;
        const parent = byIdMap.get(row.parentId);
        const newParentId = parent?.parentId ?? null;
        const siblings = next.filter((t) => t.parentId === newParentId && t.id !== id);
        const maxOrder = siblings.reduce((m, t) => Math.max(m, t.sortOrder), -1);
        next = next.map((t) =>
          t.id === id ? { ...t, parentId: newParentId, sortOrder: maxOrder + 1 } : t,
        );
        const changed = next.find((t) => t.id === id);
        if (changed) byIdMap.set(id, changed);
      }
      return next;
    });
  }, []);

  const addTaskFromCanvas = useCallback(
    (parentId: string | null, start: Date, end: Date) => {
      createTask({
        parentId,
        seed: {
          startDate: toYmd(start),
          endDate: toYmd(end),
          title: "New task",
        },
      });
    },
    [createTask],
  );

  const openPrintDialog = useCallback(() => {
    // Keep print output focused on schedule content.
    setDetailTaskId(null);
    window.setTimeout(() => window.print(), 80);
  }, []);

  const {
    createPreview,
    onTrackPointerDown,
    onTrackPointerMove,
    onTrackPointerUp,
    onTrackPointerCancel,
  } = useTaskCreation({
    rangeRef,
    onCreateTask: addTaskFromCanvas,
  });

  const onResizeLeftDown = useCallback((e: React.PointerEvent, taskId: string) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const track = target.closest("[data-gantt-track]") as HTMLElement | null;
    if (!track) return;
    target.setPointerCapture(e.pointerId);
    dragStateRef.current = { kind: "resize-left", taskId, pointerId: e.pointerId, rowEl: track };
  }, []);

  const onResizeRightDown = useCallback((e: React.PointerEvent, taskId: string) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const track = target.closest("[data-gantt-track]") as HTMLElement | null;
    if (!track) return;
    target.setPointerCapture(e.pointerId);
    dragStateRef.current = { kind: "resize-right", taskId, pointerId: e.pointerId, rowEl: track };
  }, []);

  const onResizeHandleMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragStateRef.current;
      if (
        !d ||
        (d.kind !== "resize-left" && d.kind !== "resize-right") ||
        e.pointerId !== d.pointerId
      )
        return;
      const task = draftRef.current?.find((t) => t.id === d.taskId);
      if (!task) return;
      const r = rangeRef.current;
      const rect = d.rowEl.getBoundingClientRect();
      if (d.kind === "resize-left") {
        const ns = snapToLocalDay(clientXToDate(e.clientX, rect, r.min, r.max));
        const end = snapToLocalDay(parseYmd(task.endDate));
        if (ns.getTime() > end.getTime()) return;
        updateRow(d.taskId, { startDate: toYmd(ns) });
      } else {
        const ne = snapToLocalDay(clientXToDate(e.clientX, rect, r.min, r.max));
        const start = snapToLocalDay(parseYmd(task.startDate));
        if (ne.getTime() < start.getTime()) return;
        updateRow(d.taskId, { endDate: toYmd(ne) });
      }
    },
    [updateRow],
  );

  const onResizeHandleUp = useCallback((e: React.PointerEvent) => {
    const d = dragStateRef.current;
    if (
      !d ||
      (d.kind !== "resize-left" && d.kind !== "resize-right") ||
      e.pointerId !== d.pointerId
    )
      return;
    const t = e.currentTarget as HTMLElement;
    if (t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId);
    dragStateRef.current = null;
  }, []);

  const onMoveBarDown = useCallback((e: React.PointerEvent, taskId: string) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const track = target.closest("[data-gantt-track]") as HTMLElement | null;
    const task = draftRef.current?.find((x) => x.id === taskId);
    if (!track || !task) return;
    target.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      kind: "move",
      taskId,
      pointerId: e.pointerId,
      rowEl: track,
      originClientX: e.clientX,
      origStart: snapToLocalDay(parseYmd(task.startDate)),
      origEnd: snapToLocalDay(parseYmd(task.endDate)),
    };
  }, []);

  const onMoveBarMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragStateRef.current;
      if (!d || d.kind !== "move" || e.pointerId !== d.pointerId) return;
      const r = rangeRef.current;
      const rect = d.rowEl.getBoundingClientRect();
      const a = clientXToDate(d.originClientX, rect, r.min, r.max).getTime();
      const b = clientXToDate(e.clientX, rect, r.min, r.max).getTime();
      const deltaMs = b - a;
      const ns = new Date(d.origStart.getTime() + deltaMs);
      const ne = new Date(d.origEnd.getTime() + deltaMs);
      updateRow(d.taskId, { startDate: toYmd(ns), endDate: toYmd(ne) });
    },
    [updateRow],
  );

  const onMoveBarUp = useCallback((e: React.PointerEvent) => {
    const d = dragStateRef.current;
    if (!d || d.kind !== "move" || e.pointerId !== d.pointerId) return;
    const t = e.currentTarget as HTMLElement;
    if (t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId);
    dragStateRef.current = null;
  }, []);

  const pickerTask = pickerTaskId ? byId.get(pickerTaskId) : undefined;
  const detailTask = detailTaskId ? (byId.get(detailTaskId) ?? null) : null;
  const lastDetailTaskRef = useRef<ScheduleTaskInput | null>(null);
  useEffect(() => {
    if (detailTask) {
      lastDetailTaskRef.current = detailTask;
      return;
    }
    if (!detailTaskId) lastDetailTaskRef.current = null;
  }, [detailTask, detailTaskId]);
  const panelTask = detailTask ?? (detailTaskId ? lastDetailTaskRef.current : null);
  const tableRowHeightClass = "h-8";
  const ganttRowHeightClass = "h-8";
  const inputHeightClass = "h-6";
  const singleSelectedTaskId = detailTaskId && byId.has(detailTaskId) ? detailTaskId : null;
  const saveTimeLabel = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  if (sessionPending || !session) {
    return <EnterpriseLoadingState message="Loading…" label="Loading" />;
  }
  if (session.uiMode !== "internal") {
    return <AccessRestricted backHref={`/projects/${projectId}/home`} />;
  }
  if (!session.settings.modules.schedule) {
    return (
      <div className="enterprise-animate-in rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 text-sm text-[var(--enterprise-text-muted)]">
        The schedule module is turned off for this project. A Super Admin can enable it in{" "}
        <a
          className="text-[var(--enterprise-primary)] underline"
          href={`/projects/${projectId}/settings`}
        >
          Project settings
        </a>
        .
      </div>
    );
  }

  if (scheduleQuery.isPending || (scheduleQuery.isSuccess && draft === null)) {
    return <EnterpriseLoadingState message="Loading schedule…" label="Loading" />;
  }
  if (scheduleQuery.isError) {
    return (
      <p className="text-sm text-red-600">
        {scheduleQuery.error instanceof Error
          ? scheduleQuery.error.message
          : "Could not load schedule."}
      </p>
    );
  }

  const saveLabel =
    saveUi === "saving"
      ? "Saving…"
      : saveUi === "pending"
        ? "Unsaved — saving soon…"
        : saveUi === "error"
          ? "Save failed — fix and edit to retry"
          : "Saved";

  const ganttBands = monthBands(range.min, range.max);
  const ganttWeeks = weekGrid(range.min, range.max);
  const ganttToday = todayLinePct(range.min, range.max);

  return (
    <div className="schedule-print-root enterprise-animate-in space-y-4">
      {panelTask ? (
        <button
          type="button"
          className="no-print fixed inset-0 z-30 bg-black/20"
          onClick={() => setDetailTaskId(null)}
          aria-label="Close task details"
        />
      ) : null}
      <TaskDetailPanel
        task={panelTask}
        onClose={() => setDetailTaskId(null)}
        onChange={updateRow}
        onAddSubtask={addChild}
      />
      <TakeoffLinksPicker
        open={Boolean(pickerTaskId && pickerTask)}
        onClose={() => setPickerTaskId(null)}
        lines={takeoffQuery.data ?? []}
        selected={pickerTask?.takeoffLineIds ?? []}
        onApply={(ids) => {
          if (pickerTaskId) updateRow(pickerTaskId, { takeoffLineIds: ids });
        }}
      />

      <header className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)]"
            aria-hidden
          >
            <ChartGantt className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
              Construction schedule
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="text-xs text-[var(--enterprise-text-muted)]"
            aria-live="polite"
            title="Changes are saved automatically after you stop editing"
          >
            {saveLabel}
            {saveTimeLabel ? ` · Last saved ${saveTimeLabel}` : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              const payload = draftRef.current;
              if (!payload || payload.length === 0) return;
              saveMutation.mutate(payload);
            }}
            disabled={!dirty || saveMutation.isPending || !draft}
            className={SCHEDULE_BTN_SECONDARY}
          >
            <Save className="h-4 w-4" aria-hidden />
            Save now
          </button>
          <EnterpriseAddPulseWrap>
            <button type="button" onClick={addRow} className={SCHEDULE_BTN_SECONDARY}>
              <Plus className="h-4 w-4" aria-hidden />
              Add top-level task
            </button>
          </EnterpriseAddPulseWrap>
          <button
            type="button"
            onClick={() => {
              if (!singleSelectedTaskId) return;
              addChild(singleSelectedTaskId);
            }}
            disabled={!singleSelectedTaskId}
            className={SCHEDULE_BTN_SECONDARY}
            title={
              singleSelectedTaskId ? "Create subtask under selected task" : "Select one task first"
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add subtask
          </button>
          <button type="button" onClick={openPrintDialog} className={SCHEDULE_BTN_SECONDARY}>
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={deleteSelectedTasks}
              className={`${SCHEDULE_BTN_SECONDARY} border-red-200 text-red-700 hover:bg-red-50`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete selected ({selectedCount})
            </button>
          ) : null}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-8 text-center">
          <p className="text-sm text-[var(--enterprise-text-muted)]">No schedule rows yet.</p>
          <button
            type="button"
            onClick={() => {
              setDirty(true);
              setDraft([makeRow({ title: "Project start", sortOrder: 0 })]);
            }}
            className={`${SCHEDULE_BTN_PRIMARY} mt-4 px-4`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Start a schedule
          </button>
        </div>
      ) : (
        <>
          <section
            className="schedule-print-grid hidden min-h-[420px] overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] lg:flex lg:min-h-[620px] lg:h-[calc(100vh-13.5rem)] lg:flex-col"
            aria-label="Schedule grid and timeline"
          >
            <div
              className="enterprise-scrollbar flex min-h-0 flex-1 flex-row items-start overflow-x-hidden overflow-y-auto overscroll-contain"
              aria-label="Schedule scroll area"
            >
              <div className="flex w-[440px] shrink-0 flex-col overflow-x-auto border-r border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
                <table className="min-w-[680px] text-left text-sm">
                  <thead className="sticky top-0 z-20 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-xs uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <tr>
                      <th className="no-print w-8 px-1 py-1.5 align-middle font-medium" scope="col">
                        <input
                          ref={selectAllCheckboxRef}
                          type="checkbox"
                          checked={rows.length > 0 && selectedVisibleCount === rows.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaskIds(new Set(rows.map((r) => r.id)));
                            } else {
                              setSelectedTaskIds(new Set());
                            }
                          }}
                          className="accent-[var(--enterprise-primary)]"
                          title="Select all visible tasks"
                          aria-label="Select all visible tasks"
                        />
                      </th>
                      <th className="px-2 py-1.5 font-medium">Task</th>
                      {takeoffEnabled ? <th className="px-1 py-1.5 font-medium">Takeoff</th> : null}
                      <th className="px-2 py-1.5 font-medium">Start</th>
                      <th className="px-2 py-1.5 font-medium">End</th>
                      <th className="w-36 px-1 py-1.5 font-medium">Progress</th>
                      <th className="w-10 px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--enterprise-border)]">
                    {rows.map((t) => {
                      const depth = depthById.get(t.id) ?? 0;
                      const isRowSelected = selectedTaskIds.has(t.id);
                      return (
                        <tr
                          key={t.id}
                          className={`${tableRowHeightClass} bg-[var(--enterprise-surface)] hover:bg-[var(--enterprise-bg)]/20 ${
                            isRowSelected ? "bg-[var(--enterprise-primary)]/10" : ""
                          }`}
                          onClick={() => setDetailTaskId(t.id)}
                        >
                          <td
                            className="no-print w-8 px-1 py-0 align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={() => toggleTaskSelected(t.id)}
                              className="accent-[var(--enterprise-primary)]"
                              aria-label={`Select ${t.title}`}
                            />
                          </td>
                          <td className="px-2 py-0.5 align-middle">
                            <div className="flex items-center gap-2">
                              <SubtaskTreeConnector depth={depth} />
                              {(childCountByParent.get(t.id) ?? 0) > 0 ? (
                                <button
                                  type="button"
                                  className="cursor-pointer rounded p-0.5 text-[var(--enterprise-text-muted)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] hover:text-[var(--enterprise-text)] active:scale-[0.96]"
                                  aria-label={
                                    collapsedTaskIds.has(t.id)
                                      ? "Expand subtasks"
                                      : "Collapse subtasks"
                                  }
                                  onClick={() =>
                                    setCollapsedTaskIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(t.id)) next.delete(t.id);
                                      else next.add(t.id);
                                      return next;
                                    })
                                  }
                                >
                                  {collapsedTaskIds.has(t.id) ? (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="h-3 w-3" aria-hidden />
                              )}
                              <input
                                className={`${inputHeightClass} min-w-0 flex-1 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-[var(--enterprise-text)]`}
                                value={t.title}
                                onChange={(e) => updateRow(t.id, { title: e.target.value })}
                                onBlur={(e) =>
                                  updateRow(t.id, { title: normalizeTaskTitle(e.target.value) })
                                }
                                onFocus={() => setDetailTaskId(t.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addSibling(t.id);
                                    return;
                                  }
                                  if (e.key === "Tab") {
                                    e.preventDefault();
                                    const targets = [t.id];
                                    if (e.shiftKey) outdentRows(targets);
                                    else indentRows(targets);
                                  }
                                }}
                                aria-label="Task name"
                              />
                              <span className="shrink-0 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--enterprise-text-muted)]">
                                {taskNumberById.get(t.id) ?? "—"}
                              </span>
                            </div>
                          </td>
                          {takeoffEnabled ? (
                            <td className="max-w-[140px] px-1 py-0.5 align-middle">
                              <button
                                type="button"
                                disabled={takeoffQuery.isPending}
                                className={`flex ${inputHeightClass} w-full cursor-pointer items-center gap-1 truncate rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1.5 text-left text-[10px] text-[var(--enterprise-text)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`}
                                onClick={() => setPickerTaskId(t.id)}
                                title={takeoffSummaryLabel(t.takeoffLineIds, takeoffById)}
                              >
                                <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                                <span className="truncate">
                                  {t.takeoffLineIds.length === 0
                                    ? "Link…"
                                    : `${t.takeoffLineIds.length} line(s)`}
                                </span>
                              </button>
                            </td>
                          ) : null}
                          <td className="px-2 py-0.5 align-middle">
                            <input
                              type="date"
                              className={`${inputHeightClass} w-38 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 text-[var(--enterprise-text)]`}
                              value={t.startDate}
                              onChange={(e) => updateRow(t.id, { startDate: e.target.value })}
                              onFocus={() => setDetailTaskId(t.id)}
                            />
                          </td>
                          <td className="px-2 py-0.5 align-middle">
                            <input
                              type="date"
                              className={`${inputHeightClass} w-38 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 text-[var(--enterprise-text)]`}
                              value={t.endDate}
                              onChange={(e) => updateRow(t.id, { endDate: e.target.value })}
                              onFocus={() => setDetailTaskId(t.id)}
                            />
                          </td>
                          <td className="px-1 py-0.5 align-middle">
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-1.5 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1.5 py-0.5 text-left transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.99]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailTaskId(t.id);
                              }}
                              title="Open details to edit progress/status"
                            >
                              <span
                                className={`shrink-0 rounded px-1 py-px text-[10px] font-medium leading-tight ${
                                  statusPalette(normalizeStatus(t.status)).pillBg
                                } ${statusPalette(normalizeStatus(t.status)).pillText}`}
                              >
                                {STATUS_OPTIONS.find((x) => x.value === normalizeStatus(t.status))
                                  ?.label ?? "Not started"}
                              </span>
                              <ProgressBar value={t.progressPercent} className="min-w-0 flex-1" />
                              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[var(--enterprise-text)]">
                                {Math.max(0, Math.min(100, Math.round(t.progressPercent)))}%
                              </span>
                            </button>
                          </td>
                          <td className="relative px-1 py-0.5 align-middle">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                className={SCHEDULE_ICON_BTN}
                                aria-label="Add subtask"
                                onClick={() => addChild(t.id)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="cursor-pointer rounded p-1 text-[var(--enterprise-text-muted)] transition-all duration-150 hover:bg-red-50 hover:text-red-600 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                                aria-label="Delete task"
                                onClick={() =>
                                  setConfirmDeleteTaskId((prev) => (prev === t.id ? null : t.id))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {confirmDeleteTaskId === t.id ? (
                              <div className="absolute right-2 top-9 z-30 w-56 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2 shadow-lg">
                                <p className="px-1 text-xs text-[var(--enterprise-text-muted)]">
                                  Delete this task and all subtasks?
                                </p>
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    className="cursor-pointer rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-xs text-[var(--enterprise-text)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.97]"
                                    onClick={() => setConfirmDeleteTaskId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="cursor-pointer rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-all duration-150 hover:bg-red-700 active:scale-[0.97]"
                                    onClick={() => {
                                      removeRow(t.id);
                                      setConfirmDeleteTaskId(null);
                                    }}
                                  >
                                    Delete subtree
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex min-w-0 flex-1 flex-col overflow-x-auto bg-[var(--enterprise-bg)]/15">
                <div className="relative px-2 pb-2" style={{ minWidth: timelineWidthPx }}>
                  <div className="sticky top-0 z-[2] border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
                    <div className="relative h-8 border-b border-[var(--enterprise-border)]/70">
                      {ganttBands.map((m, i) => (
                        <div
                          key={i}
                          className="absolute top-0 flex h-full items-center justify-center border-r border-[var(--enterprise-border)]/60 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]"
                          style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                        >
                          <span className="truncate">{m.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="relative h-1 bg-[var(--enterprise-surface)]" />
                  </div>
                  <div className="relative space-y-0">
                    {ganttToday != null ? (
                      <>
                        <div
                          className="pointer-events-none absolute top-0 bottom-0 z-[3] w-4 -translate-x-1/2"
                          style={{
                            left: `${ganttToday}%`,
                            background:
                              "linear-gradient(to right, transparent, color-mix(in srgb, var(--enterprise-primary) 14%, transparent), transparent)",
                          }}
                          aria-hidden
                        />
                        <div
                          className="pointer-events-none absolute top-0 bottom-0 z-[4] w-[2px] -translate-x-1/2 rounded-full bg-[var(--enterprise-primary)]/80 shadow-[0_0_14px_rgba(59,130,246,0.35)]"
                          style={{ left: `${ganttToday}%` }}
                          title="Today"
                          aria-hidden
                        />
                        <div
                          className="pointer-events-none absolute top-1 z-[5] -translate-x-1/2 rounded-full bg-[var(--enterprise-primary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow"
                          style={{ left: `${ganttToday}%` }}
                          aria-hidden
                        >
                          Today
                        </div>
                      </>
                    ) : null}
                    {rows.map((t) => {
                      const depth = depthById.get(t.id) ?? 0;
                      const start = parseYmd(t.startDate);
                      const end = parseYmd(t.endDate);
                      const { leftPct, widthPct } = barLayout(start, end, range.min, range.max);
                      const status = normalizeStatus(t.status);
                      const palette = statusPalette(status);
                      const isChild = depth > 0;
                      const ganttSelected = selectedTaskIds.has(t.id);
                      const showPreview =
                        createPreview?.rowTaskId === t.id && createPreview.widthPct > 0;
                      return (
                        <div
                          key={t.id}
                          data-gantt-track
                          className={`group relative ${ganttRowHeightClass} select-none rounded-sm border border-[var(--enterprise-border)]/40 bg-[var(--enterprise-bg)] ${
                            ganttSelected
                              ? "ring-1 ring-[var(--enterprise-primary)]/45"
                              : isChild
                                ? "ring-1 ring-[var(--enterprise-border)]/30"
                                : ""
                          }`}
                          style={{ minWidth: timelineWidthPx }}
                          onClick={() => setDetailTaskId(t.id)}
                        >
                          {ganttWeeks.map((w, i) => (
                            <div
                              key={`row-${t.id}-w-${i}`}
                              className="pointer-events-none absolute inset-y-0 border-l border-[var(--enterprise-border)]/35"
                              style={{ left: `${w.leftPct}%` }}
                            />
                          ))}
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`Drag on timeline to create task (${t.title})`}
                            className="absolute inset-0 z-[1] cursor-crosshair border-0 bg-transparent p-0"
                            onPointerDown={(e) => onTrackPointerDown(e, t.id, t.parentId)}
                            onPointerMove={onTrackPointerMove}
                            onPointerUp={onTrackPointerUp}
                            onPointerCancel={onTrackPointerCancel}
                          />
                          {showPreview ? (
                            <div
                              className="pointer-events-none absolute top-1/2 z-[2] h-2 -translate-y-1/2 rounded-sm border border-dashed border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/25"
                              style={{
                                left: `${createPreview.leftPct}%`,
                                width: `${createPreview.widthPct}%`,
                              }}
                              aria-hidden
                            />
                          ) : null}
                          <div
                            className={`absolute top-1/2 z-[4] flex h-5 -translate-y-1/2 items-stretch touch-none rounded-lg shadow-sm ${palette.barBg} ${
                              isChild ? "opacity-85" : ""
                            }`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            title={`${t.title}`}
                          >
                            <div
                              role="separator"
                              aria-label="Resize start date"
                              className="w-2 shrink-0 cursor-ew-resize touch-none rounded-l-sm hover:bg-white/25"
                              onPointerDown={(e) => onResizeLeftDown(e, t.id)}
                              onPointerMove={onResizeHandleMove}
                              onPointerUp={onResizeHandleUp}
                              onPointerCancel={onResizeHandleUp}
                            />
                            <div
                              className="min-w-0 flex-1 cursor-grab touch-none active:cursor-grabbing"
                              onClick={() => setDetailTaskId(t.id)}
                              onPointerDown={(e) => onMoveBarDown(e, t.id)}
                              onPointerMove={onMoveBarMove}
                              onPointerUp={onMoveBarUp}
                              onPointerCancel={onMoveBarUp}
                            />
                            <div
                              className={`pointer-events-none absolute inset-y-0 left-0 rounded-sm ${palette.progressBg}`}
                              style={{
                                width: `${Math.max(0, Math.min(100, t.progressPercent))}%`,
                              }}
                              aria-hidden
                            />
                            {widthPct > 5 ? (
                              <span className="pointer-events-none absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white/90">
                                <span className="truncate">{t.title}</span>
                              </span>
                            ) : null}
                            <div
                              role="separator"
                              aria-label="Resize end date"
                              className="w-2 shrink-0 cursor-ew-resize touch-none rounded-r-sm hover:bg-white/25"
                              onPointerDown={(e) => onResizeRightDown(e, t.id)}
                              onPointerMove={onResizeHandleMove}
                              onPointerUp={onResizeHandleUp}
                              onPointerCancel={onResizeHandleUp}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="no-print space-y-3 lg:hidden">
            <p className="text-xs text-[var(--enterprise-text-muted)]">
              Timeline view uses horizontal space — use a larger screen for the chart, or edit dates
              below.
            </p>
            {rows.map((t) => {
              const depth = depthById.get(t.id) ?? 0;
              const mobileSelected = selectedTaskIds.has(t.id);
              return (
                <div
                  key={t.id}
                  className={`rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3 ${
                    mobileSelected ? "ring-1 ring-[var(--enterprise-primary)]/40" : ""
                  }`}
                  style={{ marginLeft: depth * 8 }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mobileSelected}
                      onChange={() => toggleTaskSelected(t.id)}
                      className="accent-[var(--enterprise-primary)]"
                      aria-label={`Select ${t.title}`}
                    />
                  </div>
                  <label className="block text-xs font-medium text-[var(--enterprise-text-muted)]">
                    Task
                    <input
                      className="mt-1 w-full rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-2 text-sm text-[var(--enterprise-text)]"
                      value={t.title}
                      onChange={(e) => updateRow(t.id, { title: e.target.value })}
                      onBlur={(e) => updateRow(t.id, { title: normalizeTaskTitle(e.target.value) })}
                      onFocus={() => setDetailTaskId(t.id)}
                    />
                  </label>
                  {takeoffEnabled ? (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                        Takeoff lines
                      </span>
                      <button
                        type="button"
                        disabled={takeoffQuery.isPending}
                        className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm text-[var(--enterprise-text)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => setPickerTaskId(t.id)}
                      >
                        <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                        {t.takeoffLineIds.length === 0
                          ? "Link takeoff lines"
                          : `${t.takeoffLineIds.length} linked`}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs text-[var(--enterprise-text-muted)]">
                      Start
                      <input
                        type="date"
                        className="mt-1 w-full rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-sm"
                        value={t.startDate}
                        onChange={(e) => updateRow(t.id, { startDate: e.target.value })}
                        onFocus={() => setDetailTaskId(t.id)}
                      />
                    </label>
                    <label className="text-xs text-[var(--enterprise-text-muted)]">
                      End
                      <input
                        type="date"
                        className="mt-1 w-full rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-sm"
                        value={t.endDate}
                        onChange={(e) => updateRow(t.id, { endDate: e.target.value })}
                        onFocus={() => setDetailTaskId(t.id)}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="mt-2 w-full cursor-pointer rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-2 text-left transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.99]"
                    onClick={() => setDetailTaskId(t.id)}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          statusPalette(normalizeStatus(t.status)).pillBg
                        } ${statusPalette(normalizeStatus(t.status)).pillText}`}
                      >
                        {STATUS_OPTIONS.find((x) => x.value === normalizeStatus(t.status))?.label ??
                          "Not started"}
                      </span>
                      <span className="font-semibold text-[var(--enterprise-text)]">
                        {Math.max(0, Math.min(100, Math.round(t.progressPercent)))}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={t.progressPercent} />
                    </div>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="cursor-pointer rounded border border-[var(--enterprise-border)] px-2 py-1 text-xs transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.98]"
                      onClick={() => addChild(t.id)}
                    >
                      Add subtask
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded border border-red-200 px-2 py-1 text-xs text-red-700 transition-all duration-150 hover:bg-red-50 active:scale-[0.98]"
                      onClick={() => {
                        if (window.confirm("Delete this task and all subtasks?")) removeRow(t.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
