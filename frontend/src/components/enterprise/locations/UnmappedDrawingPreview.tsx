"use client";

import { useRef } from "react";
import { Layers, X } from "lucide-react";
import { BimPdfPageEmbed } from "@/components/bim-viewer/BimPdfPageEmbed";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import type { BuildingAsset, BuildingLevel } from "@/lib/api-client/locations";
import { PickPaneViewport } from "./matching/PickPaneViewport";

type Props = {
  asset: BuildingAsset;
  levels: BuildingLevel[];
  onClose: () => void;
  onMatchToLevel: (levelId: string) => void;
};

/** Full-screen PDF preview for an unmapped drawing, with level pick to start registration. */
export function UnmappedDrawingPreview({ asset, levels, onClose, onMatchToLevel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const emptyLevels = levels.filter((l) => l.mappedDrawingCount === 0);
  const otherLevels = levels.filter((l) => l.mappedDrawingCount > 0);
  const ordered = [...emptyLevels, ...otherLevels];

  return (
    <div className="bim-workspace-align absolute inset-0 z-[30] flex min-h-0 flex-col overflow-hidden bg-[var(--enterprise-bg)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 sm:px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary-soft)]">
          <PdfFileIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            Preview drawing
          </p>
          <h2 className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
            {asset.fileName}
          </h2>
        </div>
        <button
          type="button"
          className="mobile-touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          aria-label="Close preview"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1 bg-[var(--enterprise-bg)] p-2 sm:p-3">
          <div className="registration-pane flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
            <PickPaneViewport pickTargetRef={canvasRef} pickActive={false}>
              {() => (
                <div className="relative max-h-full max-w-full">
                  <BimPdfPageEmbed
                    fileId={asset.id}
                    fileVersionId={asset.fileVersionId}
                    pageIndex={0}
                    pickSurfaceRef={canvasRef}
                    className="max-h-full max-w-full overflow-hidden bg-transparent"
                    quality="high"
                  />
                </div>
              )}
            </PickPaneViewport>
          </div>
        </div>

        <aside className="flex max-h-[42%] w-full shrink-0 flex-col border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] lg:max-h-none lg:w-72 lg:border-l lg:border-t-0 xl:w-80">
          <div className="border-b border-[var(--enterprise-border)] px-3 py-2.5 sm:px-4">
            <p className="text-sm font-semibold text-[var(--enterprise-text)]">Match to a level</p>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              Review the drawing, then choose a floor to start registration. You can also drag it
              onto a level in the tree.
            </p>
          </div>
          <ul className="enterprise-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto p-2 sm:p-3">
            {ordered.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                No levels yet. Add a level in the tree first.
              </li>
            ) : (
              ordered.map((level) => {
                const empty = level.mappedDrawingCount === 0;
                return (
                  <li key={level.id}>
                    <button
                      type="button"
                      className="mobile-touch-target flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-[var(--enterprise-hover-surface)]"
                      onClick={() => onMatchToLevel(level.id)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)] ring-1 ring-[var(--enterprise-border)]">
                        <Layers className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                          {level.name}
                        </span>
                        <span className="block text-[11px] text-[var(--enterprise-text-muted)]">
                          {empty
                            ? "No drawing yet"
                            : `${level.mappedDrawingCount} drawing${level.mappedDrawingCount === 1 ? "" : "s"}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[var(--enterprise-primary)]">
                        Match
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
