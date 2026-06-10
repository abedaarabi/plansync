"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartGantt, Download, Link2, Plus, Printer, Save, X } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  fetchDatacenterCommissioningTemplate,
  fetchProjectSchedule,
  fetchProjectSession,
  fetchTakeoffLinesForProject,
  ProRequiredError,
  putProjectSchedule,
  type ScheduleTaskInput,
  type ScheduleTaskLinkInput,
  type ScheduleTaskRow,
  type ScheduleTaskStatus,
  type TakeoffLineRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { AccessRestricted } from "@/components/enterprise/AccessRestricted";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { ProjectScheduleGantt } from "@/components/enterprise/ProjectScheduleGantt";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { normalizeTasksForSave, parseYmd, toYmd } from "@/lib/scheduleGanttAdapter";

type Props = { projectId: string };

const AUTOSAVE_MS = 900;

const STATUS_OPTIONS: { value: ScheduleTaskStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
];

const SCHEDULE_BTN_SECONDARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--enterprise-text)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-surface)] disabled:cursor-not-allowed disabled:opacity-60";

const SCHEDULE_BTN_PRIMARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-2.5 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-[var(--enterprise-primary-deep)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-surface)] disabled:cursor-not-allowed disabled:opacity-60";

const SCHEDULE_ICON_BTN =
  "cursor-pointer rounded p-1 text-[var(--enterprise-text-muted)] transition-all duration-150 hover:bg-[var(--enterprise-surface-hover)] hover:text-[var(--enterprise-text)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]";

function normalizeStatus(status: string | null | undefined): ScheduleTaskStatus {
  if (status === "in_progress") return "in_progress";
  if (status === "delayed") return "delayed";
  if (status === "completed") return "completed";
  return "not_started";
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-[1] flex max-h-[min(80vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--enterprise-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
            Link takeoff lines
          </h2>
          <button type="button" className={SCHEDULE_ICON_BTN} onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-[var(--enterprise-border)] px-4 py-2">
          <input
            className="h-9 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
            placeholder="Search lines…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="enterprise-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
              No takeoff lines match.
            </p>
          ) : (
            filtered.map((row) => {
              const checked = local.includes(row.id);
              return (
                <label
                  key={row.id}
                  className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 hover:bg-[var(--enterprise-bg)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setLocal((prev) =>
                        checked ? prev.filter((id) => id !== row.id) : [...prev, row.id],
                      )
                    }
                    className="mt-1 accent-[var(--enterprise-primary)]"
                  />
                  <span className="min-w-0 text-sm text-[var(--enterprise-text)]">
                    <span className="font-medium">
                      {row.label?.trim() || row.material?.name || "Takeoff line"}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--enterprise-text-muted)]">
                      {[row.quantity, row.unit, row.fileName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>
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
  takeoffEnabled: boolean;
  takeoffSummary: string;
  onClose: () => void;
  onChange: (id: string, patch: Partial<ScheduleTaskInput>) => void;
  onOpenTakeoff: () => void;
};

function TaskDetailPanel({
  task,
  takeoffEnabled,
  takeoffSummary,
  onClose,
  onChange,
  onOpenTakeoff,
}: TaskDetailPanelProps) {
  if (!task) return null;
  return (
    <aside
      className="no-print fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-2xl"
      aria-label="Task details"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--enterprise-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Task details</h2>
          <button type="button" className={SCHEDULE_ICON_BTN} onClick={onClose} aria-label="Close">
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
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
              Start
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-sm text-[var(--enterprise-text)]"
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
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--enterprise-text-muted)]">
            <input
              type="checkbox"
              checked={task.isMilestone}
              onChange={(e) => onChange(task.id, { isMilestone: e.target.checked })}
              className="accent-[var(--enterprise-primary)]"
            />
            Milestone
          </label>
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
          </label>
          {takeoffEnabled ? (
            <div>
              <span className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                Takeoff
              </span>
              <button
                type="button"
                className={`${SCHEDULE_BTN_SECONDARY} mt-1 w-full justify-center bg-[var(--enterprise-bg)]`}
                onClick={onOpenTakeoff}
              >
                <Link2 className="h-4 w-4" aria-hidden />
                {takeoffSummary}
              </button>
            </div>
          ) : null}
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

  const [draftTasks, setDraftTasks] = useState<ScheduleTaskInput[] | null>(null);
  const [draftLinks, setDraftLinks] = useState<ScheduleTaskLinkInput[]>([]);
  const [dirty, setDirty] = useState(false);
  const draftTasksRef = useRef<ScheduleTaskInput[] | null>(null);
  const draftLinksRef = useRef<ScheduleTaskLinkInput[]>([]);
  draftTasksRef.current = draftTasks;
  draftLinksRef.current = draftLinks;

  const [saveUi, setSaveUi] = useState<"saved" | "saving" | "pending" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [templatePending, setTemplatePending] = useState(false);
  const [ganttRemountKey, setGanttRemountKey] = useState(0);
  const scheduleHydratedRef = useRef(false);

  useEffect(() => {
    if (!scheduleQuery.data || scheduleHydratedRef.current) return;
    setDraftTasks(scheduleQuery.data.tasks.map(rowToInput));
    setDraftLinks(scheduleQuery.data.links);
    scheduleHydratedRef.current = true;
    setGanttRemountKey((k) => k + 1);
  }, [scheduleQuery.data]);

  const tasks = draftTasks ?? [];
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const panelTask = detailTaskId ? (byId.get(detailTaskId) ?? null) : null;
  const pickerTask = pickerTaskId ? (byId.get(pickerTaskId) ?? null) : null;

  const saveMutation = useMutation({
    mutationFn: (payload: { tasks: ScheduleTaskInput[]; links: ScheduleTaskLinkInput[] }) =>
      putProjectSchedule(projectId, {
        tasks: normalizeTasksForSave(payload.tasks),
        links: payload.links,
      }),
    onMutate: () => {
      setSaveUi((prev) => (prev === "saving" ? prev : "saving"));
    },
    onSuccess: async (saved, variables) => {
      if (draftTasksRef.current !== variables.tasks || draftLinksRef.current !== variables.links) {
        setSaveUi((prev) => (prev === "saving" ? "pending" : prev));
        return;
      }
      setDirty(false);
      setDraftTasks(saved.tasks.map(rowToInput));
      setDraftLinks(saved.links);
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
    if (!dirty || draftTasks === null) return;
    const t = window.setTimeout(() => {
      const taskPayload = draftTasksRef.current;
      if (!taskPayload) return;
      saveMutation.mutate({ tasks: taskPayload, links: draftLinksRef.current });
    }, AUTOSAVE_MS);
    setSaveUi((prev) => (prev === "saving" || prev === "pending" ? prev : "pending"));
    return () => window.clearTimeout(t);
  }, [draftTasks, draftLinks, dirty, saveMutation]);

  const updateRow = useCallback((id: string, patch: Partial<ScheduleTaskInput>) => {
    setDirty(true);
    setDraftTasks((prev) =>
      prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev,
    );
  }, []);

  const handleGanttChange = useCallback(
    (payload: { tasks: ScheduleTaskInput[]; links: ScheduleTaskLinkInput[] }) => {
      setDirty(true);
      setDraftTasks(payload.tasks);
      setDraftLinks(payload.links);
    },
    [],
  );

  const closeDetailPanel = useCallback(() => {
    setDetailTaskId(null);
    setGanttRemountKey((k) => k + 1);
  }, []);

  const addTopLevelTask = useCallback(() => {
    const created = makeRow();
    const maxOrder = tasks.reduce((m, t) => (t.parentId ? m : Math.max(m, t.sortOrder)), -1);
    const next = [...tasks, { ...created, sortOrder: maxOrder + 1 }];
    setDirty(true);
    setDraftTasks(next);
    setGanttRemountKey((k) => k + 1);
    setDetailTaskId(created.id);
  }, [tasks]);

  const applyDatacenterTemplate = useCallback(
    async (mode: "append" | "replace") => {
      setTemplatePending(true);
      try {
        const tpl = await fetchDatacenterCommissioningTemplate(projectId, mode);
        setDirty(true);
        if (mode === "replace") {
          setDraftTasks(tpl.tasks);
          setDraftLinks(tpl.links);
        } else {
          setDraftTasks((prev) => [...(prev ?? []), ...tpl.tasks]);
          setDraftLinks((prev) => [...prev, ...tpl.links]);
        }
        setGanttRemountKey((k) => k + 1);
        toast.success(
          mode === "replace"
            ? "Schedule replaced with commissioning template."
            : "Commissioning template appended.",
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not apply template.");
      } finally {
        setTemplatePending(false);
      }
    },
    [projectId],
  );

  const exportCsv = useCallback(() => {
    if (tasks.length === 0) return;
    const header = ["WBS", "Task", "Start", "End", "Duration (days)", "Progress %", "Status"];
    const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean) as string[]);
    const wbs = new Map<string, string>();
    const childrenByParent = new Map<string | null, ScheduleTaskInput[]>();
    for (const t of tasks) {
      const key = t.parentId && parentIds.has(t.parentId) ? t.parentId : null;
      const arr = childrenByParent.get(key) ?? [];
      arr.push(t);
      childrenByParent.set(key, arr);
    }
    function walk(parentId: string | null, prefix: number[]) {
      const kids = (childrenByParent.get(parentId) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      );
      kids.forEach((child, idx) => {
        const next = [...prefix, idx + 1];
        wbs.set(child.id, next.join("."));
        walk(child.id, next);
      });
    }
    walk(null, []);
    const rows = tasks
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => {
        const start = parseYmd(t.startDate);
        const end = parseYmd(t.endDate);
        const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        return [
          wbs.get(t.id) ?? "",
          t.title,
          t.startDate,
          t.endDate,
          String(days),
          String(t.progressPercent),
          t.status,
        ];
      });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectId, tasks]);

  const openPrintDialog = useCallback(() => {
    window.print();
  }, []);

  if (sessionPending) {
    return <EnterpriseLoadingState message="Loading project…" label="Loading" />;
  }
  if (!session) {
    return <AccessRestricted backHref={`/projects/${projectId}/home`} />;
  }
  if (session.uiMode !== "internal") {
    return <AccessRestricted backHref={`/projects/${projectId}/home`} />;
  }
  if (!session.settings.modules.schedule) {
    return (
      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 text-sm text-[var(--enterprise-text-muted)]">
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

  if (scheduleQuery.isPending || (scheduleQuery.isSuccess && draftTasks === null)) {
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
          ? "Save failed — retry by editing"
          : "Saved";

  const saveTimeLabel = lastSavedAt
    ? lastSavedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";

  const totalTasks = tasks.length;
  const delayedTasks = tasks.filter((t) => normalizeStatus(t.status) === "delayed").length;
  const inProgressTasks = tasks.filter((t) => normalizeStatus(t.status) === "in_progress").length;
  const completedTasks = tasks.filter((t) => normalizeStatus(t.status) === "completed").length;
  const avgProgress =
    totalTasks === 0
      ? 0
      : Math.round(
          tasks.reduce((sum, t) => sum + Math.max(0, Math.min(100, t.progressPercent)), 0) /
            totalTasks,
        );

  return (
    <div className={`schedule-print-root min-w-0 ${OM_PAGE_CLASS}`}>
      {panelTask ? (
        <button
          type="button"
          className="no-print fixed inset-0 z-30 bg-black/20"
          onClick={closeDetailPanel}
          aria-label="Close task details"
        />
      ) : null}

      <TaskDetailPanel
        task={panelTask}
        takeoffEnabled={takeoffEnabled}
        takeoffSummary={
          panelTask ? takeoffSummaryLabel(panelTask.takeoffLineIds, takeoffById) : "Link takeoff"
        }
        onClose={closeDetailPanel}
        onChange={updateRow}
        onOpenTakeoff={() => panelTask && setPickerTaskId(panelTask.id)}
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

      <OmSubPageHeader
        icon={ChartGantt}
        title="Construction schedule"
        badge="Beta"
        description="WBS hierarchy, dependencies, toolbar, and double-click task editor — built for large construction programmes."
      >
        <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Tasks
            </p>
            <p className="text-base font-semibold tabular-nums text-[var(--enterprise-text)]">
              {totalTasks}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Dependencies
            </p>
            <p className="text-base font-semibold tabular-nums text-[var(--enterprise-text)]">
              {draftLinks.length}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              In progress
            </p>
            <p className="text-base font-semibold tabular-nums text-blue-700">{inProgressTasks}</p>
          </div>
          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Delayed
            </p>
            <p className="text-base font-semibold tabular-nums text-rose-700">{delayedTasks}</p>
          </div>
          <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Completed
            </p>
            <p className="text-base font-semibold tabular-nums text-emerald-700">
              {completedTasks}
            </p>
          </div>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2 pt-2">
          <span
            className="rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1 text-xs text-[var(--enterprise-text-muted)]"
            aria-live="polite"
          >
            {saveLabel}
            {saveTimeLabel ? ` · Last saved ${saveTimeLabel}` : ""}
            {` · Avg progress ${avgProgress}%`}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!draftTasks) return;
              saveMutation.mutate({ tasks: draftTasks, links: draftLinks });
            }}
            disabled={!dirty || saveMutation.isPending || !draftTasks}
            className={SCHEDULE_BTN_SECONDARY}
          >
            <Save className="h-4 w-4" aria-hidden />
            Save now
          </button>
          <button type="button" onClick={addTopLevelTask} className={SCHEDULE_BTN_SECONDARY}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add task
          </button>
          <button
            type="button"
            onClick={() => void applyDatacenterTemplate("append")}
            disabled={templatePending}
            className={SCHEDULE_BTN_SECONDARY}
          >
            {templatePending ? "Applying…" : "Append DC template"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Replace the current schedule with the datacenter commissioning template?",
                )
              ) {
                void applyDatacenterTemplate("replace");
              }
            }}
            disabled={templatePending}
            className={SCHEDULE_BTN_SECONDARY}
          >
            Replace with template
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={tasks.length === 0}
            className={SCHEDULE_BTN_SECONDARY}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button type="button" onClick={openPrintDialog} className={SCHEDULE_BTN_SECONDARY}>
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
        </div>
      </OmSubPageHeader>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 text-center">
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            No schedule rows yet. Add tasks manually or start from the datacenter commissioning
            template.
          </p>
          <button
            type="button"
            onClick={addTopLevelTask}
            className={`${SCHEDULE_BTN_PRIMARY} mt-4 px-4`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Start a schedule
          </button>
        </div>
      ) : (
        <ProjectScheduleGantt
          tasks={tasks}
          links={draftLinks}
          remountKey={ganttRemountKey}
          onChange={handleGanttChange}
          onSelectTask={setDetailTaskId}
        />
      )}
    </div>
  );
}
