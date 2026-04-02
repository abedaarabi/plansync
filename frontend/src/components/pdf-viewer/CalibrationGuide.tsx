"use client";

import { useEffect, useState } from "react";
import { Check, ListChecks, X } from "lucide-react";
import { displayLengthToMm, mmToDisplayLength, type MeasureUnit } from "@/lib/coords";
import { fileFingerprint } from "@/lib/sessionPersistence";
import { useViewerStore } from "@/store/viewerStore";

function storageKeyForFile(fileName: string | null, numPages: number) {
  return `plansync-cal-guide-${fileFingerprint(fileName, numPages)}`;
}

function legacyCalGuideKey(fileName: string | null, numPages: number) {
  return `cv-cal-guide-${fileFingerprint(fileName, numPages)}`;
}

/**
 * Step-by-step checklist while the Calibrate tool is active (per-document dismiss).
 */
function targetInputDisplay(mm: number | null, unit: MeasureUnit) {
  if (mm == null) return "";
  const v = mmToDisplayLength(mm, unit);
  const d = unit === "m" || unit === "ft" ? 4 : unit === "mm" ? 2 : 3;
  const s = v.toFixed(d).replace(/\.?0+$/, "");
  return s === "" ? "0" : s;
}

const unitSuffix: Record<string, string> = {
  mm: "mm",
  cm: "cm",
  m: "m",
  in: "in",
  ft: "ft",
};

/** Optional target length for live Δ on the sheet — shown whenever Calibrate is active (even if the checklist is hidden). */
export function CalibrateTargetRow() {
  const tool = useViewerStore((s) => s.tool);
  const measureUnit = useViewerStore((s) => s.measureUnit);
  const calibrateTargetMm = useViewerStore((s) => s.calibrateTargetMm);
  const setCalibrateTargetMm = useViewerStore((s) => s.setCalibrateTargetMm);

  if (tool !== "calibrate") return null;

  return (
    <div className="viewer-card mb-2 border border-slate-700/60 p-2">
      <label className="block text-[9px] font-medium text-slate-500">
        Target length (optional)
        <span className="mt-0.5 block font-normal leading-snug text-slate-600">
          In your current display unit. Shows Δ on the page while dragging to the second point.
        </span>
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step="any"
            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900/80 px-1.5 py-1 text-[10px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
            placeholder="e.g. 5000"
            value={targetInputDisplay(calibrateTargetMm, measureUnit)}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                setCalibrateTargetMm(null);
                return;
              }
              const n = parseFloat(raw);
              if (!Number.isFinite(n) || n < 0) return;
              setCalibrateTargetMm(displayLengthToMm(n, measureUnit));
            }}
            aria-label="Optional target length for delta comparison"
          />
          <span className="w-7 shrink-0 text-[9px] text-slate-500">
            {unitSuffix[measureUnit] ?? measureUnit}
          </span>
        </div>
      </label>
    </div>
  );
}

export function CalibrationGuide() {
  const tool = useViewerStore((s) => s.tool);
  const calibrateDraft = useViewerStore((s) => s.calibrateDraft);
  const fileName = useViewerStore((s) => s.fileName);
  const numPages = useViewerStore((s) => s.numPages);
  const [hidden, setHidden] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!fileName || numPages < 1) {
      setReady(true);
      setHidden(true);
      return;
    }
    try {
      const k = storageKeyForFile(fileName, numPages);
      const leg = legacyCalGuideKey(fileName, numPages);
      const dismissed = localStorage.getItem(k) === "1" || localStorage.getItem(leg) === "1";
      setHidden(dismissed);
    } catch {
      setHidden(false);
    }
    setReady(true);
  }, [fileName, numPages]);

  if (!ready || tool !== "calibrate" || hidden) return null;

  const dismiss = () => {
    if (fileName && numPages >= 1) {
      try {
        const k = storageKeyForFile(fileName, numPages);
        localStorage.setItem(k, "1");
        localStorage.removeItem(legacyCalGuideKey(fileName, numPages));
      } catch {
        /* ignore */
      }
    }
    setHidden(true);
  };

  const hasFirst = calibrateDraft.length >= 1;
  const hasSecond = calibrateDraft.length >= 2;

  const steps = [
    {
      title: "First end of a known length",
      detail:
        "Choose a printed dimension, scale bar, or grid — click one end (snaps to PDF geometry when snap is on).",
      done: hasFirst,
    },
    {
      title: "Second end",
      detail:
        "Move the pointer to the other end — a live length appears in your selected unit (PDF space before calibration, or calibrated lengths after). Hold Shift to lock horizontal or vertical from the first point. Click along the same straight edge.",
      done: hasSecond,
    },
    {
      title: "Enter the real distance",
      detail:
        "When prompted, type the length in millimeters and choose Apply. The last value you used on this page is prefilled when you calibrate again.",
      done: false,
    },
  ];

  return (
    <div className="viewer-card mb-2 space-y-2 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400/90">
          <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Calibration
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-0.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          title="Hide checklist for this sheet"
          aria-label="Dismiss calibration checklist"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2 text-[10px] leading-snug">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                s.done
                  ? "border-blue-500/60 bg-blue-600/25 text-blue-200"
                  : "border-slate-600 text-slate-500"
              }`}
              aria-hidden
            >
              {s.done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
            </span>
            <span>
              <span className={`font-medium ${s.done ? "text-slate-200" : "text-slate-400"}`}>
                {s.title}
              </span>
              <span className="mt-0.5 block text-slate-500">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
