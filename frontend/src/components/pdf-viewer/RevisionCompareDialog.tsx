"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";
import type { FileRevisionListItem } from "@/lib/api-client/core-members-viewer-rfi";
import { REVISION_DIFF_COLOR_A, REVISION_DIFF_COLOR_B } from "@/lib/pdfRevisionDiff";
import { useViewerStore } from "@/store/viewerStore";

export function RevisionCompareDialog(props: {
  open: boolean;
  onClose: () => void;
  versions: FileRevisionListItem[];
  currentFileVersionId: string | null;
}) {
  const start = useViewerStore((s) => s.startRevisionCompare);
  const sorted = useMemo(
    () => [...props.versions].sort((a, b) => b.version - a.version),
    [props.versions],
  );

  const defaults = useMemo(() => {
    const current = sorted.find((v) => v.id === props.currentFileVersionId) ?? sorted[0] ?? null;
    const older =
      sorted.find((v) => current && v.version < current.version) ??
      sorted.find((v) => v.id !== current?.id) ??
      null;
    return {
      target: current,
      base: older,
    };
  }, [sorted, props.currentFileVersionId]);

  const [baseId, setBaseId] = useState(defaults.base?.id ?? "");
  const targetId = defaults.target?.id ?? "";

  useEffect(() => {
    if (!props.open) return;
    setBaseId(defaults.base?.id ?? "");
  }, [props.open, defaults.base?.id]);

  const canStart = Boolean(baseId && targetId && baseId !== targetId) && sorted.length >= 2;

  const onStart = () => {
    const base = sorted.find((v) => v.id === baseId);
    const target = sorted.find((v) => v.id === targetId);
    if (!base || !target) return;
    start({
      baseFileVersionId: base.id,
      baseVersion: base.version,
      targetFileVersionId: target.id,
      targetVersion: target.version,
    });
    props.onClose();
  };

  return (
    <EnterpriseResponsiveDialog
      open={props.open}
      onClose={props.onClose}
      ariaLabelledBy="rev-compare-title"
      variant="viewer"
      overlayZClass="z-[300]"
      panelClassName="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-slate-300 text-slate-700 hover:bg-slate-100`}
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canStart}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} disabled:opacity-40`}
            onClick={onStart}
          >
            Compare
          </button>
        </div>
      }
    >
      <h2 id="rev-compare-title" className="text-lg font-semibold tracking-tight text-slate-900">
        Compare revisions
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Sheet content only — magenta is only in Rev A, cyan is only in Rev B. Markup compare stays
        separate.
      </p>

      {sorted.length < 2 ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          This file needs at least two revisions to compare.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] text-slate-600">
            <span className="mb-1 flex items-center gap-1.5 font-medium">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: REVISION_DIFF_COLOR_A }}
              />
              Rev A (base / older)
            </span>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="viewer-input-select mt-1 w-full max-w-none"
            >
              {sorted.map((v) => (
                <option key={v.id} value={v.id} disabled={v.id === targetId}>
                  Version {v.version}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-[12px] text-slate-600">
            <span className="mb-1 flex items-center gap-1.5 font-medium">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: REVISION_DIFF_COLOR_B }}
              />
              Rev B (open sheet)
            </span>
            <p className="mt-1 rounded-md border border-slate-300 bg-white px-2.5 py-2 font-semibold tabular-nums text-slate-900">
              Version {defaults.target?.version ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Markups stay on this open revision. Open another rev from the file list to use it as
              Rev B.
            </p>
          </div>
        </div>
      )}
    </EnterpriseResponsiveDialog>
  );
}
