"use client";

import { parseServerViewerState } from "@/lib/viewerStateCloud";
import { buildMergePatchFromRemote } from "@/lib/viewerStateMerge";
import { setViewerCollabRevision } from "@/lib/viewerCollabRevision";
import { useViewerStore } from "@/store/viewerStore";

export function ViewerRevisionConflictDialog({
  open,
  currentRevision,
  viewerState,
  numPages,
  onClose,
}: {
  open: boolean;
  currentRevision: number;
  viewerState: unknown;
  numPages: number;
  onClose: () => void;
}) {
  if (!open) return null;

  const reloadLatest = () => {
    const parsed = parseServerViewerState(viewerState);
    if (parsed) {
      const localAnn = useViewerStore.getState().annotations;
      const patch = buildMergePatchFromRemote(parsed, localAnn, numPages);
      useViewerStore.setState({
        ...patch,
        historyPast: [],
        historyFuture: [],
        selectedAnnotationIds: [],
      });
    }
    setViewerCollabRevision(currentRevision);
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-rev-conflict-title"
    >
      <div className="max-w-md rounded-xl border border-slate-600 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <h2 id="viewer-rev-conflict-title" className="text-base font-semibold text-white">
          This sheet changed while you were editing
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Another save updated the cloud copy. Reload the latest version to merge their markups with
          yours. Unsaved local strokes that are not on the server are kept when possible.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            onClick={onClose}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
            onClick={reloadLatest}
          >
            Reload latest
          </button>
        </div>
      </div>
    </div>
  );
}
