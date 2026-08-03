"use client";

import type { FileRevisionListItem } from "@/lib/api-client/core-members-viewer-rfi";
import { REVISION_DIFF_COLOR_A, REVISION_DIFF_COLOR_B } from "@/lib/pdfRevisionDiff";
import { useViewerStore } from "@/store/viewerStore";

export function RevisionCompareChrome(props: {
  versions: FileRevisionListItem[];
  loadingDiff: boolean;
  loadError: string | null;
}) {
  const layout = useViewerStore((s) => s.revisionCompareLayout);
  const setLayout = useViewerStore((s) => s.setRevisionCompareLayout);
  const baseId = useViewerStore((s) => s.revisionCompareBaseFileVersionId);
  const targetId = useViewerStore((s) => s.revisionCompareTargetFileVersionId);
  const targetVer = useViewerStore((s) => s.revisionCompareTargetVersion);
  const setPair = useViewerStore((s) => s.setRevisionComparePair);
  const opacity = useViewerStore((s) => s.revisionCompareTintOpacity);
  const setOpacity = useViewerStore((s) => s.setRevisionCompareTintOpacity);
  const showTint = useViewerStore((s) => s.revisionCompareShowTintOnSideBySide);
  const setShowTint = useViewerStore((s) => s.setRevisionCompareShowTintOnSideBySide);
  const exit = useViewerStore((s) => s.exitRevisionCompare);

  const sorted = [...props.versions].sort((a, b) => b.version - a.version);

  const onPickBase = (id: string) => {
    const row = sorted.find((v) => v.id === id);
    if (!row || !targetId || targetVer == null) return;
    if (row.id === targetId) return;
    setPair({
      baseFileVersionId: row.id,
      baseVersion: row.version,
      targetFileVersionId: targetId,
      targetVersion: targetVer,
    });
  };

  return (
    <div className="no-print flex shrink-0 flex-col gap-1.5 border-b border-[#334155] bg-[#0f172a]/95 px-2 py-1.5 text-[11px] text-[#e2e8f0] backdrop-blur-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ["diff", "Diff overlay"],
              ["sideBySide", "Side by side"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayout(id)}
              className={`rounded-md px-2 py-1 font-medium transition ${
                layout === id
                  ? "bg-[#2563eb] text-white shadow-sm"
                  : "bg-[#1e293b] text-[#94a3b8] ring-1 ring-[#334155] hover:bg-[#334155] hover:text-[#f8fafc]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => exit()}
          className="rounded-md border border-[#475569] bg-[#1e293b] px-2.5 py-1 text-[11px] font-semibold text-[#e2e8f0] shadow-sm transition hover:bg-[#334155]"
        >
          Exit revision compare
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: REVISION_DIFF_COLOR_A }}
            aria-hidden
          />
          <span className="text-[#94a3b8]">Rev A</span>
          <select
            value={baseId ?? ""}
            onChange={(e) => onPickBase(e.target.value)}
            className="viewer-input-select max-w-[7rem]"
            aria-label="Base revision A"
          >
            {sorted.map((v) => (
              <option key={v.id} value={v.id} disabled={v.id === targetId}>
                v{v.version}
              </option>
            ))}
          </select>
        </label>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: REVISION_DIFF_COLOR_B }}
            aria-hidden
          />
          <span className="text-[#94a3b8]">Rev B</span>
          <span className="rounded-md border border-[#334155] bg-[#1e293b] px-2 py-0.5 font-semibold tabular-nums text-[#e2e8f0]">
            v{targetVer ?? "—"}
          </span>
          <span className="text-[10px] text-[#64748b]">(open sheet)</span>
        </span>

        <span className="hidden items-center gap-2 text-[10px] text-[#94a3b8] sm:flex">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: REVISION_DIFF_COLOR_A }} />
            Only in A
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: REVISION_DIFF_COLOR_B }} />
            Only in B
          </span>
          <span>Shared muted</span>
        </span>

        {layout === "diff" || showTint ? (
          <label className="flex items-center gap-1.5 text-[#94a3b8]">
            Opacity
            <input
              type="range"
              min={15}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="viewer-range w-20"
              aria-label="Diff tint opacity"
            />
          </label>
        ) : null}

        {layout === "sideBySide" ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-[#94a3b8]">
            <input
              type="checkbox"
              checked={showTint}
              onChange={(e) => setShowTint(e.target.checked)}
              className="rounded border-[#64748b]"
            />
            Show diff tint on B
          </label>
        ) : null}

        {props.loadingDiff ? (
          <span className="text-[10px] text-[#64748b]">Computing diff…</span>
        ) : null}
        {props.loadError ? (
          <span className="text-[10px] text-amber-400">{props.loadError}</span>
        ) : null}
      </div>
    </div>
  );
}
