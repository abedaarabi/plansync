"use client";

import { parseServerViewerState } from "@/lib/viewerStateCloud";
import { buildMergePatchFromRemote } from "@/lib/viewerStateMerge";
import { setViewerCollabRevision } from "@/lib/viewerCollabRevision";
import { clampViewerScaleWithPageDims, useViewerStore } from "@/store/viewerStore";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

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
  const reloadLatest = () => {
    const parsed = parseServerViewerState(viewerState);
    if (parsed) {
      const st0 = useViewerStore.getState();
      const localAnn = st0.annotations;
      const patch = buildMergePatchFromRemote(parsed, localAnn, numPages);
      const pageForClamp = patch.currentPage ?? st0.currentPage;
      patch.scale = clampViewerScaleWithPageDims(
        patch.scale ?? 1,
        st0.pageSizePtByPage,
        pageForClamp,
      );
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
    <EnterpriseResponsiveDialog
      open={open}
      onClose={onClose}
      ariaLabelledBy="viewer-rev-conflict-title"
      variant="viewer-dark"
      overlayZClass="z-[200]"
      footer={
        <>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_PRIMARY} bg-sky-600 text-white hover:bg-sky-500`}
            onClick={reloadLatest}
          >
            Reload latest
          </button>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-slate-600 text-slate-200 hover:bg-slate-800`}
            onClick={onClose}
          >
            Dismiss
          </button>
        </>
      }
    >
      <h2 id="viewer-rev-conflict-title" className="text-base font-semibold text-white">
        This sheet changed while you were editing
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Another save updated the cloud copy. Reload the latest version to merge their markups with
        yours. Unsaved local strokes that are not on the server are kept when possible.
      </p>
    </EnterpriseResponsiveDialog>
  );
}
