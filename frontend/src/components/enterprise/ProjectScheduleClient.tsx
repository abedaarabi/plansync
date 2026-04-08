"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartGantt, ChevronDown, ChevronRight, Link2, Plus, Save, Trash2, X } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  fetchProjectSchedule,
  fetchProjectSession,
  fetchTakeoffLinesForProject,
  ProRequiredError,
  putProjectSchedule,
  type ScheduleTaskInput,
  type ScheduleTaskRow,
  type TakeoffLineRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { AccessRestricted } from "@/components/enterprise/AccessRestricted";

type Props = { projectId: string };

const AUTOSAVE_MS = 900;
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMELINE_PX_PER_DAY = 8;
const TIMELINE_MIN_WIDTH_PX = 1200;
const TIMELINE_MAX_WIDTH_PX = 28000;
const SCHEDULE_ROW_HEIGHT_PX = 40;

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
  const ids = new Set(tasks.map((t) => t.id));
  const visited = new Set<string>();
  const out: ScheduleTaskInput[] = [];
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  function visit(id: string) {
    if (visited.has(id)) return;
    const t = byId.get(id);
    if (!t) return;
    if (t.parentId && ids.has(t.parentId)) visit(t.parentId);
    visited.add(id);
    out.push(t);
  }
  for (const t of sorted) visit(t.id);
  return out;
}

function depthOf(id: string, byId: Map<string, ScheduleTaskInput>): number {
  let d = 0;
  let cur: string | null = id;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const t = byId.get(cur);
    if (!t?.parentId) break;
    d += 1;
    cur = t.parentId;
  }
  return d;
}

function timelineRange(tasks: ScheduleTaskInput[]): { min: Date; max: Date } {
  const today = new Date();
  const todayMin = addDays(today, -14).getTime();
  const todayMax = addDays(today, 14).getTime();
  if (tasks.length === 0) {
    return { min: addDays(today, -7), max: addDays(today, 56) };
  }
  let minT = parseYmd(tasks[0].startDate).getTime();
  let maxT = parseYmd(tasks[0].endDate).getTime();
  for (const x of tasks) {
    minT = Math.min(minT, parseYmd(x.startDate).getTime());
    maxT = Math.max(maxT, parseYmd(x.endDate).getTime());
  }
  // Keep "today" visible even when schedule dates are far away.
  minT = Math.min(minT, todayMin);
  maxT = Math.max(maxT, todayMax);
  return { min: addDays(new Date(minT), -7), max: addDays(new Date(maxT), 14) };
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
      kind: "create";
      rowTaskId: string;
      parentId: string | null;
      pointerId: number;
      originX: number;
      currentX: number;
      rowEl: HTMLElement;
    }
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

function SubtaskTreeGutter({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  const lane = 14;
  const elbowLeft = (depth - 1) * lane + 6;
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-[3]"
      style={{ width: depth * lane + 16 }}
      aria-hidden
    >
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-y-0 border-l border-[var(--enterprise-text-muted)]/75"
          style={{ left: i * lane + 6 }}
        />
      ))}
      <div
        className="absolute top-1/2 h-px w-3 -translate-y-1/2 border-t border-[var(--enterprise-text-muted)]/75"
        style={{ left: elbowLeft }}
      />
    </div>
  );
}

function SubtaskTreeConnector({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  const lane = 14;
  const elbowLeft = (depth - 1) * lane + 6;
  return (
    <div className="pointer-events-none relative h-7 shrink-0" style={{ width: depth * lane + 16 }}>
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="takeoff-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
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
          <button
            type="button"
            className="rounded p-1 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-bg)]"
            onClick={onClose}
            aria-label="Close"
          >
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
          <button
            type="button"
            className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm text-[var(--enterprise-text)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-medium text-white"
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
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncSourceRef = useRef<"left" | "right" | null>(null);

  const [saveUi, setSaveUi] = useState<"saved" | "saving" | "pending" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);

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
  const selectedSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
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
  const [createPreview, setCreatePreview] = useState<{
    rowTaskId: string;
    leftPct: number;
    widthPct: number;
  } | null>(null);

  const saveMutation = useMutation({
    mutationFn: (tasks: ScheduleTaskInput[]) =>
      putProjectSchedule(projectId, { tasks: normalizeTasksForSave(tasks) }),
    onMutate: () => {
      setSaveUi("saving");
    },
    onSuccess: async (saved) => {
      setDirty(false);
      setDraft(saved.map(rowToInput));
      setSaveUi("saved");
      setLastSavedAt(new Date());
      await queryClient.invalidateQueries({ queryKey: qk.projectSchedule(projectId) });
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
    setSaveUi("pending");
    return () => window.clearTimeout(t);
  }, [draft, dirty, saveMutation]);

  useEffect(() => {
    if (allRows.length === 0) {
      setSelectedTaskIds([]);
      setCollapsedTaskIds(new Set());
      return;
    }
    const rowIds = new Set(allRows.map((t) => t.id));
    setSelectedTaskIds((prev) => prev.filter((id) => rowIds.has(id)));
    setCollapsedTaskIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (rowIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [allRows]);

  useEffect(() => {
    const leftEl = leftScrollRef.current;
    const rightEl = rightScrollRef.current;
    if (!leftEl || !rightEl) return;

    const sync = (source: HTMLElement, target: HTMLElement, from: "left" | "right") => {
      if (scrollSyncSourceRef.current && scrollSyncSourceRef.current !== from) return;
      scrollSyncSourceRef.current = from;
      target.scrollTop = source.scrollTop;
      window.requestAnimationFrame(() => {
        if (scrollSyncSourceRef.current === from) scrollSyncSourceRef.current = null;
      });
    };

    const onLeftScroll = () => sync(leftEl, rightEl, "left");
    const onRightScroll = () => sync(rightEl, leftEl, "right");

    leftEl.addEventListener("scroll", onLeftScroll, { passive: true });
    rightEl.addEventListener("scroll", onRightScroll, { passive: true });
    return () => {
      leftEl.removeEventListener("scroll", onLeftScroll);
      rightEl.removeEventListener("scroll", onRightScroll);
    };
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<ScheduleTaskInput>) => {
    setDirty(true);
    setDraft((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev));
  }, []);

  const removeRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setDirty(true);
    setDraft((prev) => {
      if (!prev) return prev;
      const drop = new Set<string>();
      const stack = [...ids];
      while (stack.length) {
        const x = stack.pop()!;
        drop.add(x);
        for (const t of prev) {
          if (t.parentId === x) stack.push(t.id);
        }
      }
      return prev
        .filter((t) => !drop.has(t.id))
        .map((t) => (t.parentId && drop.has(t.parentId) ? { ...t, parentId: null } : t));
    });
  }, []);

  const removeRow = useCallback(
    (id: string) => {
      removeRows([id]);
    },
    [removeRows],
  );

  const addRow = useCallback(() => {
    setDirty(true);
    setDraft((prev) => {
      const next = prev ?? [];
      const maxOrder = next.reduce((m, t) => Math.max(m, t.sortOrder), -1);
      return [...next, makeRow({ sortOrder: maxOrder + 1 })];
    });
  }, []);

  const addChild = useCallback((parentId: string) => {
    setDirty(true);
    setDraft((prev) => {
      const next = prev ?? [];
      const siblings = next.filter((t) => t.parentId === parentId);
      const maxOrder = siblings.reduce((m, t) => Math.max(m, t.sortOrder), -1);
      return [...next, makeRow({ parentId, sortOrder: maxOrder + 1 })];
    });
  }, []);

  const addSibling = useCallback((taskId: string) => {
    setDirty(true);
    setDraft((prev) => {
      const next = prev ?? [];
      const base = next.find((t) => t.id === taskId);
      if (!base) return next;
      const siblings = next.filter((t) => t.parentId === base.parentId);
      const maxOrder = siblings.reduce((m, t) => Math.max(m, t.sortOrder), -1);
      return [
        ...next,
        makeRow({
          parentId: base.parentId,
          sortOrder: maxOrder + 1,
          startDate: base.startDate,
          endDate: base.endDate,
        }),
      ];
    });
  }, []);

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

  const toggleTaskSelection = useCallback((taskId: string, checked: boolean) => {
    setSelectedTaskIds((prev) => {
      if (checked) {
        if (prev.includes(taskId)) return prev;
        return [...prev, taskId];
      }
      return prev.filter((id) => id !== taskId);
    });
  }, []);

  const addTaskFromCanvas = useCallback((parentId: string | null, start: Date, end: Date) => {
    setDirty(true);
    setDraft((prev) => {
      const next = prev ?? [];
      const siblings = next.filter((t) => t.parentId === parentId);
      const maxOrder = siblings.reduce((m, t) => Math.max(m, t.sortOrder), -1);
      return [
        ...next,
        makeRow({
          parentId,
          sortOrder: maxOrder + 1,
          startDate: toYmd(start),
          endDate: toYmd(end),
          title: "New task",
        }),
      ];
    });
  }, []);

  const onTrackPointerDown = useCallback((e: React.PointerEvent, rowTask: ScheduleTaskInput) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      kind: "create",
      rowTaskId: rowTask.id,
      parentId: rowTask.parentId,
      pointerId: e.pointerId,
      originX: e.clientX,
      currentX: e.clientX,
      rowEl: el,
    };
    setCreatePreview({ rowTaskId: rowTask.id, leftPct: 0, widthPct: 0 });
  }, []);

  const onTrackPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragStateRef.current;
    if (!d || d.kind !== "create" || e.pointerId !== d.pointerId) return;
    d.currentX = e.clientX;
    const rect = d.rowEl.getBoundingClientRect();
    const x0 = Math.min(d.originX, d.currentX);
    const x1 = Math.max(d.originX, d.currentX);
    const leftPct = ((x0 - rect.left) / rect.width) * 100;
    const widthPct = Math.max(0.2, ((x1 - x0) / rect.width) * 100);
    setCreatePreview({ rowTaskId: d.rowTaskId, leftPct, widthPct });
  }, []);

  const onTrackPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragStateRef.current;
      if (!d || d.kind !== "create" || e.pointerId !== d.pointerId) return;
      const el = e.currentTarget as HTMLElement;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const rect = d.rowEl.getBoundingClientRect();
      const r = rangeRef.current;
      const dx = Math.abs(d.currentX - d.originX);
      let start = snapToLocalDay(
        clientXToDate(Math.min(d.originX, d.currentX), rect, r.min, r.max),
      );
      let end = snapToLocalDay(clientXToDate(Math.max(d.originX, d.currentX), rect, r.min, r.max));
      if (end.getTime() < start.getTime()) [start, end] = [end, start];
      if (dx < 8) {
        const click = snapToLocalDay(clientXToDate(d.originX, rect, r.min, r.max));
        addTaskFromCanvas(d.parentId, click, click);
      } else if (start.getTime() === end.getTime()) {
        addTaskFromCanvas(d.parentId, start, start);
      } else {
        addTaskFromCanvas(d.parentId, start, end);
      }
      setCreatePreview(null);
      dragStateRef.current = null;
    },
    [addTaskFromCanvas],
  );

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
  const tableRowHeightClass = "h-10";
  const ganttRowHeightClass = "h-10";
  const inputHeightClass = "h-7";
  const allSelected = rows.length > 0 && rows.every((t) => selectedSet.has(t.id));
  const saveTimeLabel = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const ganttDependencyLines = useMemo(() => {
    const rowHeight = SCHEDULE_ROW_HEIGHT_PX;
    const rowGap = 0;
    const topPad = 0;
    const rowStep = rowHeight + rowGap;
    const rowIndexById = new Map(rows.map((t, i) => [t.id, i]));
    return rows.flatMap((child) => {
      if (!child.parentId) return [];
      const parent = byId.get(child.parentId);
      if (!parent) return [];
      const parentIndex = rowIndexById.get(parent.id);
      const childIndex = rowIndexById.get(child.id);
      if (parentIndex == null || childIndex == null) return [];
      const p = barLayout(
        parseYmd(parent.startDate),
        parseYmd(parent.endDate),
        range.min,
        range.max,
      );
      const c = barLayout(parseYmd(child.startDate), parseYmd(child.endDate), range.min, range.max);
      const parentEndPct = p.leftPct + p.widthPct;
      const childStartPct = c.leftPct;
      const parentY = topPad + parentIndex * rowStep + rowHeight / 2;
      const childY = topPad + childIndex * rowStep + rowHeight / 2;
      const delta = childStartPct - parentEndPct;
      const elbowPct =
        delta >= 0
          ? parentEndPct + Math.min(1.8, Math.max(0.8, delta * 0.45))
          : childStartPct - 0.8;
      const isActive = selectedSet.has(parent.id) || selectedSet.has(child.id);
      return [
        {
          key: `${parent.id}->${child.id}`,
          parentEndPct,
          childStartPct,
          elbowPct,
          parentY,
          childY,
          isActive,
        },
      ];
    });
  }, [rows, byId, range.min, range.max, selectedSet]);

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
    <div className="enterprise-animate-in space-y-4">
      <TakeoffLinksPicker
        open={Boolean(pickerTaskId && pickerTask)}
        onClose={() => setPickerTaskId(null)}
        lines={takeoffQuery.data ?? []}
        selected={pickerTask?.takeoffLineIds ?? []}
        onApply={(ids) => {
          if (pickerTaskId) updateRow(pickerTaskId, { takeoffLineIds: ids });
        }}
      />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
          {selectedTaskIds.length > 0 ? (
            <>
              <span className="rounded-md bg-[var(--enterprise-bg)] px-2 py-1 text-xs text-[var(--enterprise-text-muted)]">
                {selectedTaskIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${selectedTaskIds.length} selected task(s) and their subtasks?`,
                    )
                  ) {
                    removeRows(selectedTaskIds);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700"
              >
                Delete selected
              </button>
            </>
          ) : null}
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
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden />
            Save now
          </button>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-surface-hover)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add task
          </button>
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
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Start a schedule
          </button>
        </div>
      ) : (
        <>
          <section
            className="hidden min-h-[420px] overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] lg:grid lg:min-h-[620px] lg:h-[calc(100vh-13.5rem)] lg:grid-cols-[440px_minmax(0,1fr)]"
            aria-label="Schedule grid and timeline"
          >
            <div className="flex min-h-0 flex-col border-r border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
              <div
                ref={leftScrollRef}
                className="enterprise-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain"
                aria-label="Task list scroll area"
              >
                <table className="min-w-[540px] text-left text-sm">
                  <thead className="sticky top-0 z-20 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-xs uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <tr>
                      <th className="w-8 px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label="Select all tasks"
                          checked={allSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTaskIds(rows.map((x) => x.id));
                            else setSelectedTaskIds([]);
                          }}
                          className="h-3.5 w-3.5 accent-[var(--enterprise-primary)]"
                        />
                      </th>
                      <th className="px-3 py-2 font-medium">Task</th>
                      {takeoffEnabled ? <th className="px-1 py-2 font-medium">Takeoff</th> : null}
                      <th className="px-2 py-2 font-medium">Start</th>
                      <th className="px-2 py-2 font-medium">End</th>
                      <th className="w-10 px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--enterprise-border)]">
                    {rows.map((t) => {
                      const depth = depthOf(t.id, byId);
                      const isSelected = selectedSet.has(t.id);
                      return (
                        <tr
                          key={t.id}
                          className={`${tableRowHeightClass} ${isSelected ? "bg-[var(--enterprise-bg)]/40" : "bg-[var(--enterprise-surface)]"}`}
                        >
                          <td className="px-2 py-1.5 align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleTaskSelection(t.id, e.target.checked)}
                              aria-label={`Select task ${t.title}`}
                              className="h-3.5 w-3.5 accent-[var(--enterprise-primary)]"
                            />
                          </td>
                          <td className="px-3 py-1.5 align-middle">
                            <div className="flex items-center gap-2">
                              <SubtaskTreeConnector depth={depth} />
                              {(childCountByParent.get(t.id) ?? 0) > 0 ? (
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-surface-hover)] hover:text-[var(--enterprise-text)]"
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
                                <span className="h-4 w-4" aria-hidden />
                              )}
                              <input
                                className={`${inputHeightClass} min-w-0 flex-1 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-[var(--enterprise-text)]`}
                                value={t.title}
                                onChange={(e) => updateRow(t.id, { title: e.target.value })}
                                onBlur={(e) =>
                                  updateRow(t.id, { title: normalizeTaskTitle(e.target.value) })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addSibling(t.id);
                                    return;
                                  }
                                  if (e.key === "Tab") {
                                    e.preventDefault();
                                    const targets =
                                      selectedSet.has(t.id) && selectedTaskIds.length > 1
                                        ? selectedTaskIds
                                        : [t.id];
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
                            <td className="max-w-[140px] px-1 py-1.5 align-middle">
                              <button
                                type="button"
                                disabled={takeoffQuery.isPending}
                                className={`flex ${inputHeightClass} w-full items-center gap-1 truncate rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-left text-[11px] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-surface-hover)] disabled:opacity-50`}
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
                          <td className="px-2 py-1.5 align-middle">
                            <input
                              type="date"
                              className={`${inputHeightClass} w-38 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 text-[var(--enterprise-text)]`}
                              value={t.startDate}
                              onChange={(e) => updateRow(t.id, { startDate: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-middle">
                            <input
                              type="date"
                              className={`${inputHeightClass} w-38 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 text-[var(--enterprise-text)]`}
                              value={t.endDate}
                              onChange={(e) => updateRow(t.id, { endDate: e.target.value })}
                            />
                          </td>
                          <td className="relative px-1 py-1.5 align-middle">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="rounded p-1 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-surface-hover)] hover:text-[var(--enterprise-text)]"
                                aria-label="Add subtask"
                                onClick={() => addChild(t.id)}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-[var(--enterprise-text-muted)] hover:bg-red-50 hover:text-red-600"
                                aria-label="Delete task"
                                onClick={() =>
                                  setConfirmDeleteTaskId((prev) => (prev === t.id ? null : t.id))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
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
                                    className="rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-xs text-[var(--enterprise-text)]"
                                    onClick={() => setConfirmDeleteTaskId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white"
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
            </div>
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--enterprise-bg)]/15">
              <div
                ref={rightScrollRef}
                className="enterprise-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
                aria-label="Timeline scroll area"
              >
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
                    {ganttDependencyLines.map((line) => {
                      const verticalTop = Math.min(line.parentY, line.childY);
                      const verticalHeight = Math.max(1, Math.abs(line.childY - line.parentY));
                      const strokeClass = line.isActive
                        ? "bg-[var(--enterprise-primary)]/90"
                        : "bg-[var(--enterprise-text-muted)]/75";
                      const arrowLeftPct = line.childStartPct - 0.45;
                      return (
                        <div
                          key={line.key}
                          className="pointer-events-none absolute inset-0 z-[3]"
                          aria-hidden
                        >
                          <div
                            className={`absolute h-px ${strokeClass}`}
                            style={{
                              left: `${line.parentEndPct}%`,
                              width: `${Math.max(0.3, line.elbowPct - line.parentEndPct)}%`,
                              top: line.parentY,
                            }}
                          />
                          <div
                            className={`absolute w-px ${strokeClass}`}
                            style={{
                              left: `${line.elbowPct}%`,
                              top: verticalTop,
                              height: verticalHeight,
                            }}
                          />
                          <div
                            className={`absolute h-px ${strokeClass}`}
                            style={{
                              left: `${Math.min(line.elbowPct, line.childStartPct)}%`,
                              width: `${Math.max(0.3, Math.abs(line.childStartPct - line.elbowPct))}%`,
                              top: line.childY,
                            }}
                          />
                          <div
                            className={`absolute h-[5px] w-[5px] rounded-full ${strokeClass}`}
                            style={{ left: `${line.parentEndPct - 0.16}%`, top: line.parentY - 2 }}
                          />
                          <div
                            className="absolute h-0 w-0 border-y-[4px] border-y-transparent border-l-[6px]"
                            style={{
                              left: `${arrowLeftPct}%`,
                              top: line.childY - 4,
                              borderLeftColor: line.isActive
                                ? "var(--enterprise-primary)"
                                : "var(--enterprise-text-muted)",
                              opacity: line.isActive ? 0.9 : 0.75,
                            }}
                          />
                        </div>
                      );
                    })}
                    {rows.map((t) => {
                      const depth = depthOf(t.id, byId);
                      const start = parseYmd(t.startDate);
                      const end = parseYmd(t.endDate);
                      const { leftPct, widthPct } = barLayout(start, end, range.min, range.max);
                      const isChild = depth > 0;
                      const showPreview =
                        createPreview?.rowTaskId === t.id && createPreview.widthPct > 0;
                      return (
                        <div
                          key={t.id}
                          data-gantt-track
                          className={`relative ${ganttRowHeightClass} select-none rounded-sm border border-[var(--enterprise-border)]/40 bg-[var(--enterprise-bg)] ${
                            isChild ? "ring-1 ring-[var(--enterprise-border)]/30" : ""
                          } ${
                            selectedSet.has(t.id)
                              ? "ring-2 ring-[var(--enterprise-primary)]/35"
                              : ""
                          }`}
                          style={{ minWidth: timelineWidthPx }}
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
                            aria-label={`Add task on timeline (${t.title})`}
                            className="absolute inset-0 z-[1] cursor-crosshair border-0 bg-transparent p-0"
                            onPointerDown={(e) => onTrackPointerDown(e, t)}
                            onPointerMove={onTrackPointerMove}
                            onPointerUp={onTrackPointerUp}
                            onPointerCancel={onTrackPointerUp}
                          />
                          {showPreview ? (
                            <div
                              className="pointer-events-none absolute top-1/2 z-[2] h-3 -translate-y-1/2 rounded-sm border border-dashed border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/25"
                              style={{
                                left: `${createPreview.leftPct}%`,
                                width: `${createPreview.widthPct}%`,
                              }}
                              aria-hidden
                            />
                          ) : null}
                          <div
                            className={`absolute top-1/2 z-[4] flex h-3 -translate-y-1/2 items-stretch touch-none rounded-sm shadow-sm ${
                              isChild
                                ? "bg-[var(--enterprise-primary)]/65"
                                : "bg-[var(--enterprise-primary)]/85"
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
                              onPointerDown={(e) => onMoveBarDown(e, t.id)}
                              onPointerMove={onMoveBarMove}
                              onPointerUp={onMoveBarUp}
                              onPointerCancel={onMoveBarUp}
                            />
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

          <div className="space-y-3 lg:hidden">
            <p className="text-xs text-[var(--enterprise-text-muted)]">
              Timeline view uses horizontal space — use a larger screen for the chart, or edit dates
              below.
            </p>
            {rows.map((t) => {
              const depth = depthOf(t.id, byId);
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3"
                  style={{ marginLeft: depth * 8 }}
                >
                  <label className="block text-xs font-medium text-[var(--enterprise-text-muted)]">
                    Task
                    <input
                      className="mt-1 w-full rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-2 text-sm text-[var(--enterprise-text)]"
                      value={t.title}
                      onChange={(e) => updateRow(t.id, { title: e.target.value })}
                      onBlur={(e) => updateRow(t.id, { title: normalizeTaskTitle(e.target.value) })}
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
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm text-[var(--enterprise-text)]"
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
                      />
                    </label>
                    <label className="text-xs text-[var(--enterprise-text-muted)]">
                      End
                      <input
                        type="date"
                        className="mt-1 w-full rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-sm"
                        value={t.endDate}
                        onChange={(e) => updateRow(t.id, { endDate: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-[var(--enterprise-border)] px-2 py-1 text-xs"
                      onClick={() => addChild(t.id)}
                    >
                      Add subtask
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
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
