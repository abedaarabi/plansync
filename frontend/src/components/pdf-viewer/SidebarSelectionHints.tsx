"use client";

import { Trash2 } from "lucide-react";
import {
  annotationIsIssueLinkedMarkup,
  annotationIsIssuePin,
  filterAnnotationIdsExcludingIssuePins,
} from "@/lib/annotationIssues";
import type { Annotation } from "@/store/viewerStore";

/** Shared multi-select / issue-pin / linked-markup chrome for Draw & Measure docks. */
export function SidebarSelectionHints(props: {
  annotations: Annotation[];
  selectedOnPageIds: string[];
  selectedAnn: Annotation | undefined;
  removeAnnotations: (ids: string[]) => void;
}) {
  const { annotations, selectedOnPageIds, selectedAnn, removeAnnotations } = props;

  if (selectedOnPageIds.length > 1) {
    const deletable = filterAnnotationIdsExcludingIssuePins(annotations, selectedOnPageIds);
    return (
      <>
        <h3 className="mb-2.5 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
          Selection
        </h3>
        <div className="mb-2 space-y-2 rounded-lg border border-slate-700/80 bg-slate-900/55 p-1.5 ring-1 ring-white/[0.06]">
          <p className="text-[9px] font-medium text-slate-200">
            {selectedOnPageIds.length} items on this page
          </p>
          <p className="text-[8px] leading-snug text-slate-500">
            ⌘ or Ctrl+click to toggle. Shift+click to add. Drag a box on empty space to select.
          </p>
          <button
            type="button"
            disabled={deletable.length === 0}
            title={
              deletable.length === 0
                ? "Selection is only issue markers — delete those from the Issues tab"
                : undefined
            }
            onClick={() => {
              if (deletable.length > 0) removeAnnotations(deletable);
            }}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-red-900/60 bg-red-950/40 py-1.5 text-[10px] font-medium text-red-200 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" strokeWidth={2} />
            Delete all selected
          </button>
        </div>
      </>
    );
  }

  if (selectedOnPageIds.length === 1 && selectedAnn && annotationIsIssuePin(selectedAnn)) {
    return (
      <div className="mb-2 rounded-lg border border-sky-800/50 bg-slate-900/60 p-2 ring-1 ring-sky-900/30">
        <p className="text-[9px] leading-snug text-slate-400">
          This is an <strong className="font-medium text-slate-300">issue</strong> marker. To remove
          it, open the <strong className="text-slate-300">Issues</strong> tab and use{" "}
          <strong className="text-slate-300">Delete</strong> on the issue — not markup delete.
        </p>
      </div>
    );
  }

  if (selectedOnPageIds.length === 1 && selectedAnn && annotationIsIssueLinkedMarkup(selectedAnn)) {
    return (
      <div className="mb-2 rounded-lg border border-sky-900/40 bg-slate-900/55 p-2 ring-1 ring-slate-800/40">
        <p className="text-[9px] leading-snug text-slate-400">
          This markup is <strong className="font-medium text-slate-300">linked</strong> to an issue.
          Add or remove linked shapes from the issue in the{" "}
          <strong className="text-slate-300">Issues</strong> tab.
        </p>
      </div>
    );
  }

  return null;
}
