"use client";

import { Eye, EyeOff, Loader2, Minus, Plus, Search, SquarePen, X } from "lucide-react";
import {
  COMPARE_COLORS,
  COMPARE_KIND_LABEL,
  compareRowLabel,
  type BimCompareKind,
} from "@/lib/bim/bimCompare";
import type { useBimCompareSession } from "@/lib/bim/useBimCompareSession";

type CompareSession = ReturnType<typeof useBimCompareSession>;

const KIND_ICON = {
  added: Plus,
  modified: SquarePen,
  deleted: Minus,
} as const;

export function BimCompareCanvasLegend(props: {
  counts: CompareSession["changes"];
  visibleKinds: CompareSession["visibleKinds"];
}) {
  if (!props.counts) return null;
  const items: { kind: BimCompareKind; count: number }[] = [
    { kind: "added", count: props.counts.counts.added },
    { kind: "modified", count: props.counts.counts.modified },
    { kind: "deleted", count: props.counts.counts.deleted },
  ];
  return (
    <div
      className="pointer-events-none absolute left-3 z-[8] flex flex-wrap gap-1.5"
      style={{ bottom: "var(--bim-bottom-bar-offset)" }}
    >
      {items.map((item) => {
        if (!props.visibleKinds[item.kind] || item.count === 0) return null;
        return (
          <span
            key={item.kind}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--bim-border)] bg-[var(--bim-panel)]/95 px-2 py-1 text-[11px] font-medium text-[var(--bim-text)] shadow-sm"
          >
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: COMPARE_COLORS[item.kind] }}
              aria-hidden
            />
            {COMPARE_KIND_LABEL[item.kind]}
            <span className="tabular-nums text-[var(--bim-text-muted)]">{item.count}</span>
          </span>
        );
      })}
    </div>
  );
}

// fallow-ignore-next-line complexity
export function BimCompareDockContent(props: {
  session: CompareSession;
  currentVersionLabel: string;
  onFocusGuid: (guid: string) => void;
}) {
  const s = props.session;
  const older = s.versions.filter((v) => v.id !== s.currentFileVersionId && v.bimReady !== false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-[var(--bim-border)] px-3 py-3">
        <div>
          <p className="bim-section-title mb-1">Compare against</p>
          {older.length === 0 ? (
            <p className="text-[12px] text-[var(--bim-text-muted)]">
              Publish another revision of this model to compare versions.
            </p>
          ) : (
            <select
              className="bim-select w-full"
              aria-label="Version to compare against"
              value={s.baseFileVersionId ?? ""}
              onChange={(e) => s.setBaseFileVersionId(e.target.value || null)}
            >
              {older.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                  {v.bimPublishedAt ? " · published" : ""}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1.5 text-[11px] text-[var(--bim-text-muted)]">
            {props.currentVersionLabel} vs {s.changes ? `v${s.changes.baseVersion}` : "…"}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["added", "modified", "deleted"] as const).map((kind) => {
            const count = s.changes?.counts[kind] ?? 0;
            const on = s.visibleKinds[kind];
            const Icon = KIND_ICON[kind];
            return (
              <button
                key={kind}
                type="button"
                data-active={on}
                aria-pressed={on}
                onClick={() => s.toggleKind(kind)}
                className="bim-focus-ring inline-flex items-center gap-1 rounded-md border border-[var(--bim-border)] px-2 py-1 text-[11px] font-medium text-[var(--bim-text)] hover:bg-[var(--bim-hover)] data-[active=true]:border-transparent"
                style={
                  on
                    ? {
                        background: `color-mix(in srgb, ${COMPARE_COLORS[kind]} 16%, transparent)`,
                        color: COMPARE_COLORS[kind],
                      }
                    : undefined
                }
              >
                <Icon className="h-3 w-3" aria-hidden />
                {COMPARE_KIND_LABEL[kind]}
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="bim-segment bim-segment-compact">
          <button
            type="button"
            data-active={!s.isolate}
            className="bim-segment-btn"
            onClick={() => s.setIsolate(false)}
          >
            <Eye className="mr-1 inline h-3 w-3" aria-hidden />
            Ghost
          </button>
          <button
            type="button"
            data-active={s.isolate}
            className="bim-segment-btn"
            onClick={() => s.setIsolate(true)}
          >
            <EyeOff className="mr-1 inline h-3 w-3" aria-hidden />
            Isolate
          </button>
        </div>
        <p className="text-[11px] text-[var(--bim-text-muted)]">
          Compares properties and quantities, not mesh.
        </p>
      </div>

      <div className="bim-dock-scroll min-h-0 flex-1 px-3 py-3">
        {s.overlayLoading ? (
          <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--bim-text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading previous geometry for removals…
          </p>
        ) : null}

        {s.changesError ? (
          <p className="text-[12px] text-[var(--bim-danger)]">{s.changesError}</p>
        ) : s.changesPending || s.revisionsPending ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--bim-text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Comparing versions…
          </p>
        ) : s.changedCount === 0 ? (
          <p className="text-[12px] text-[var(--bim-text-muted)]">
            No element changes in this pair.
          </p>
        ) : (
          <>
            <div className="bim-property-search mb-2">
              <Search className="bim-property-search__icon" aria-hidden />
              <input
                type="search"
                value={s.query}
                onChange={(e) => s.setQuery(e.target.value)}
                placeholder="Name, category, GUID…"
                aria-label="Search changes"
                className="bim-property-search__input"
              />
              {s.query ? (
                <button
                  type="button"
                  onClick={() => s.setQuery("")}
                  aria-label="Clear search"
                  className="bim-property-search__clear"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>
            {s.ifcTypes.length > 1 ? (
              <select
                className="bim-select mb-2 w-full"
                aria-label="Filter by category"
                value={s.ifcType ?? ""}
                onChange={(e) => s.setIfcType(e.target.value || null)}
              >
                <option value="">All categories</option>
                {s.ifcTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/^Ifc/i, "")}
                  </option>
                ))}
              </select>
            ) : null}

            <ul className="space-y-1">
              {s.rows.slice(0, 400).map((row) => {
                const active = s.selectedGuid === row.guid;
                return (
                  <li key={`${row.kind}:${row.guid}`}>
                    <button
                      type="button"
                      onClick={() => {
                        s.setListGuid(row.guid);
                        props.onFocusGuid(row.guid);
                      }}
                      className="bim-focus-ring flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:bg-[var(--bim-hover)]"
                      style={
                        active
                          ? {
                              borderColor: `color-mix(in srgb, ${COMPARE_COLORS[row.kind]} 40%, transparent)`,
                              background: `color-mix(in srgb, ${COMPARE_COLORS[row.kind]} 10%, transparent)`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: COMPARE_COLORS[row.kind] }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-[var(--bim-text)]">
                          {compareRowLabel(row)}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--bim-text-muted)]">
                          {COMPARE_KIND_LABEL[row.kind]}
                          {row.ifcType ? ` · ${row.ifcType.replace(/^Ifc/i, "")}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {s.rows.length > 400 ? (
              <p className="mt-2 text-[11px] text-[var(--bim-text-muted)]">
                Showing 400 of {s.rows.length.toLocaleString()}. Narrow the search.
              </p>
            ) : null}

            <FieldDiffCard session={s} />
          </>
        )}
      </div>
    </div>
  );
}

function FieldDiffCard(props: { session: CompareSession }) {
  const s = props.session;
  if (!s.selectedGuid || !s.selectedKind) return null;
  return (
    <div className="bim-detail-card mt-3">
      <p className="bim-section-title mb-1">
        {s.selectedKind === "modified" ? "What changed" : COMPARE_KIND_LABEL[s.selectedKind]}
      </p>
      {s.fieldDiffPending ? (
        <p className="text-[11px] text-[var(--bim-text-muted)]">Loading fields…</p>
      ) : !s.fieldDiff ? (
        <p className="text-[11px] text-[var(--bim-text-muted)]">No field details.</p>
      ) : s.fieldDiff.fields.length === 0 ? (
        <p className="text-[11px] text-[var(--bim-text-muted)]">
          Metadata changed (field details unavailable).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {s.fieldDiff.fields.map((field) => (
            <li key={field.key} className="text-[11px]">
              <p className="font-medium text-[var(--bim-text)]">{field.label}</p>
              <p className="tabular-nums text-[var(--bim-text-muted)]">
                <span className="line-through">{field.before ?? "—"}</span>
                {" → "}
                <span className="text-[var(--bim-text)]">{field.after ?? "—"}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
