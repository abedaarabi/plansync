"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ContextMenu,
  Editor,
  Gantt,
  Toolbar,
  Tooltip,
  Willow,
  defaultTaskTypes,
  getDefaultColumns,
  getEditorItems,
  type IApi,
  type ILink,
  type ITask,
} from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import "./projectScheduleGantt.css";
import type { ScheduleTaskInput, ScheduleTaskLinkInput } from "@/lib/api-client";
import {
  ganttToScheduleLinks,
  ganttToScheduleTasks,
  scheduleToGanttLinks,
  scheduleToGanttTasks,
} from "@/lib/scheduleGanttAdapter";

const SYNC_EVENTS = [
  "update-task",
  "add-task",
  "delete-task",
  "move-task",
  "copy-task",
  "add-link",
  "update-link",
  "delete-link",
] as const;

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  delayed: "Delayed",
  completed: "Completed",
};

type Props = {
  tasks: ScheduleTaskInput[];
  links: ScheduleTaskLinkInput[];
  remountKey: number;
  onChange: (payload: { tasks: ScheduleTaskInput[]; links: ScheduleTaskLinkInput[] }) => void;
  onSelectTask?: (id: string | null) => void;
};

function weekendHighlight(date: Date, unit: "day" | "hour"): string {
  if (unit !== "day") return "";
  const day = date.getDay();
  return day === 0 || day === 6 ? "wx-weekend" : "";
}

function payloadKey(tasks: ScheduleTaskInput[], links: ScheduleTaskLinkInput[]) {
  return JSON.stringify({ tasks, links });
}

export function ProjectScheduleGantt({ tasks, links, remountKey, onChange, onSelectTask }: Props) {
  const [api, setApi] = useState<IApi | null>(null);
  const apiRef = useRef<IApi | null>(null);
  const syncingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onSelectTaskRef = useRef(onSelectTask);
  const lastEmittedRef = useRef("");
  onChangeRef.current = onChange;
  onSelectTaskRef.current = onSelectTask;

  // Seed data is frozen per remountKey so parent draft updates don't round-trip into Gantt props.
  const frozenRef = useRef<{
    key: number;
    tasks: ReturnType<typeof scheduleToGanttTasks>;
    links: ReturnType<typeof scheduleToGanttLinks>;
  } | null>(null);
  if (!frozenRef.current || frozenRef.current.key !== remountKey) {
    frozenRef.current = {
      key: remountKey,
      tasks: scheduleToGanttTasks(tasks ?? []),
      links: scheduleToGanttLinks(links ?? []),
    };
    lastEmittedRef.current = payloadKey(tasks ?? [], links ?? []);
  }
  const { tasks: frozenTasks, links: frozenLinks } = frozenRef.current;

  const columns = useMemo(() => {
    const base = getDefaultColumns({ wbs: true });
    const addIdx = base.findIndex((col) => col.id === "add-task");
    const statusCol = {
      id: "status",
      header: "Status",
      width: 108,
      align: "center" as const,
      template: (value: unknown) => STATUS_LABELS[String(value ?? "not_started")] ?? "Not started",
    };
    if (addIdx >= 0) {
      return [...base.slice(0, addIdx), statusCol, ...base.slice(addIdx)];
    }
    return [...base, statusCol];
  }, []);

  const editorItems = useMemo(
    () => [
      ...getEditorItems(),
      {
        key: "status",
        comp: "select" as const,
        label: "Status",
        options: [
          { id: "not_started", label: "Not started" },
          { id: "in_progress", label: "In progress" },
          { id: "delayed", label: "Delayed" },
          { id: "completed", label: "Completed" },
        ],
      },
    ],
    [],
  );

  const scales = useMemo(
    () => [
      { unit: "month", step: 1, format: "%F %Y" },
      { unit: "week", step: 1, format: "W%W" },
      { unit: "day", step: 1, format: "%j" },
    ],
    [],
  );

  const markers = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return [{ start: today, text: "Today", css: "wx-marker-today" }];
  }, [remountKey]);

  const syncFromApi = useCallback(() => {
    if (syncingRef.current) return;
    const ganttApi = apiRef.current;
    if (!ganttApi) return;
    const serializedTasks = ganttApi.serialize({ data: "tasks" }) as Partial<ITask>[] | null;
    const serializedLinks = ganttApi.serialize({ data: "links" }) as ILink[] | null;
    if (!serializedTasks) return;
    const nextTasks = ganttToScheduleTasks(serializedTasks);
    const nextLinks = ganttToScheduleLinks(serializedLinks ?? []);
    const key = payloadKey(nextTasks, nextLinks);
    if (key === lastEmittedRef.current) return;
    lastEmittedRef.current = key;
    onChangeRef.current({ tasks: nextTasks, links: nextLinks });
  }, []);

  const init = useCallback(
    (ganttApi: IApi) => {
      apiRef.current = ganttApi;
      setApi(ganttApi);
      for (const ev of SYNC_EVENTS) {
        ganttApi.on(ev, syncFromApi);
      }
      ganttApi.on("select-task", (ev: { id?: string | number }) => {
        onSelectTaskRef.current?.(ev?.id != null ? String(ev.id) : null);
      });
    },
    [syncFromApi],
  );

  useEffect(() => {
    setApi(null);
    apiRef.current = null;
    syncingRef.current = true;
    const t = window.setTimeout(() => {
      syncingRef.current = false;
    }, 200);
    return () => window.clearTimeout(t);
  }, [remountKey]);

  return (
    <div className="plansync-schedule-gantt schedule-print-grid overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
      <Willow fonts={false}>
        <div className="plansync-schedule-gantt-shell flex h-[calc(100vh-13.5rem)] min-h-[560px] flex-col">
          {api ? (
            <Toolbar api={api} />
          ) : (
            <div className="wx-toolbar min-h-10 border-b border-[var(--enterprise-border)]" />
          )}
          <div className="relative min-h-0 flex-1">
            <Tooltip api={api ?? undefined}>
              <ContextMenu api={api ?? undefined}>
                <Gantt
                  key={remountKey}
                  init={init}
                  tasks={frozenTasks}
                  links={frozenLinks}
                  columns={columns}
                  scales={scales}
                  markers={markers}
                  taskTypes={defaultTaskTypes}
                  zoom
                  autoScale
                  cellBorders="column"
                  durationUnit="day"
                  gridWidth={420}
                  highlightTime={weekendHighlight}
                />
              </ContextMenu>
            </Tooltip>
          </div>
          {api ? <Editor api={api} items={editorItems} /> : null}
        </div>
      </Willow>
    </div>
  );
}
