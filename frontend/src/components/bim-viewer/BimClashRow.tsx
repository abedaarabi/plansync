"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import type { BimClashRow as ClashRow } from "@/lib/api-client/bim-clash";
import { clashElementLabel } from "@/lib/bim/clash/clashLabels";
import {
  CLASH_ITEM1_COLOR,
  CLASH_ITEM2_COLOR,
  clashStatusLabel,
  clashTypeBadgeClass,
  clashTypeLabel,
  formatClashDistanceDetail,
} from "@/lib/bim/clash/clashStatusStyle";

function shortType(ifcType: string | null | undefined): string {
  if (!ifcType) return "Element";
  return ifcType.replace(/^Ifc/, "");
}

export function BimClashRow(props: {
  clash: ClashRow;
  selected: boolean;
  stale: boolean;
  orphaned: boolean;
  modelLabelA?: string | null;
  modelLabelB?: string | null;
  onSelect: () => void;
  onOpenDetail?: () => void;
  onResolve: () => void;
  onDelete?: () => void;
}) {
  const { clash } = props;
  const nameA = clashElementLabel(clash.elementA, clash.guidA);
  const nameB = clashElementLabel(clash.elementB, clash.guidB);
  const typeA = shortType(clash.elementA?.ifcType);
  const typeB = shortType(clash.elementB?.ifcType);
  const metaA = [props.modelLabelA, typeA].filter(Boolean).join(" · ");
  const metaB = [props.modelLabelB, typeB].filter(Boolean).join(" · ");

  return (
    <li data-clash-id={clash.id}>
      <div
        role="button"
        tabIndex={0}
        onClick={props.onSelect}
        onDoubleClick={() => props.onOpenDetail?.()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onSelect();
          }
        }}
        className={`bim-focus-ring bim-action-card flex w-full cursor-pointer items-start gap-2 p-2.5 text-left ${
          props.selected ? "ring-1 ring-[var(--bim-accent)]" : ""
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start gap-1.5">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: CLASH_ITEM1_COLOR }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-[var(--bim-text)]">
                    {nameA}
                  </p>
                  <p className="truncate text-[9px] text-[var(--bim-text-muted)]">{metaA}</p>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: CLASH_ITEM2_COLOR }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-[var(--bim-text)]">
                    {nameB}
                  </p>
                  <p className="truncate text-[9px] text-[var(--bim-text-muted)]">{metaB}</p>
                </div>
              </div>
            </div>
            <span className="bim-clash-pill shrink-0" data-status={clash.status}>
              {clashStatusLabel(clash.status)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${clashTypeBadgeClass(clash.clashType)}`}
            >
              {clashTypeLabel(clash.clashType)}
            </span>
            <span className="text-[10px] font-medium tabular-nums text-[var(--bim-text)]">
              {formatClashDistanceDetail(clash.clashType, clash.distanceMm)}
            </span>
            {props.stale ? (
              <span className="rounded-md bg-[var(--bim-hover)] px-1.5 py-0.5 text-[9px] text-[var(--bim-warning)]">
                Stale
              </span>
            ) : null}
            {props.orphaned ? (
              <span className="rounded-md bg-[var(--bim-hover)] px-1.5 py-0.5 text-[9px] text-[var(--bim-danger)]">
                Orphaned
              </span>
            ) : null}
            {clash.issue ? (
              <span className="text-[9px] text-[var(--bim-info)]">
                Issue · {clash.issue.status}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {clash.status === "NEW" || clash.status === "ACTIVE" ? (
              <button
                type="button"
                className="bim-btn-secondary bim-focus-ring px-2 py-1 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onResolve();
                }}
              >
                Resolve
              </button>
            ) : null}
            {props.onDelete ? (
              <button
                type="button"
                className="bim-focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--bim-danger)] hover:bg-[var(--bim-hover)]"
                aria-label="Delete clash"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete?.();
                }}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Delete
              </button>
            ) : null}
          </div>
        </div>

        {props.onOpenDetail ? (
          <button
            type="button"
            className="bim-focus-ring bim-rail-btn mt-0.5 h-8 w-8 shrink-0"
            aria-label="Open clash details"
            title="Details"
            onClick={(e) => {
              e.stopPropagation();
              props.onOpenDetail?.();
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
