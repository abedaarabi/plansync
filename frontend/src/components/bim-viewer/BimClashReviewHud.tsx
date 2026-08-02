"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Ticket, TicketPlus, X } from "lucide-react";
import type { BimClashRow } from "@/lib/api-client/bim-clash";
import type { ClashContextMode } from "@/lib/bim/clash/clashSessionStorage";
import { captureClashPreview, peekClashPreview } from "@/lib/bim/clash/clashPreviewCache";
import { clashElementLabel } from "@/lib/bim/clash/clashLabels";
import { displayModelLabel } from "@/lib/bim/clash/clashSets";
import {
  clashStatusLabel,
  clashTypeLabel,
  formatClashDistanceDetail,
} from "@/lib/bim/clash/clashStatusStyle";
import type { BimEngine } from "./bimEngine";

function shortType(ifcType: string | null | undefined): string {
  if (!ifcType) return "Element";
  return ifcType.replace(/^Ifc/, "");
}

/** Navisworks-style clash review chrome over the viewport. */
// fallow-ignore-next-line complexity
export function BimClashReviewHud(props: {
  clash: BimClashRow;
  index: number;
  total: number;
  engine: BimEngine | null;
  modelLabelA?: string | null;
  modelLabelB?: string | null;
  creatingIssue?: boolean;
  onCreateIssue?: (clash: BimClashRow) => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  onInspectItem?: (item: "a" | "b") => void;
  contextMode?: ClashContextMode;
  onContextModeChange?: (mode: ClashContextMode) => void;
}) {
  const contextMode = props.contextMode ?? "color";
  const nameA = clashElementLabel(props.clash.elementA, props.clash.guidA);
  const nameB = clashElementLabel(props.clash.elementB, props.clash.guidB);
  const modelA = props.modelLabelA ? displayModelLabel(props.modelLabelA) : null;
  const modelB = props.modelLabelB ? displayModelLabel(props.modelLabelB) : null;
  const issueTitle = props.clash.issue?.title?.trim() || null;
  const hasIssue = Boolean(props.clash.issueId);

  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    peekClashPreview(props.clash.id, contextMode),
  );
  const [previewLoading, setPreviewLoading] = useState(!previewUrl);

  useEffect(() => {
    const cached = peekClashPreview(props.clash.id, contextMode);
    if (cached) {
      setPreviewUrl(cached);
      setPreviewLoading(false);
      return;
    }
    if (!props.engine) {
      setPreviewUrl(null);
      setPreviewLoading(false);
      return;
    }

    const ac = new AbortController();
    setPreviewLoading(true);
    setPreviewUrl(null);
    void captureClashPreview({
      clashId: props.clash.id,
      contextMode,
      settleMs: 320,
      signal: ac.signal,
      capture: () => props.engine!.captureSnapshot(),
    }).then((url) => {
      if (ac.signal.aborted) return;
      setPreviewUrl(url);
      setPreviewLoading(false);
    });

    return () => ac.abort();
  }, [props.clash.id, contextMode, props.engine]);

  return (
    <div className="bim-clash-review-hud pointer-events-none">
      <div className="bim-clash-review-hud__card pointer-events-auto">
        <div className="bim-clash-review-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="bim-clash-review-preview__img" />
          ) : (
            <div
              className="bim-clash-review-preview__skeleton"
              data-loading={previewLoading ? "true" : undefined}
              aria-hidden
            />
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--bim-text-muted)]">
            Clash review · {props.index + 1} of {props.total}
          </p>
          <button
            type="button"
            className="bim-focus-ring bim-rail-btn h-8 w-8"
            aria-label="Exit clash review"
            onClick={props.onExit}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="bim-clash-pill" data-status={props.clash.status}>
            {clashStatusLabel(props.clash.status)}
          </span>
          <span className="rounded-md bg-[var(--bim-hover)] px-1.5 py-0.5 font-medium text-[var(--bim-text)]">
            {clashTypeLabel(props.clash.clashType)}
          </span>
          <span className="tabular-nums font-medium text-[var(--bim-text)]">
            {formatClashDistanceDetail(props.clash.clashType, props.clash.distanceMm)}
          </span>
          {issueTitle ? (
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-[var(--bim-accent-muted)] px-1.5 py-0.5 font-medium text-[var(--bim-text)]"
              title={issueTitle}
            >
              <Ticket className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{issueTitle}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-2 grid gap-1.5">
          <button
            type="button"
            className="bim-clash-review-item bim-focus-ring w-full text-left"
            data-item="a"
            onClick={() => props.onInspectItem?.("a")}
          >
            <span className="bim-clash-review-swatch" data-item="a" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold leading-snug break-words [overflow-wrap:anywhere] text-[var(--bim-text)]">
                {nameA}
              </p>
              <p className="mt-0.5 text-[9px] leading-snug break-words [overflow-wrap:anywhere] text-[var(--bim-text-muted)]">
                Item 1 · {shortType(props.clash.elementA?.ifcType)}
                {modelA ? ` · ${modelA}` : ""}
              </p>
            </div>
          </button>
          <button
            type="button"
            className="bim-clash-review-item bim-focus-ring w-full text-left"
            data-item="b"
            onClick={() => props.onInspectItem?.("b")}
          >
            <span className="bim-clash-review-swatch" data-item="b" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold leading-snug break-words [overflow-wrap:anywhere] text-[var(--bim-text)]">
                {nameB}
              </p>
              <p className="mt-0.5 text-[9px] leading-snug break-words [overflow-wrap:anywhere] text-[var(--bim-text-muted)]">
                Item 2 · {shortType(props.clash.elementB?.ifcType)}
                {modelB ? ` · ${modelB}` : ""}
              </p>
            </div>
          </button>
        </div>

        {props.onCreateIssue ? (
          <button
            type="button"
            className="bim-btn-secondary bim-focus-ring mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 text-[11px]"
            disabled={props.creatingIssue || hasIssue}
            onClick={() => props.onCreateIssue?.(props.clash)}
          >
            {props.creatingIssue ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <TicketPlus className="h-3.5 w-3.5" aria-hidden />
            )}
            {hasIssue ? "Issue linked" : "Create issue"}
          </button>
        ) : null}

        {props.onContextModeChange ? (
          <div className="bim-segment bim-segment-compact mt-2">
            {(
              [
                ["color", "Color"],
                ["ghost", "Ghost"],
                ["hide", "Hide"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="bim-segment-btn"
                data-active={props.contextMode === id ? "true" : undefined}
                onClick={() => props.onContextModeChange?.(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            className="bim-btn-secondary bim-focus-ring flex min-h-9 flex-1 items-center justify-center gap-1 text-[11px]"
            onClick={props.onPrev}
            disabled={props.total <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <button
            type="button"
            className="bim-btn-primary bim-focus-ring flex min-h-9 flex-1 items-center justify-center gap-1 text-[11px]"
            onClick={props.onNext}
            disabled={props.total <= 1}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
