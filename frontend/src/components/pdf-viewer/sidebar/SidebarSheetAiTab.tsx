"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchIssuesForFileVersion } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

export function SidebarSheetAiTab() {
  const qc = useQueryClient();
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const clearSheetAiFromDrawing = useViewerStore((s) => s.clearSheetAiFromDrawing);

  useQuery({
    queryKey: qk.issuesForFileVersion(cloudFileVersionId ?? ""),
    queryFn: () => fetchIssuesForFileVersion(cloudFileVersionId!),
    enabled: Boolean(cloudFileVersionId),
  });

  const handleClearAiDrawing = useCallback(async () => {
    const st = useViewerStore.getState();
    const n =
      st.annotations.filter((a) => a.fromSheetAi).length +
      st.takeoffZones.filter((z) => z.fromSheetAi).length;
    await clearSheetAiFromDrawing();
    if (cloudFileVersionId) {
      void qc.invalidateQueries({ queryKey: qk.issuesForFileVersion(cloudFileVersionId) });
    }
    if (n === 0) {
      toast.message("No Sheet AI overlays on the drawing.");
    } else {
      toast.success(
        "Removed Sheet AI highlights, markups, pins, and takeoff zones from the sheet.",
      );
    }
  }, [clearSheetAiFromDrawing, cloudFileVersionId, qc]);

  if (!cloudFileVersionId) {
    return (
      <p className="px-2 py-3 text-center text-[10px] leading-relaxed text-[#94A3B8]">
        Open a <strong className="text-[#F8FAFC]">cloud project</strong> sheet to use Sheet AI.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-2 [scrollbar-width:thin]">
      <button
        type="button"
        onClick={() => void handleClearAiDrawing()}
        className="viewer-focus-ring flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#475569] bg-[#1e293b] py-1.5 text-[10px] font-medium text-rose-200/90 hover:border-rose-500/50 hover:bg-rose-950/35"
        title="TOC highlights, AI markups, AI issue pins, AI takeoff zones"
      >
        <Trash2 className="h-3 w-3 shrink-0" aria-hidden />
        Clear AI from drawing
      </button>

      <p className="text-[9px] leading-snug text-[#64748b]">
        Smart sheet summary, readings table, and chat live in the{" "}
        <strong className="text-slate-400">Sheet AI</strong> drawer at the bottom of the viewer.
      </p>

      <p className="text-[9px] leading-snug text-[#64748b]">
        AI can misread drawings. Always verify on the sheet.
      </p>
    </div>
  );
}
