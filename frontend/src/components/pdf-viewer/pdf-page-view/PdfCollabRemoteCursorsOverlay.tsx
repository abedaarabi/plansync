"use client";

import { MousePointer2 } from "lucide-react";
import {
  collabColorForUser,
  collabCursorLabelNudgeY,
  useViewerCollab,
} from "../viewerCollabContext";
import { ViewerUserThumb } from "../ViewerUserThumb";

type PeerInfo = { name: string; email: string; image?: string | null };
type CollabCtx = ReturnType<typeof useViewerCollab>;

export function PdfCollabRemoteCursorsOverlay({
  pageIdx0,
  viewerCollab,
  collabPeerByUserId,
}: {
  pageIdx0: number;
  viewerCollab: CollabCtx | null;
  collabPeerByUserId: Map<string, PeerInfo>;
}) {
  if (!viewerCollab?.collabActive) return null;
  if (!viewerCollab.remoteCursors.some((c) => c.pageIndex === pageIdx0)) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[6] print:hidden" aria-hidden>
      {viewerCollab.remoteCursors
        .filter((c) => c.pageIndex === pageIdx0)
        .map((c) => {
          const peer = collabPeerByUserId.get(c.userId);
          const peerName = peer?.name ?? `Teammate ${c.userId.slice(0, 6)}`;
          const fill = collabColorForUser(c.userId);
          const labelNudgeY = collabCursorLabelNudgeY(c.userId);
          const pointerFilter = `drop-shadow(0 1px 2px rgb(0 0 0 / 0.55)) drop-shadow(0 0 10px ${fill}b3)`;
          /** Lucide 24×24 path tip ≈ (4.037, 4.688) — anchor broadcast point to tip. */
          const pointerSize = 28;
          const pointerTipX = (4.037 * pointerSize) / 24;
          const pointerTipY = (4.688 * pointerSize) / 24;
          return (
            <div
              key={c.userId}
              className="absolute motion-safe:transition-[left,top] motion-safe:duration-100 motion-safe:ease-out motion-reduce:transition-none"
              style={{
                left: `${c.x * 100}%`,
                top: `${c.y * 100}%`,
              }}
              title={`${peerName} — on this page`}
            >
              <div
                className="relative block"
                style={{
                  transform: `translate(-${pointerTipX}px, -${pointerTipY}px)`,
                  filter: pointerFilter,
                }}
              >
                <MousePointer2
                  size={pointerSize}
                  aria-hidden
                  fill={fill}
                  color="#0f172a"
                  strokeWidth={1.5}
                  className="block"
                />
              </div>
              <div
                className="absolute flex max-w-[min(220px,60vw)] items-center gap-1.5 rounded-lg border bg-[#0f172a]/95 py-1 pl-1 pr-2 shadow-lg ring-1 ring-black/20 backdrop-blur-sm"
                style={{
                  left: 16,
                  top: 12 + labelNudgeY,
                  borderColor: `${fill}73`,
                  boxShadow: `0 4px 14px rgb(0 0 0 / 0.35), 0 0 0 1px ${fill}40`,
                }}
              >
                <span
                  className="shrink-0 rounded-full p-0.5 ring-2 ring-white/95"
                  style={{
                    boxShadow: `0 0 0 1px ${fill}cc`,
                    backgroundColor: fill,
                  }}
                >
                  <ViewerUserThumb
                    shape="circle"
                    name={peerName}
                    email={peer?.email}
                    image={peer?.image}
                    className="h-7 w-7 border-0 text-[10px]"
                  />
                </span>
                <span className="min-w-0 truncate text-[11px] font-semibold leading-tight tracking-tight text-slate-100">
                  {peerName}
                </span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
