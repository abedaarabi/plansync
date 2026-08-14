"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import {
  BIM_ISSUE_MARKER_CARD_MAX_H,
  BIM_ISSUE_MARKER_CARD_W,
  clusterIssuePins,
  computeIssueMarkerCardPlacement,
  issuePinDisplayNumber,
  type IssueMarkerItem,
  type ProjectedIssuePin,
} from "@/lib/bim/bimIssueMarkerUtils";
import { issueStatusMarkerStrokeHex } from "@/lib/issueStatusStyle";
import { BimIssueMarkerCard } from "./BimIssueMarkerCard";
import type { BimEngine } from "./bimEngine";

function pinsSnapshot(pins: ProjectedIssuePin[]): string {
  return pins
    .map((p) => `${p.id}:${Math.round(p.x)}:${Math.round(p.y)}:${p.visible ? 1 : 0}`)
    .join("|");
}

// fallow-ignore-next-line complexity
function issueAnchorSnapshotKey(issue: IssueRow): string {
  const anchor = issue.bimAnchor;
  if (!anchor?.ifcGuid && !anchor?.position) return `${issue.id}:none`;
  const pos = anchor.position;
  return `${issue.id}:${anchor.ifcGuid ?? ""}:${anchor.localId ?? ""}:${issue.fileVersionId ?? ""}:${pos?.x ?? ""}:${pos?.y ?? ""}:${pos?.z ?? ""}:${issue.status}:${issue.priority ?? ""}`;
}

function PinButton(props: {
  x: number;
  y: number;
  label: string;
  color: string;
  selected?: boolean;
  expanded?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={props.title}
      style={{ left: props.x, top: props.y }}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      className={`bim-issue-marker-pin pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 ${props.expanded ? "bim-issue-marker-pin--expanded" : ""}`}
    >
      <span
        data-selected={props.selected ? "true" : undefined}
        className="bim-issue-marker-pin__disc"
        style={{ backgroundColor: props.color }}
      >
        <span className="bim-issue-marker-pin__label">{props.label}</span>
      </span>
    </button>
  );
}

// fallow-ignore-next-line complexity
function renderMarkerItem(
  item: IssueMarkerItem,
  props: {
    selectedIssueId?: string | null;
    expandedClusters: Set<string>;
    onClusterClick: (clusterId: string, clusterPins: ProjectedIssuePin[]) => void;
    onPinHover: (issueId: string) => void;
    clearHoverSoon: () => void;
    showCardForIssue: (issue: IssueRow, opts?: { pin?: boolean }) => void;
  },
) {
  if (item.kind === "cluster") {
    const count = item.pins.length;
    const dominant = item.pins[0]?.issue;
    const color = dominant ? issueStatusMarkerStrokeHex(dominant.status) : "var(--bim-accent)";
    return (
      <PinButton
        key={`cluster-${item.id}`}
        x={item.x}
        y={item.y}
        label={`+${count}`}
        color={color}
        onClick={() => props.onClusterClick(item.id, item.pins)}
        onMouseEnter={() => {
          if (item.pins[0]) props.onPinHover(item.pins[0].id);
        }}
        onMouseLeave={props.clearHoverSoon}
        title={`${count} issues`}
      />
    );
  }

  const { pin } = item;
  const { issue } = pin;
  if (!pin.visible) return null;
  const expanded = props.expandedClusters.size > 0;
  const isWo = issue.issueKind === "WORK_ORDER";
  return (
    <PinButton
      key={pin.id}
      x={pin.x}
      y={pin.y}
      label={issuePinDisplayNumber(issue)}
      color={
        isWo
          ? "color-mix(in srgb, var(--bim-accent) 72%, #0ea5e9)"
          : issueStatusMarkerStrokeHex(issue.status)
      }
      selected={props.selectedIssueId === issue.id}
      expanded={expanded}
      title={issue.title}
      onClick={() => props.showCardForIssue(issue, { pin: true })}
      onMouseEnter={() => props.onPinHover(issue.id)}
      onMouseLeave={props.clearHoverSoon}
    />
  );
}

// fallow-ignore-next-line complexity
export function BimIssueMarkersOverlay(props: {
  engine: BimEngine | null;
  issues: IssueRow[];
  selectedIssueId?: string | null;
  onSelectIssue?: (issue: IssueRow) => void;
  onFocusIssue?: (issue: IssueRow) => void;
  onOpenDetails: (issue: IssueRow) => void;
  onLocateAsset: (issue: IssueRow) => void;
  onOpenDocuments: (issue: IssueRow) => void;
  onAddComment: (issue: IssueRow) => void;
  onResolveIssue: (issue: IssueRow) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [pins, setPins] = useState<ProjectedIssuePin[]>([]);
  const pinsKeyRef = useRef("");
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [pinnedIssueId, setPinnedIssueId] = useState<string | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(() => new Set());
  const hoverClearTimerRef = useRef<number | null>(null);

  const issuesKey = useMemo(
    () => props.issues.map(issueAnchorSnapshotKey).join("|"),
    [props.issues],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setViewportSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const engine = props.engine;
    if (!engine) return;
    engine.setIssueAnchors(
      props.issues
        .filter((issue) => issue.bimAnchor?.ifcGuid || issue.bimAnchor?.position)
        .map((issue) => ({
          ifcGuid: issue.bimAnchor!.ifcGuid,
          localId: issue.bimAnchor!.localId,
          fileVersionId: issue.fileVersionId,
          position: issue.bimAnchor!.position,
        })),
    );
  }, [props.engine, issuesKey, props.issues]);

  useEffect(() => {
    const engine = props.engine;
    if (!engine) {
      pinsKeyRef.current = "";
      setPins([]);
      return;
    }

    let cancelled = false;
    let raf = 0;

    // fallow-ignore-next-line complexity
    const tick = () => {
      if (cancelled) return;

      const next: ProjectedIssuePin[] = [];
      for (const issue of props.issues) {
        const anchor = issue.bimAnchor;
        if (!anchor?.ifcGuid && !anchor?.position) continue;
        const projected = engine.projectIssueAnchorToScreen({
          ifcGuid: anchor.ifcGuid,
          localId: anchor.localId,
          fileVersionId: issue.fileVersionId,
          position: anchor.position,
        });
        if (!projected) continue;
        next.push({
          id: issue.id,
          issue,
          x: projected.x,
          y: projected.y,
          visible: projected.visible,
        });
      }

      const nextKey = pinsSnapshot(next);
      if (nextKey !== pinsKeyRef.current) {
        pinsKeyRef.current = nextKey;
        setPins(next);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [props.engine, props.issues, issuesKey]);

  const markerItems = useMemo(
    () => clusterIssuePins(pins, expandedClusters),
    [pins, expandedClusters],
  );

  const activeIssueId = pinnedIssueId ?? hoveredIssueId;
  const activePin = useMemo(
    () => (activeIssueId ? (pins.find((p) => p.id === activeIssueId) ?? null) : null),
    [activeIssueId, pins],
  );

  const cardPlacement = useMemo(() => {
    if (!activePin || viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    return computeIssueMarkerCardPlacement(
      activePin.x,
      activePin.y,
      viewportSize.w,
      viewportSize.h,
      BIM_ISSUE_MARKER_CARD_W,
      BIM_ISSUE_MARKER_CARD_MAX_H,
    );
  }, [activePin, viewportSize.h, viewportSize.w]);

  const clearHoverSoon = useCallback(() => {
    if (pinnedIssueId) return;
    if (hoverClearTimerRef.current != null) window.clearTimeout(hoverClearTimerRef.current);
    hoverClearTimerRef.current = window.setTimeout(() => {
      setHoveredIssueId(null);
      hoverClearTimerRef.current = null;
    }, 120);
  }, [pinnedIssueId]);

  const keepCardOpen = useCallback(() => {
    if (hoverClearTimerRef.current != null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
  }, []);

  const showCardForIssue = useCallback(
    // fallow-ignore-next-line complexity
    (issue: IssueRow, opts?: { pin?: boolean }) => {
      keepCardOpen();
      setHoveredIssueId(issue.id);
      if (opts?.pin) {
        const opening = pinnedIssueId !== issue.id;
        setPinnedIssueId(opening ? issue.id : null);
        if (opening) props.onFocusIssue?.(issue);
      }
      props.onSelectIssue?.(issue);
    },
    [keepCardOpen, pinnedIssueId, props],
  );

  const onPinHover = useCallback(
    (issueId: string) => {
      keepCardOpen();
      setHoveredIssueId(issueId);
    },
    [keepCardOpen],
  );

  const onClusterClick = useCallback(
    // fallow-ignore-next-line complexity
    (clusterId: string, clusterPins: ProjectedIssuePin[]) => {
      setExpandedClusters((prev) => {
        const next = new Set(prev);
        next.add(clusterId);
        return next;
      });
      const points = clusterPins
        .map((p) => p.issue.bimAnchor?.position)
        .filter((p): p is { x: number; y: number; z: number } => Boolean(p));
      if (points.length > 0 && props.engine) {
        void props.engine.zoomToWorldPoints(points);
      } else if (clusterPins[0]) {
        props.onFocusIssue?.(clusterPins[0].issue);
      }
    },
    [props],
  );

  useEffect(() => {
    return () => {
      if (hoverClearTimerRef.current != null) window.clearTimeout(hoverClearTimerRef.current);
    };
  }, []);

  if (pins.length === 0) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
      {cardPlacement && activePin ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <line
            x1={cardPlacement.leaderFrom.x}
            y1={cardPlacement.leaderFrom.y}
            x2={cardPlacement.leaderTo.x}
            y2={cardPlacement.leaderTo.y}
            className="bim-issue-marker-leader"
          />
        </svg>
      ) : null}

      {markerItems.map((item) =>
        renderMarkerItem(item, {
          selectedIssueId: props.selectedIssueId,
          expandedClusters,
          onClusterClick,
          onPinHover,
          clearHoverSoon,
          showCardForIssue,
        }),
      )}

      {activePin && cardPlacement ? (
        <BimIssueMarkerCard
          issue={activePin.issue}
          placement={cardPlacement}
          visible={Boolean(activeIssueId)}
          onMouseEnter={keepCardOpen}
          onMouseLeave={clearHoverSoon}
          onOpenDetails={() => props.onOpenDetails(activePin.issue)}
          onLocateAsset={() => props.onLocateAsset(activePin.issue)}
          onOpenDocuments={() => props.onOpenDocuments(activePin.issue)}
          onAddComment={() => props.onAddComment(activePin.issue)}
          onResolveIssue={() => props.onResolveIssue(activePin.issue)}
        />
      ) : null}
    </div>
  );
}
