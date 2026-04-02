"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { BottomDrawer } from "./BottomDrawer";
import { SheetAiPanel } from "./SheetAiPanel";
import { useViewerStore } from "@/store/viewerStore";

const RESIZE_DEBOUNCE_MS = 120;

/** ~top chrome (viewer toolbar); drawer avoids covering it at full snap. */
const VIEWPORT_TOP_RESERVE_PX = 52;

export function SheetAiDrawer() {
  const expandNonce = useViewerStore((s) => s.sheetAiExpandNonce);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);

  useLayoutEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = undefined;
        setVh(window.innerHeight);
      }, RESIZE_DEBOUNCE_MS);
    };
    ro();
    window.addEventListener("resize", ro);
    return () => {
      window.removeEventListener("resize", ro);
      if (t) clearTimeout(t);
    };
  }, []);

  const fullH = useMemo(() => {
    const h = Math.max(200, vh - VIEWPORT_TOP_RESERVE_PX);
    return Math.min(h, Math.round(vh * 0.88));
  }, [vh]);

  const snapHeightsPx = useMemo(() => [32, 280, fullH] as const, [fullH]);

  const titleMain = (
    <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-[#e2e8f0]">
      <Sparkles className="h-3 w-3 shrink-0 text-violet-400" aria-hidden />
      <span className="font-medium text-[#94a3b8]">Sheet AI</span>
      <span className="text-[#cbd5e1]">Summary &amp; chat</span>
    </span>
  );

  return (
    <div className="pointer-events-auto w-full max-w-full min-w-0">
      <BottomDrawer
        snapHeightsPx={snapHeightsPx}
        initialSnap="half"
        expandRequestNonce={expandNonce}
        keyboardToggleEnabled={false}
        title={titleMain}
        titleWhenCollapsed={
          <span className="flex items-center gap-1 text-[10px] text-[#cbd5e1]">
            <Sparkles className="h-3 w-3 text-violet-400" aria-hidden />
            Sheet AI
          </span>
        }
      >
        <div className="h-full min-h-0 overflow-hidden px-0.5 pb-0.5 sm:px-1">
          <SheetAiPanel />
        </div>
      </BottomDrawer>
    </div>
  );
}
