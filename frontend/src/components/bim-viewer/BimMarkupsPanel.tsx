"use client";

import { Pencil } from "lucide-react";
import type { BimAnnotation } from "@/store/bimMarkupStore";
import { camerasMatch } from "@/lib/bim/bimMarkupCamera";
import { markupHasWorldAnchor } from "@/lib/bim/bimMarkupWorld";
import type { BimEngine } from "./bimEngine";
import { focusBimMarkup } from "./BimMarkupOverlay";

export function BimMarkupsPanel(props: {
  engine: BimEngine | null;
  annotations: BimAnnotation[];
  selectedIds: string[];
  onSelect: (id: string) => void;
}) {
  if (props.annotations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--bim-border)] px-3 py-6 text-center">
        <Pencil className="mx-auto mb-2 h-5 w-5 text-[var(--bim-text-muted)]" aria-hidden />
        <p className="text-[12px] text-[var(--bim-text-muted)]">No markups yet.</p>
        <p className="mt-1 text-[10px] text-[var(--bim-text-muted)]">
          Use the Markup tool in the bottom bar to draw on the model view.
        </p>
      </div>
    );
  }

  const camera = props.engine?.getCameraState() ?? {};

  return (
    <ul className="space-y-1.5">
      {[...props.annotations]
        .sort((a, b) => b.createdAt - a.createdAt)
        // fallow-ignore-next-line complexity
        .map((a) => {
          const worldAnchored = markupHasWorldAnchor(a);
          const onView = worldAnchored || camerasMatch(a.cameraJson, camera);
          const selected = props.selectedIds.includes(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  props.onSelect(a.id);
                  if (props.engine) void focusBimMarkup(props.engine, a);
                }}
                data-active={selected}
                className="bim-action-card bim-tree-row w-full border-0 bg-transparent text-left"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {a.text?.trim() || a.type}
                  {a.linkedIssueTitle ? ` · ${a.linkedIssueTitle}` : ""}
                </span>
                {!onView ? (
                  <span className="shrink-0 text-[9px] uppercase tracking-wide text-[var(--bim-text-muted)]">
                    other view
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
    </ul>
  );
}
