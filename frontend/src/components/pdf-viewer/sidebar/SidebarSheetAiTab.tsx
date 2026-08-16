"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchIssuesForFileVersion, type IssueKindApi } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

export function SidebarSheetAiTab() {
  const qc = useQueryClient();
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerOperationsMode = useViewerStore((s) => s.viewerOperationsMode);
  const clearSheetAiFromDrawing = useViewerStore((s) => s.clearSheetAiFromDrawing);
  const issueKinds: IssueKindApi[] | undefined = viewerOperationsMode
    ? ["WORK_ORDER", "OCCUPANT"]
    : undefined;
  const issueKindsKey = viewerOperationsMode ? "WORK_ORDER,OCCUPANT" : null;

  useQuery({
    queryKey: qk.issuesForFileVersion(cloudFileVersionId ?? "", issueKindsKey),
    queryFn: () => fetchIssuesForFileVersion(cloudFileVersionId!, { issueKinds }),
    enabled: Boolean(cloudFileVersionId),
  });

  const handleClearAiDrawing = useCallback(async () => {
    const st = useViewerStore.getState();
    const n =
      st.annotations.filter((a) => a.fromSheetAi).length +
      st.takeoffZones.filter((z) => z.fromSheetAi).length;
    await clearSheetAiFromDrawing();
    if (cloudFileVersionId) {
      void qc.invalidateQueries({
        queryKey: qk.issuesForFileVersion(cloudFileVersionId, issueKindsKey),
      });
    }
    if (n === 0) {
      toast.message("No Assist overlays on the drawing.");
    } else {
      toast.success("Removed Assist highlights, markups, pins, and takeoff zones from the sheet.");
    }
  }, [clearSheetAiFromDrawing, cloudFileVersionId, issueKindsKey, qc]);

  if (!cloudFileVersionId) {
    return (
      <p className="px-2 py-3 text-center text-[10px] leading-relaxed text-slate-500">
        Open a <strong className="text-slate-900">cloud project</strong> sheet to use Takeoff
        assist.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 px-2 py-2">
      <button
        type="button"
        onClick={() => void handleClearAiDrawing()}
        className="viewer-focus-ring flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-rose-700 hover:border-rose-500/50 hover:bg-rose-50"
        title="Assist highlights, markups, issue pins, AI takeoff zones"
      >
        <Trash2 className="h-3 w-3 shrink-0" aria-hidden />
        Clear Assist from drawing
      </button>

      <p className="text-[9px] leading-snug text-slate-500">
        Category detect and quantities live in the{" "}
        <strong className="text-slate-500">Assist</strong> drawer at the bottom of the viewer.
      </p>

      <p className="text-[9px] leading-snug text-slate-500">
        AI can misread drawings. Always verify on the sheet.
      </p>
    </div>
  );
}
