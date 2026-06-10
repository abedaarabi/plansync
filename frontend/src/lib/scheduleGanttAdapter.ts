import type { ILink, ITask } from "@svar-ui/react-gantt";
import type {
  ScheduleLinkType,
  ScheduleTaskInput,
  ScheduleTaskLinkInput,
  ScheduleTaskStatus,
} from "@/lib/api-client";

export const GANTT_ROOT_PARENT = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const span = Math.max(0, end.getTime() - start.getTime());
  return Math.max(1, Math.round(span / DAY_MS) + 1);
}

function normalizeStatus(status: unknown): ScheduleTaskStatus {
  if (status === "in_progress") return "in_progress";
  if (status === "delayed") return "delayed";
  if (status === "completed") return "completed";
  return "not_started";
}

function parentFromGantt(parent: unknown): string | null {
  if (parent === null || parent === undefined || parent === GANTT_ROOT_PARENT || parent === "0") {
    return null;
  }
  return String(parent);
}

function ganttTypeForTask(task: ScheduleTaskInput, parentIds: Set<string>): ITask["type"] {
  if (task.isMilestone) return "milestone";
  if (parentIds.has(task.id)) return "summary";
  return "task";
}

export function scheduleToGanttTasks(tasks: ScheduleTaskInput[]): ITask[] {
  const parentIds = new Set<string>();
  for (const task of tasks) {
    if (task.parentId) parentIds.add(task.parentId);
  }
  return tasks.map((task) => {
    const start = parseYmd(task.startDate);
    const end = parseYmd(task.endDate);
    const milestone = Boolean(task.isMilestone);
    const hasChildren = parentIds.has(task.id);
    const status = normalizeStatus(task.status);
    return {
      id: task.id,
      text: task.title,
      start,
      end: milestone ? start : end,
      duration: milestone ? 0 : daysBetweenInclusive(start, end),
      progress: Math.max(0, Math.min(100, Math.round(task.progressPercent))),
      parent: task.parentId ?? GANTT_ROOT_PARENT,
      type: ganttTypeForTask(task, parentIds),
      ...(hasChildren ? { open: true } : {}),
      status,
      css: `schedule-status-${status}`,
      takeoffLineIds: task.takeoffLineIds ?? [],
      sortOrder: task.sortOrder,
    };
  });
}

export function scheduleToGanttLinks(links: ScheduleTaskLinkInput[]): ILink[] {
  return links.map((link) => ({
    id: link.id,
    source: link.sourceId,
    target: link.targetId,
    type: link.type,
    lag: link.lagDays,
  }));
}

export function ganttToScheduleTasks(tasks: Partial<ITask>[]): ScheduleTaskInput[] {
  const rows = tasks.map((task, index) => {
    const id = String(task.id ?? `task_${index}`);
    const parentId = parentFromGantt(task.parent);
    const start = task.start instanceof Date ? task.start : parseYmd(toYmd(new Date()));
    const endRaw =
      task.end instanceof Date
        ? task.end
        : task.duration && task.duration > 0
          ? new Date(start.getTime() + (Number(task.duration) - 1) * DAY_MS)
          : start;
    const milestone = task.type === "milestone";
    const takeoffLineIds = Array.isArray(task.takeoffLineIds)
      ? task.takeoffLineIds.map(String)
      : [];
    return {
      id,
      title: String(task.text ?? "Untitled task").trim() || "Untitled task",
      parentId,
      sortOrder: typeof task.sortOrder === "number" ? task.sortOrder : index,
      startDate: toYmd(start),
      endDate: toYmd(milestone ? start : endRaw),
      isMilestone: milestone,
      progressPercent: Math.max(0, Math.min(100, Math.round(Number(task.progress ?? 0)))),
      status: normalizeStatus(task.status),
      takeoffLineIds,
    };
  });

  const byParent = new Map<string | null, ScheduleTaskInput[]>();
  for (const row of rows) {
    const key = row.parentId;
    const arr = byParent.get(key) ?? [];
    arr.push(row);
    byParent.set(key, arr);
  }
  for (const group of byParent.values()) {
    group.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    group.forEach((row, idx) => {
      row.sortOrder = idx;
    });
  }
  return rows;
}

export function ganttToScheduleLinks(links: ILink[]): ScheduleTaskLinkInput[] {
  return links.map((link, index) => ({
    id: String(link.id ?? `link_${index}`),
    sourceId: String(link.source),
    targetId: String(link.target),
    type: (link.type ?? "e2s") as ScheduleLinkType,
    lagDays: Number(link.lag ?? 0),
  }));
}

export function normalizeTasksForSave(tasks: ScheduleTaskInput[]): ScheduleTaskInput[] {
  return tasks.map((t) => ({
    ...t,
    title: t.title.trim() || "Untitled task",
  }));
}
