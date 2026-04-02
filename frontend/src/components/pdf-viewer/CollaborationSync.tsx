"use client";

import { useEffect, useRef } from "react";
import { useViewerStore } from "@/store/viewerStore";

/** Syncs annotations across tabs via BroadcastChannel (same browser, same room). */
export function CollaborationSync({ roomId }: { roomId: string }) {
  const isRemote = useRef(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const ch = new BroadcastChannel(`construction-pdf-${roomId}`);

    ch.onmessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (data?.type !== "sync-annotations" || !Array.isArray(data.annotations)) {
        return;
      }
      isRemote.current = true;
      useViewerStore.getState().setAnnotations(data.annotations, { skipHistory: true });
      isRemote.current = false;
    };

    const unsub = useViewerStore.subscribe((state, prev) => {
      if (state.annotations === prev.annotations) return;
      if (isRemote.current) return;
      ch.postMessage({
        type: "sync-annotations",
        annotations: state.annotations,
      });
    });

    return () => {
      unsub();
      ch.close();
    };
  }, [roomId]);

  return null;
}
