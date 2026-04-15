"use client";

import { ImageIcon } from "lucide-react";

export type SolutionVisualPlaceholderProps = {
  /** Tailwind class for bottom accent bar (e.g. bg-blue-700). */
  accentSolidBg: string;
  label?: string;
  hint?: string;
  aspectClass?: string;
  className?: string;
  /** `stone` matches editorial marketing pages; `slate` is default product UI. */
  tone?: "slate" | "stone";
};

/**
 * Marketing screenshot frame. Swap to `next/image` when assets exist in `/public`.
 */
export function SolutionVisualPlaceholder({
  accentSolidBg,
  label = "Product screenshot",
  hint = "1600 × 900 · PNG or WebP",
  aspectClass = "aspect-[16/10]",
  className = "",
  tone = "slate",
}: SolutionVisualPlaceholderProps) {
  const isStone = tone === "stone";
  const shell = isStone
    ? "border border-stone-200/90 bg-linear-to-br from-stone-100/90 via-[#fafaf8] to-stone-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_40px_-16px_rgba(28,25,23,0.12)] ring-1 ring-stone-900/5"
    : "border border-slate-200/90 bg-linear-to-br from-slate-50 via-white to-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5";
  const viaLine = isStone ? "via-stone-300/50" : "via-slate-300/60";
  const iconBorder = isStone
    ? "border-stone-200/90 bg-white/95 ring-stone-900/5"
    : "border-slate-200/90 bg-white/95 ring-slate-900/5";
  const iconBg = isStone
    ? "bg-linear-to-br from-stone-50 to-stone-100"
    : "bg-linear-to-br from-slate-50 to-slate-100";
  const iconColor = isStone ? "text-stone-400" : "text-slate-400";
  const titleColor = isStone ? "text-stone-800" : "text-slate-800";
  const hintColor = isStone ? "text-stone-500" : "text-slate-500";
  const footColor = isStone ? "text-stone-400" : "text-slate-400";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${shell} ${aspectClass} ${className}`.trim()}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 landing-dots" aria-hidden />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent ${viaLine} to-transparent`}
        aria-hidden
      />
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 ${accentSolidBg} opacity-90`}
        aria-hidden
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className={`rounded-2xl border p-3 shadow-md ring-1 ${iconBorder}`}>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
            <ImageIcon className={`h-6 w-6 ${iconColor}`} strokeWidth={1.4} aria-hidden />
          </div>
        </div>
        <div className="space-y-1">
          <p className={`text-sm font-semibold tracking-tight ${titleColor}`}>{label}</p>
          <p className={`text-xs font-medium tabular-nums ${hintColor}`}>{hint}</p>
        </div>
        <p className={`max-w-65 text-[11px] leading-relaxed ${footColor}`}>
          Drop your screen capture here when ready — keeps layout and focus crisp.
        </p>
      </div>
    </div>
  );
}
