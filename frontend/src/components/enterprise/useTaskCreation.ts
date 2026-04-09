"use client";

import { useCallback, useRef, useState } from "react";

type TimelineRange = { min: Date; max: Date };

type CreateDragState = {
  rowTaskId: string;
  parentId: string | null;
  pointerId: number;
  originX: number;
  currentX: number;
  rowEl: HTMLElement;
};

type CreatePreview = {
  rowTaskId: string;
  leftPct: number;
  widthPct: number;
};

type UseTaskCreationOptions = {
  rangeRef: React.MutableRefObject<TimelineRange>;
  minDragPx?: number;
  onCreateTask: (parentId: string | null, start: Date, end: Date) => void;
};

function snapToLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function clientXToDate(clientX: number, rect: DOMRect, min: Date, max: Date): Date {
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const span = Math.max(1, max.getTime() - min.getTime());
  const t = min.getTime() + (x / rect.width) * span;
  return new Date(t);
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

export function useTaskCreation({ rangeRef, minDragPx = 8, onCreateTask }: UseTaskCreationOptions) {
  const dragStateRef = useRef<CreateDragState | null>(null);
  const [createPreview, setCreatePreview] = useState<CreatePreview | null>(null);

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent, rowTaskId: string, parentId: string | null) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        rowTaskId,
        parentId,
        pointerId: e.pointerId,
        originX: e.clientX,
        currentX: e.clientX,
        rowEl: el,
      };
      setCreatePreview({ rowTaskId, leftPct: 0, widthPct: 0 });
    },
    [],
  );

  const onTrackPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragStateRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.currentX = e.clientX;
      const rect = d.rowEl.getBoundingClientRect();
      const r = rangeRef.current;
      const a = snapToLocalDay(clientXToDate(Math.min(d.originX, d.currentX), rect, r.min, r.max));
      const b = snapToLocalDay(clientXToDate(Math.max(d.originX, d.currentX), rect, r.min, r.max));
      const { leftPct, widthPct } = barLayout(a, b, r.min, r.max);
      setCreatePreview({ rowTaskId: d.rowTaskId, leftPct, widthPct });
    },
    [rangeRef],
  );

  const onTrackPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragStateRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const el = e.currentTarget as HTMLElement;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const dx = Math.abs(d.currentX - d.originX);
      if (dx < minDragPx) {
        setCreatePreview(null);
        dragStateRef.current = null;
        return;
      }
      const rect = d.rowEl.getBoundingClientRect();
      const r = rangeRef.current;
      let start = snapToLocalDay(
        clientXToDate(Math.min(d.originX, d.currentX), rect, r.min, r.max),
      );
      let end = snapToLocalDay(clientXToDate(Math.max(d.originX, d.currentX), rect, r.min, r.max));
      if (end.getTime() < start.getTime()) [start, end] = [end, start];
      onCreateTask(d.parentId, start, end);
      setCreatePreview(null);
      dragStateRef.current = null;
    },
    [minDragPx, onCreateTask, rangeRef],
  );

  const onTrackPointerCancel = useCallback((e: React.PointerEvent) => {
    const d = dragStateRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    setCreatePreview(null);
    dragStateRef.current = null;
  }, []);

  return {
    createPreview,
    onTrackPointerDown,
    onTrackPointerMove,
    onTrackPointerUp,
    onTrackPointerCancel,
  };
}
