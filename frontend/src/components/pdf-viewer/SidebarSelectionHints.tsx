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
        <h3 className="mb-2.5 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Selection
        </h3>
        <div className="mb-2 space-y-2 rounded-lg border border-slate-200 bg-white/55 p-1.5 ring-1 ring-white/[0.06]">
          <p className="text-[9px] font-medium text-slate-700">
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
            className="flex w-full items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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
      <div className="mb-2 rounded-lg border border-sky-800/50 bg-white p-2 ring-1 ring-sky-200">
        <p className="text-[9px] leading-snug text-slate-500">
          This is an <strong className="font-medium text-slate-600">issue</strong> marker. To remove
          it, open the <strong className="text-slate-600">Issues</strong> tab and use{" "}
          <strong className="text-slate-600">Delete</strong> on the issue — not markup delete.
        </p>
      </div>
    );
  }

  if (selectedOnPageIds.length === 1 && selectedAnn && annotationIsIssueLinkedMarkup(selectedAnn)) {
    return (
      <div className="mb-2 rounded-lg border border-sky-200 bg-white/55 p-2 ring-1 ring-slate-200/40">
        <p className="text-[9px] leading-snug text-slate-500">
          This markup is <strong className="font-medium text-slate-600">linked</strong> to an issue.
          Add or remove linked shapes from the issue in the{" "}
          <strong className="text-slate-600">Issues</strong> tab.
        </p>
      </div>
    );
  }

  return null;
}
