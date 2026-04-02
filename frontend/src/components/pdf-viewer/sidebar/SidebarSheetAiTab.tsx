"use client";

import { Sparkles } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";

/**
 * Sheet AI primary UI lives in the bottom drawer (like takeoff inventory).
 * This tab is a short hint plus a control to re-expand the drawer if collapsed.
 */
export function SidebarSheetAiTab() {
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const bumpSheetAiExpand = useViewerStore((s) => s.bumpSheetAiExpand);

  if (!cloudFileVersionId) {
    return (
      <p className="px-2 py-3 text-center text-[10px] leading-relaxed text-[#94A3B8]">
        Open a <strong className="text-[#F8FAFC]">cloud project</strong> sheet to use Sheet AI.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-3 py-4 text-center">
      <Sparkles className="h-8 w-8 text-violet-400" aria-hidden />
      <p className="text-[10px] leading-snug text-[#94A3B8]">
        Summary, table of contents, chat, and suggestions are in the{" "}
        <strong className="text-[#e2e8f0]">Sheet AI</strong> drawer at the bottom. Drag the handle
        to resize — same as takeoff inventory.
      </p>
      <button
        type="button"
        onClick={() => bumpSheetAiExpand()}
        className="viewer-focus-ring rounded-md border border-[#475569] bg-[#1e293b] px-3 py-1.5 text-[10px] font-semibold text-[#e2e8f0] hover:bg-[#334155]"
      >
        Expand Sheet AI drawer
      </button>
      <p className="text-[9px] leading-snug text-[#64748b]">
        AI can misread drawings. Review every suggestion before relying on it.
      </p>
    </div>
  );
}
