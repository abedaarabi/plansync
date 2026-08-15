"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CommittedAnnotationsSvg } from "@/components/pdf-viewer/CommittedAnnotationsSvg";
import {
  clampNorm,
  diamondPointsFromRectCorners,
  normFromEvent,
  overlayCssSizePx,
} from "@/components/pdf-viewer/pdf-page-view/coordHelpers";
import { pickAnnotationAt, translateAnnotationPoints } from "@/lib/annotationHitTest";
import {
  anchorAnnotationToWorld,
  decimateNormPoints,
  migrateLegacyBimMarkups,
  projectAnnotationForDisplay,
  projectedAnnotationsKey,
} from "@/lib/bim/bimMarkupWorld";
import { bimAnnotationToSheetAnnotation } from "@/lib/bim/bimAnnotationAdapter";
import { scheduleBimMarkupPersist } from "@/lib/bim/bimMarkupSync";
import type { BimEngine } from "./bimEngine";
import { markupShapeToType, useBimMarkupStore, type BimAnnotation } from "@/store/bimMarkupStore";
import { useProjectMeasurementSystem } from "@/hooks/useProjectMeasurementSystem";
import { defaultMeasureUnitForProject } from "@/lib/projectMeasurement";

type Props = {
  /** When true, pointer handlers for draw/select are enabled. */
  interactive: boolean;
  engine: BimEngine | null;
  container: HTMLElement | null;
  projectId?: string | null;
};

// fallow-ignore-next-line complexity
export function BimMarkupOverlay({ interactive, engine, container, projectId }: Props) {
  const { measurementSystem } = useProjectMeasurementSystem(projectId ?? undefined);
  const measureUnit = defaultMeasureUnitForProject(measurementSystem);
  const annotations = useBimMarkupStore((s) => s.annotations);
  const selectedIds = useBimMarkupStore((s) => s.selectedIds);
  const markupShape = useBimMarkupStore((s) => s.markupShape);
  const markupMode = useBimMarkupStore((s) => s.markupMode);
  const strokeColor = useBimMarkupStore((s) => s.strokeColor);
  const strokeWidth = useBimMarkupStore((s) => s.strokeWidth);
  const addAnnotation = useBimMarkupStore((s) => s.addAnnotation);
  const updateAnnotation = useBimMarkupStore((s) => s.updateAnnotation);
  const setSelectedIds = useBimMarkupStore((s) => s.setSelectedIds);
  const removeAnnotations = useBimMarkupStore((s) => s.removeAnnotations);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [cameraJson, setCameraJson] = useState<Record<string, unknown>>({});
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [rectDrag, setRectDrag] = useState<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  } | null>(null);
  const [lineMarkup, setLineMarkup] = useState<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  } | null>(null);
  const [textAnchor, setTextAnchor] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const dragRef = useRef<{
    id: string;
    start: { x: number; y: number };
    origin: { x: number; y: number }[];
  } | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const handledUpRef = useRef<number | null>(null);
  const migratedRef = useRef(false);
  const projectedKeyRef = useRef("");
  const draggingIdRef = useRef<string | null>(null);
  const [displayAnnotations, setDisplayAnnotations] = useState<BimAnnotation[]>([]);

  // fallow-ignore-next-line complexity
  const hasActiveDraft = useCallback(() => {
    return (
      draftPoints !== null ||
      rectDrag !== null ||
      lineMarkup !== null ||
      textAnchor !== null ||
      dragRef.current !== null
    );
  }, [draftPoints, rectDrag, lineMarkup, textAnchor]);

  useEffect(() => {
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const { w, h } = overlayCssSizePx(container);
      setSize({ w, h });
    });
    ro.observe(container);
    const { w, h } = overlayCssSizePx(container);
    setSize({ w, h });
    return () => ro.disconnect();
  }, [container]);

  useEffect(() => {
    if (!engine) {
      projectedKeyRef.current = "";
      setDisplayAnnotations([]);
      return;
    }
    let raf = 0;
    const tick = () => {
      const cam = engine.getCameraState();
      setCameraJson(cam);
      const anns = useBimMarkupStore.getState().annotations;
      const dragId = draggingIdRef.current;
      const projected = anns
        .map((a) => {
          if (dragId === a.id) return a;
          return projectAnnotationForDisplay(engine, a, size.w, size.h, cam);
        })
        .filter((a): a is BimAnnotation => a != null);
      const key = projectedAnnotationsKey(projected);
      if (key !== projectedKeyRef.current) {
        projectedKeyRef.current = key;
        setDisplayAnnotations(projected);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, size.w, size.h]);

  // fallow-ignore-next-line complexity
  useEffect(() => {
    if (!engine || !useBimMarkupStore.getState().viewerStateHydrated || migratedRef.current) return;
    const pending = useBimMarkupStore.getState().annotations.some((a) => !a.worldPoints?.length);
    if (!pending) {
      migratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      const current = useBimMarkupStore.getState().annotations;
      const migrated = await migrateLegacyBimMarkups(engine, current);
      if (cancelled) return;
      migratedRef.current = true;
      if (migrated !== current) {
        useBimMarkupStore.getState().setAnnotations(migrated);
        scheduleBimMarkupPersist();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, annotations.length]);

  const sheetVisible = useMemo(
    () => displayAnnotations.map(bimAnnotationToSheetAnnotation),
    [displayAnnotations],
  );

  const getCamera = useCallback((): Record<string, unknown> => {
    return engine?.getCameraState() ?? cameraJson;
  }, [engine, cameraJson]);

  const commitAnnotation = useCallback(
    async (partial: Omit<BimAnnotation, "id" | "createdAt" | "cameraJson">) => {
      const points =
        partial.type === "polyline" || partial.type === "highlight"
          ? decimateNormPoints(partial.points)
          : partial.points;
      const worldPoints = engine ? await anchorAnnotationToWorld(engine, points) : undefined;
      addAnnotation({
        ...partial,
        points,
        worldPoints,
        cameraJson: getCamera(),
      });
      scheduleBimMarkupPersist();
    },
    [addAnnotation, engine, getCamera],
  );

  const reanchorAnnotation = useCallback(
    async (id: string, points: { x: number; y: number }[]) => {
      if (!engine) return;
      const worldPoints = await anchorAnnotationToWorld(engine, points);
      updateAnnotation(id, { points, worldPoints });
      scheduleBimMarkupPersist();
    },
    [engine, updateAnnotation],
  );

  const cancelDrafts = useCallback(() => {
    setDraftPoints(null);
    setRectDrag(null);
    setLineMarkup(null);
    setTextAnchor(null);
    setTextValue("");
    activePointerRef.current = null;
    handledUpRef.current = null;
  }, []);

  useEffect(() => {
    if (!interactive) cancelDrafts();
  }, [interactive, cancelDrafts]);

  useEffect(() => {
    cancelDrafts();
  }, [markupShape, cancelDrafts]);

  useEffect(() => {
    if (!interactive) return;
    // fallow-ignore-next-line complexity
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        cancelDrafts();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          removeAnnotations(selectedIds);
          setSelectedIds([]);
          scheduleBimMarkupPersist();
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, selectedIds, cancelDrafts, removeAnnotations, setSelectedIds]);

  const onPointerDown = useCallback(
    // fallow-ignore-next-line complexity
    (e: PointerEvent) => {
      if (!interactive || !container || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(".bim-markup-text-input")) return;

      if (activePointerRef.current != null && activePointerRef.current !== e.pointerId) return;

      const raw = normFromEvent(e as unknown as ReactPointerEvent, container);
      const sn = clampNorm(raw);
      const { w: cssW, h: cssH } = overlayCssSizePx(container);

      if (markupMode === "select") {
        const sheetAll = displayAnnotations.map(bimAnnotationToSheetAnnotation);
        const hit = pickAnnotationAt(sheetAll, sn.x, sn.y, cssW, cssH, cssW, cssH, 1);
        if (hit) {
          const ann = displayAnnotations.find((a) => a.id === hit);
          if (ann) {
            setSelectedIds([hit]);
            const source = annotations.find((a) => a.id === hit);
            dragRef.current = {
              id: hit,
              start: { x: sn.x, y: sn.y },
              origin: (source?.points ?? ann.points).map((p) => ({ ...p })),
            };
            draggingIdRef.current = hit;
            container.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
          }
        } else {
          setSelectedIds([]);
        }
        return;
      }

      if (hasActiveDraft() && markupShape !== "line" && markupShape !== "arrow") {
        return;
      }

      if (markupShape === "text") {
        setTextAnchor({ x: sn.x, y: sn.y });
        setTextValue("");
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (
        markupShape === "rect" ||
        markupShape === "cloud" ||
        markupShape === "ellipse" ||
        markupShape === "cross" ||
        markupShape === "diamond"
      ) {
        if (rectDrag) return;
        handledUpRef.current = null;
        activePointerRef.current = e.pointerId;
        setRectDrag({ a: { x: sn.x, y: sn.y }, b: { x: sn.x, y: sn.y } });
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (markupShape === "line" || markupShape === "arrow") {
        if (!lineMarkup) {
          handledUpRef.current = null;
          activePointerRef.current = e.pointerId;
          setLineMarkup({ a: { x: sn.x, y: sn.y }, b: { x: sn.x, y: sn.y } });
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const end = { x: sn.x, y: sn.y };
        if (Math.hypot(end.x - lineMarkup.a.x, end.y - lineMarkup.a.y) < 0.001) {
          setLineMarkup(null);
          return;
        }
        void commitAnnotation({
          type: "line",
          color: strokeColor,
          strokeWidth,
          points: [lineMarkup.a, end],
          arrowHead: markupShape === "arrow",
        });
        setLineMarkup(null);
        activePointerRef.current = null;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (markupShape === "freehand" || markupShape === "highlight") {
        if (draftPoints) return;
        handledUpRef.current = null;
        activePointerRef.current = e.pointerId;
        setDraftPoints([{ x: sn.x, y: sn.y }]);
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [
      interactive,
      container,
      markupMode,
      markupShape,
      annotations,
      displayAnnotations,
      lineMarkup,
      strokeColor,
      strokeWidth,
      commitAnnotation,
      setSelectedIds,
      hasActiveDraft,
      draftPoints,
    ],
  );

  const onPointerMove = useCallback(
    // fallow-ignore-next-line complexity
    (e: PointerEvent) => {
      if (!interactive || !container) return;
      if (activePointerRef.current != null && e.pointerId !== activePointerRef.current) return;

      const raw = normFromEvent(e as unknown as ReactPointerEvent, container);
      const sn = clampNorm(raw);

      if (dragRef.current) {
        const dx = sn.x - dragRef.current.start.x;
        const dy = sn.y - dragRef.current.start.y;
        const moved = translateAnnotationPoints(dragRef.current.origin, dx, dy);
        updateAnnotation(dragRef.current.id, { points: moved });
        e.preventDefault();
        return;
      }

      if (draftPoints) {
        setDraftPoints((prev) => [...(prev ?? []), { x: sn.x, y: sn.y }]);
        e.preventDefault();
        return;
      }

      if (rectDrag) {
        setRectDrag((r) => (r ? { ...r, b: { x: sn.x, y: sn.y } } : null));
        e.preventDefault();
        return;
      }

      if (lineMarkup && markupShape !== "line" && markupShape !== "arrow") {
        setLineMarkup((l) => (l ? { ...l, b: { x: sn.x, y: sn.y } } : null));
      } else if (lineMarkup) {
        setLineMarkup((l) => (l ? { ...l, b: { x: sn.x, y: sn.y } } : null));
      }
    },
    [interactive, container, draftPoints, rectDrag, lineMarkup, markupShape, updateAnnotation],
  );

  const onPointerUp = useCallback(
    // fallow-ignore-next-line complexity
    (e: PointerEvent) => {
      if (!interactive || !container) return;

      if (dragRef.current) {
        dragRef.current = null;
        scheduleBimMarkupPersist();
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      if (draftPoints && draftPoints.length > 1) {
        commitAnnotation({
          type: markupShapeToType(markupShape),
          color: strokeColor,
          strokeWidth: markupShape === "highlight" ? Math.max(strokeWidth, 8) : strokeWidth,
          points: draftPoints,
        });
        setDraftPoints(null);
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      if (rectDrag) {
        const { a, b } = rectDrag;
        if (Math.hypot(b.x - a.x, b.y - a.y) > 0.005) {
          let type = markupShapeToType(markupShape);
          let points: { x: number; y: number }[] = [a, b];
          if (markupShape === "diamond") {
            points = diamondPointsFromRectCorners(a, b);
            type = "diamond";
          }
          void commitAnnotation({
            type,
            color: strokeColor,
            strokeWidth,
            points,
          });
        }
        setRectDrag(null);
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      if (draftPoints) setDraftPoints(null);
    },
    [
      interactive,
      container,
      draftPoints,
      rectDrag,
      markupShape,
      strokeColor,
      strokeWidth,
      commitAnnotation,
    ],
  );

  const onPointerCancel = useCallback(
    (e: PointerEvent) => {
      if (!interactive || !container) return;
      dragRef.current = null;
      setDraftPoints(null);
      setRectDrag(null);
      setLineMarkup(null);
      activePointerRef.current = null;
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [interactive, container],
  );

  useEffect(() => {
    if (!interactive || !container) return;
    const opts = { capture: true };
    container.addEventListener("pointerdown", onPointerDown, opts);
    container.addEventListener("pointermove", onPointerMove, opts);
    container.addEventListener("pointerup", onPointerUp, opts);
    container.addEventListener("pointercancel", onPointerCancel, opts);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown, opts);
      container.removeEventListener("pointermove", onPointerMove, opts);
      container.removeEventListener("pointerup", onPointerUp, opts);
      container.removeEventListener("pointercancel", onPointerCancel, opts);
    };
  }, [interactive, container, onPointerDown, onPointerMove, onPointerUp, onPointerCancel]);

  const submitText = () => {
    if (!textAnchor || !textValue.trim()) {
      setTextAnchor(null);
      return;
    }
    void commitAnnotation({
      type: "text",
      color: strokeColor,
      strokeWidth,
      points: [textAnchor],
      text: textValue.trim(),
    });
    setTextAnchor(null);
    setTextValue("");
  };

  // fallow-ignore-next-line complexity
  const draftSheet = useMemo(() => {
    const drafts: ReturnType<typeof bimAnnotationToSheetAnnotation>[] = [];
    if (draftPoints && draftPoints.length > 1) {
      drafts.push(
        bimAnnotationToSheetAnnotation({
          id: "draft-poly",
          type: markupShapeToType(markupShape),
          color: strokeColor,
          strokeWidth,
          points: draftPoints,
          cameraJson: getCamera(),
          createdAt: Date.now(),
        }),
      );
    }
    if (rectDrag) {
      let type = markupShapeToType(markupShape);
      let points: { x: number; y: number }[] = [rectDrag.a, rectDrag.b];
      if (markupShape === "diamond") {
        points = diamondPointsFromRectCorners(rectDrag.a, rectDrag.b);
        type = "diamond";
      }
      drafts.push(
        bimAnnotationToSheetAnnotation({
          id: "draft-rect",
          type,
          color: strokeColor,
          strokeWidth,
          points,
          cameraJson: getCamera(),
          createdAt: Date.now(),
        }),
      );
    }
    if (lineMarkup) {
      drafts.push(
        bimAnnotationToSheetAnnotation({
          id: "draft-line",
          type: "line",
          color: strokeColor,
          strokeWidth,
          points: [lineMarkup.a, lineMarkup.b],
          arrowHead: markupShape === "arrow",
          cameraJson: getCamera(),
          createdAt: Date.now(),
        }),
      );
    }
    return drafts;
  }, [draftPoints, rectDrag, lineMarkup, markupShape, strokeColor, strokeWidth, getCamera]);

  if (!container) return null;

  const legacyOffViewCount = annotations.filter(
    (a) => !a.worldPoints?.length && !displayAnnotations.some((d) => d.id === a.id),
  ).length;

  return (
    <div ref={overlayRef} className="bim-markup-overlay pointer-events-none absolute inset-0 z-[5]">
      {legacyOffViewCount > 0 ? (
        <div className="bim-markup-offview-chip bim-glass-surface pointer-events-auto">
          {legacyOffViewCount} markup{legacyOffViewCount === 1 ? "" : "s"} on other views
        </div>
      ) : null}

      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${size.w} ${size.h}`}
        aria-hidden
      >
        <CommittedAnnotationsSvg
          annotations={[...sheetVisible, ...draftSheet]}
          cssW={size.w}
          cssH={size.h}
          pageW={size.w}
          pageH={size.h}
          scale={1}
          measureUnit={measureUnit}
          arrowMarkerId="bim-markup-arrow-head"
          selectedAnnotationIds={selectedIds}
        />
      </svg>

      {textAnchor ? (
        <div
          className="bim-markup-text-input bim-glass-surface pointer-events-auto absolute z-10 flex flex-col gap-1.5 p-2"
          style={{
            left: `${textAnchor.x * 100}%`,
            top: `${textAnchor.y * 100}%`,
            transform: "translate(-8px, -8px)",
          }}
        >
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitText();
              if (e.key === "Escape") setTextAnchor(null);
            }}
            placeholder="Comment text"
            className="min-w-[10rem] rounded-md border border-[var(--bim-border)] bg-[var(--bim-panel)] px-2 py-1 text-[12px] text-[var(--bim-text)]"
            autoFocus
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={submitText}
              className="bim-btn-primary flex-1 py-1 text-[11px]"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setTextAnchor(null)}
              className="bim-btn-secondary flex-1 py-1 text-[11px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Fly the camera to a markup's 3D anchor or saved view. */
export async function focusBimMarkup(engine: BimEngine, annotation: BimAnnotation): Promise<void> {
  if (annotation.worldPoints?.length) {
    await engine.zoomToWorldPoints(annotation.worldPoints);
  } else {
    await engine.applyCameraState(annotation.cameraJson);
  }
  useBimMarkupStore.getState().setSelectedIds([annotation.id]);
  useBimMarkupStore.getState().setMarkupMode("select");
}
