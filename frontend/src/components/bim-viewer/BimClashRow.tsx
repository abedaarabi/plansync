"use client";

import type { BimClashRow as ClashRow } from "@/lib/api-client/bim-clash";
import { clashElementLabel } from "@/lib/bim/clash/clashLabels";
import {
  CLASH_ITEM1_COLOR,
  CLASH_ITEM2_COLOR,
  clashStatusLabel,
  clashTypeLabel,
  formatClashDistanceMm,
} from "@/lib/bim/clash/clashStatusStyle";

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function shortType(ifcType: string | null | undefined): string {
  if (!ifcType) return "Element";
  return ifcType.replace(/^Ifc/, "");
}

export function BimClashRow(props: {
  clash: ClashRow;
  selected: boolean;
  stale: boolean;
  orphaned: boolean;
  onSelect: () => void;
  onResolve: () => void;
}) {
  const { clash } = props;
  const nameA = clashElementLabel(clash.elementA, clash.guidA);
  const nameB = clashElementLabel(clash.elementB, clash.guidB);
  const typeA = shortType(clash.elementA?.ifcType);
  const typeB = shortType(clash.elementB?.ifcType);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={props.onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onSelect();
          }
        }}
        className={`bim-focus-ring bim-action-card flex w-full cursor-pointer flex-col gap-1.5 p-2.5 text-left ${
          props.selected ? "ring-1 ring-[var(--bim-accent)]" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start gap-1.5">
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: CLASH_ITEM1_COLOR }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[var(--bim-text)]">{nameA}</p>
                <p className="truncate text-[9px] text-[var(--bim-text-muted)]">{typeA}</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: CLASH_ITEM2_COLOR }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[var(--bim-text)]">{nameB}</p>
                <p className="truncate text-[9px] text-[var(--bim-text-muted)]">{typeB}</p>
              </div>
            </div>
          </div>
          <span className="bim-clash-pill shrink-0" data-status={clash.status}>
            {clashStatusLabel(clash.status)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-[var(--bim-hover)] px-1.5 py-0.5 text-[9px] text-[var(--bim-text-muted)]">
            {clashTypeLabel(clash.clashType)}
          </span>
          <span className="text-[10px] font-medium tabular-nums text-[var(--bim-text)]">
            {formatClashDistanceMm(clash.distanceMm)}
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
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[9px] text-[var(--bim-text-subtle)]">
          <span>First {shortDate(clash.firstSeenAt)}</span>
          <span>Last {shortDate(clash.lastSeenAt)}</span>
          {clash.issue ? (
            <span className="text-[var(--bim-info)]">Issue · {clash.issue.status}</span>
          ) : null}
        </div>

        {clash.status === "NEW" || clash.status === "ACTIVE" ? (
          <button
            type="button"
            className="bim-btn-secondary bim-focus-ring mt-0.5 self-start px-2 py-1 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              props.onResolve();
            }}
          >
            Resolve
          </button>
        ) : null}
      </div>
    </li>
  );
}
