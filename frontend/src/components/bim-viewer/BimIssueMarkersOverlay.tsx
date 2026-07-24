"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { issueStatusMarkerStrokeHex } from "@/lib/issueStatusStyle";
import type { BimEngine } from "./bimEngine";

type ScreenPin = {
  id: string;
  title: string;
  status: string;
  x: number;
  y: number;
  visible: boolean;
  hasPhoto: boolean;
};

function pinsSnapshot(pins: ScreenPin[]): string {
  return pins
    .map((p) => `${p.id}:${Math.round(p.x)}:${Math.round(p.y)}:${p.visible ? 1 : 0}`)
    .join("|");
}

export function BimIssueMarkersOverlay(props: {
  engine: BimEngine | null;
  issues: IssueRow[];
  selectedIssueId?: string | null;
  onSelectIssue: (issue: IssueRow) => void;
}) {
  const [pins, setPins] = useState<ScreenPin[]>([]);
  const pinsKeyRef = useRef("");

  const issuesKey = useMemo(
    () =>
      props.issues
        // fallow-ignore-next-line complexity
        .map((issue) => {
          const anchor = issue.bimAnchor;
          if (!anchor?.ifcGuid && !anchor?.position) return `${issue.id}:none`;
          const pos = anchor.position;
          return `${issue.id}:${anchor.ifcGuid ?? ""}:${anchor.localId ?? ""}:${issue.fileVersionId ?? ""}:${pos?.x ?? ""}:${pos?.y ?? ""}:${pos?.z ?? ""}:${issue.status}`;
        })
        .join("|"),
    [props.issues],
  );

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

      const next: ScreenPin[] = [];
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
          title: issue.title,
          status: issue.status,
          x: projected.x,
          y: projected.y,
          visible: projected.visible,
          hasPhoto: (issue.referencePhotos?.length ?? 0) > 0,
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

  if (pins.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
      {pins.map((pin) =>
        pin.visible ? (
          <button
            key={pin.id}
            type="button"
            title={pin.title}
            style={{ left: pin.x, top: pin.y }}
            onClick={() => {
              const issue = props.issues.find((i) => i.id === pin.id);
              if (issue) props.onSelectIssue(issue);
            }}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
          >
            <span
              data-selected={props.selectedIssueId === pin.id ? "true" : undefined}
              className="relative flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white data-[selected=true]:ring-[var(--bim-accent)] data-[selected=true]:ring-offset-2"
              style={{ backgroundColor: issueStatusMarkerStrokeHex(pin.status) }}
            >
              {pin.hasPhoto ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 ring-1 ring-white" />
              ) : null}
              !
            </span>
          </button>
        ) : null,
      )}
    </div>
  );
}
