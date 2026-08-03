"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers2,
  List,
  RotateCcw,
  Settings2,
  TicketPlus,
} from "lucide-react";
import type {
  BimClashRunStats,
  BimClashSetDef,
  BimClashStatus,
} from "@plansync/shared/bimClashTypes";
import type { BimClashRow as ClashRow, BimClashTestRow } from "@/lib/api-client/bim-clash";
import { patchClash } from "@/lib/api-client/bim-clash";
import type { ClashContextMode } from "@/lib/bim/clash/clashSessionStorage";
import { clashElementLabel } from "@/lib/bim/clash/clashLabels";
import {
  CLASH_ITEM1_COLOR,
  CLASH_ITEM2_COLOR,
  clashStatusLabel,
} from "@/lib/bim/clash/clashStatusStyle";
import { BimClashRow } from "./BimClashRow";
import { BimClashDetailPanel } from "./BimClashDetailPanel";
import { BimClashSetsPanel } from "./BimClashSetsPanel";
import { toast } from "sonner";

const FILTERS: Array<BimClashStatus | "ALL" | "ORPHANED" | "STALE"> = [
  "ALL",
  "NEW",
  "ACTIVE",
  "RESOLVED",
  "IGNORED",
  "ORPHANED",
  "STALE",
];

type ClashDockTab = "results" | "setup";
type ResultsPane = "list" | "detail";

export type BimClashSetupProps = {
  setA: BimClashSetDef;
  setB: BimClashSetDef;
  setACount: number;
  setBCount: number;
  models: { modelId: string; name: string; visible: boolean }[];
  typeOptionsA: { ifcType: string; count: number }[];
  typeOptionsB: { ifcType: string; count: number }[];
  levels: string[];
  clearanceEnabled: boolean;
  clearanceMm: number;
  running: boolean;
  progress: number | null;
  onChangeSetA: (set: BimClashSetDef) => void;
  onChangeSetB: (set: BimClashSetDef) => void;
  onToggleModelVisible: (modelId: string, visible: boolean) => void;
  onClearanceEnabledChange: (v: boolean) => void;
  onClearanceMmChange: (v: number) => void;
  onRun: () => void;
  onCancel: () => void;
};

function isStale(clash: ClashRow, test: BimClashTestRow | null): boolean {
  if (!test?.lastRunAt) return false;
  return new Date(clash.lastSeenAt).getTime() < new Date(test.lastRunAt).getTime();
}

function filterLabel(f: (typeof FILTERS)[number]): string {
  if (f === "ALL") return "All";
  if (f === "ORPHANED") return "Orphaned";
  if (f === "STALE") return "Stale";
  return clashStatusLabel(f);
}

function elementLabel(clash: ClashRow, side: "a" | "b"): string {
  if (side === "a") return clashElementLabel(clash.elementA, clash.guidA);
  return clashElementLabel(clash.elementB, clash.guidB);
}

/** Group header: colliding element names (Navisworks-style pair label). */
function clashGroupTitle(clashes: ClashRow[]): { title: string; subtitle: string | null } {
  if (clashes.length === 0) return { title: "Group", subtitle: null };

  const pairKeys = new Map<string, { a: string; b: string; count: number }>();
  for (const c of clashes) {
    const a = elementLabel(c, "a");
    const b = elementLabel(c, "b");
    const key = `${c.guidA}\0${c.guidB}`;
    const prev = pairKeys.get(key);
    if (prev) prev.count += 1;
    else pairKeys.set(key, { a, b, count: 1 });
  }

  const pairs = [...pairKeys.values()].sort((x, y) => y.count - x.count);
  const primary = pairs[0]!;
  const title = `${primary.a} × ${primary.b}`;
  if (pairs.length <= 1) return { title, subtitle: null };
  return { title, subtitle: `+${pairs.length - 1} more pair${pairs.length === 2 ? "" : "s"}` };
}

// fallow-ignore-next-line complexity
export function BimClashDockContent(props: {
  test: BimClashTestRow | null;
  clashes: ClashRow[];
  selectedClashId: string | null;
  statusFilter: BimClashStatus | "ALL" | "ORPHANED" | "STALE";
  assigneeMe: boolean;
  grouped: boolean;
  contextMode: ClashContextMode;
  runStats: BimClashRunStats | null;
  setup: BimClashSetupProps;
  onStatusFilterChange: (f: BimClashStatus | "ALL" | "ORPHANED" | "STALE") => void;
  onAssigneeMeChange: (v: boolean) => void;
  onGroupedChange: (v: boolean) => void;
  onContextModeChange: (m: ClashContextMode) => void;
  onSelectClash: (clash: ClashRow) => void;
  onClashesChange: (clashes: ClashRow[]) => void;
  onCreateIssue: (clash: ClashRow) => void;
  onBulkCreateIssue: (clashes: ClashRow[]) => void;
  onDeleteClash?: (clash: ClashRow) => void;
  onResetResults?: () => void;
  onInspectClashItem?: (clash: ClashRow, item: "a" | "b") => void;
  creatingIssue?: boolean;
  currentUserId?: string | null;
}) {
  const [tab, setTab] = useState<ClashDockTab>(() =>
    props.clashes.length === 0 ? "setup" : "results",
  );
  const [resultsPane, setResultsPane] = useState<ResultsPane>("list");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const wasRunning = useRef(false);
  const listRef = useRef<HTMLUListElement | null>(null);

  // After a run finishes, jump to Results so the list is front-and-center.
  useEffect(() => {
    if (props.setup.running) {
      wasRunning.current = true;
      return;
    }
    if (wasRunning.current) {
      wasRunning.current = false;
      setTab("results");
      setResultsPane("list");
    }
  }, [props.setup.running]);

  // If selection clears (exit review), return to the list.
  useEffect(() => {
    if (!props.selectedClashId) setResultsPane("list");
  }, [props.selectedClashId]);

  const filtered = useMemo(() => {
    let rows = props.clashes;
    if (props.assigneeMe && props.currentUserId) {
      rows = rows.filter((c) => c.assigneeId === props.currentUserId);
    }
    switch (props.statusFilter) {
      case "ALL":
        break;
      case "ORPHANED":
        rows = rows.filter((c) => Boolean(c.elementMissingSinceId));
        break;
      case "STALE":
        rows = rows.filter((c) => isStale(c, props.test));
        break;
      default:
        rows = rows.filter((c) => c.status === props.statusFilter);
    }
    return rows;
  }, [props.clashes, props.statusFilter, props.assigneeMe, props.currentUserId, props.test]);

  const groups = useMemo(() => {
    const map = new Map<string, ClashRow[]>();
    for (const c of filtered) {
      const key = c.groupId ?? c.id;
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const selected = props.clashes.find((c) => c.id === props.selectedClashId) ?? null;
  const selectedIndex = selected ? filtered.findIndex((c) => c.id === selected.id) : -1;
  const stats = props.runStats ?? props.test?.lastRunStats ?? null;
  const setupSummary = `${props.setup.setA.label} vs ${props.setup.setB.label}${
    props.setup.clearanceEnabled ? ` · ${props.setup.clearanceMm} mm` : ""
  }`;

  function selectClash(clash: ClashRow, openDetail = false) {
    props.onSelectClash(clash);
    if (openDetail) setResultsPane("detail");
  }

  function stepClash(delta: -1 | 1) {
    if (filtered.length === 0) return;
    const idx = selectedIndex < 0 ? 0 : selectedIndex;
    const next = filtered[(idx + delta + filtered.length) % filtered.length];
    if (next) {
      props.onSelectClash(next);
      setResultsPane("detail");
    }
  }

  async function resolveClash(clash: ClashRow) {
    try {
      const updated = await patchClash(clash.id, { status: "RESOLVED" });
      props.onClashesChange(props.clashes.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve clash");
    }
  }

  async function promoteGroup(groupClashes: ClashRow[]) {
    props.onBulkCreateIssue(groupClashes);
  }

  function confirmReset() {
    if (!props.onResetResults) return;
    const count = props.clashes.length;
    const ok = window.confirm(
      count > 0
        ? `Clear all ${count.toLocaleString()} clash${count === 1 ? "" : "es"} and start over? This cannot be undone.`
        : "Clear clash results and start over?",
    );
    if (!ok) return;
    props.onResetResults();
    setResultsPane("list");
    setTab("setup");
  }

  function confirmDelete(clash: ClashRow) {
    if (!props.onDeleteClash) return;
    const ok = window.confirm("Delete this clash from the project? This cannot be undone.");
    if (!ok) return;
    props.onDeleteClash(clash);
    setResultsPane("list");
  }

  // Keep the selected row visible when browsing from the HUD.
  useEffect(() => {
    if (resultsPane !== "list" || !props.selectedClashId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-clash-id="${props.selectedClashId}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [props.selectedClashId, resultsPane]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--bim-border)] px-2.5 py-2">
        <div className="bim-segment bim-segment-compact">
          {(
            [
              ["results", "Results"],
              ["setup", "Setup"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="bim-segment-btn"
              data-active={tab === id ? "true" : undefined}
              onClick={() => {
                setTab(id);
                if (id === "results") setResultsPane("list");
              }}
            >
              {label}
              {id === "results" && props.clashes.length > 0 ? (
                <span className="ml-1 tabular-nums opacity-70">{props.clashes.length}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "setup" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {props.onResetResults && props.clashes.length > 0 ? (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--bim-border)] px-2.5 py-1.5">
              <p className="text-[10px] text-[var(--bim-text-muted)]">
                {props.clashes.length.toLocaleString()} saved result
                {props.clashes.length === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                className="bim-focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-[var(--bim-danger)] hover:bg-[var(--bim-hover)]"
                onClick={confirmReset}
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Clear & start over
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <BimClashSetsPanel {...props.setup} />
          </div>
        </div>
      ) : resultsPane === "detail" && selected && selectedIndex >= 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-1 border-b border-[var(--bim-border)] px-2 py-1.5">
            <button
              type="button"
              className="bim-focus-ring bim-rail-btn h-8 w-8"
              aria-label="Back to clash list"
              onClick={() => setResultsPane("list")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-[11px] font-semibold text-[var(--bim-text)]">
                Clash detail
              </p>
              <p className="truncate text-[10px] tabular-nums text-[var(--bim-text-muted)]">
                {selectedIndex + 1} of {filtered.length}
              </p>
            </div>
            <button
              type="button"
              className="bim-focus-ring bim-rail-btn h-8 w-8"
              aria-label="Previous clash"
              disabled={filtered.length <= 1}
              onClick={() => stepClash(-1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="bim-focus-ring bim-rail-btn h-8 w-8"
              aria-label="Next clash"
              disabled={filtered.length <= 1}
              onClick={() => stepClash(1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <BimClashDetailPanel
              clash={selected}
              creatingIssue={props.creatingIssue}
              onUpdated={(updated) =>
                props.onClashesChange(props.clashes.map((c) => (c.id === updated.id ? updated : c)))
              }
              onCreateIssue={props.onCreateIssue}
              onDelete={props.onDeleteClash ? () => confirmDelete(selected) : undefined}
              onInspectItem={
                props.onInspectClashItem
                  ? (item) => props.onInspectClashItem?.(selected, item)
                  : undefined
              }
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-1 border-b border-[var(--bim-border)] px-2.5 py-1.5">
            <p
              className="min-w-0 flex-1 truncate text-[10px] text-[var(--bim-text-muted)]"
              title={setupSummary}
            >
              <span className="font-medium text-[var(--bim-text)]">{setupSummary}</span>
              {stats ? (
                <span className="text-[var(--bim-text-subtle)]">
                  {" "}
                  · +{stats.newCount} new
                  {stats.reopenedCount ? `, ${stats.reopenedCount} reopened` : ""}
                </span>
              ) : null}
            </p>
            {props.onResetResults && (props.clashes.length > 0 || props.test) ? (
              <button
                type="button"
                className="bim-focus-ring inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-[var(--bim-danger)] hover:bg-[var(--bim-hover)]"
                title="Clear all results and start over"
                onClick={confirmReset}
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Reset
              </button>
            ) : null}
            <button
              type="button"
              className="bim-focus-ring inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-[var(--bim-accent)] hover:bg-[var(--bim-hover)]"
              onClick={() => setTab("setup")}
            >
              <Settings2 className="h-3 w-3" aria-hidden />
              Edit
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--bim-border)] px-2.5 py-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`bim-focus-ring rounded-md px-2 py-1 text-[10px] font-medium ${
                  props.statusFilter === f
                    ? "bg-[var(--bim-accent-muted)] text-[var(--bim-text)]"
                    : "text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)]"
                }`}
                onClick={() => props.onStatusFilterChange(f)}
              >
                {filterLabel(f)}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-0.5">
              <label className="flex items-center gap-1 px-1 text-[10px] text-[var(--bim-text-muted)]">
                <input
                  type="checkbox"
                  checked={props.assigneeMe}
                  onChange={(e) => props.onAssigneeMeChange(e.target.checked)}
                />
                Mine
              </label>
              <button
                type="button"
                className="bim-focus-ring bim-rail-btn h-8 w-8"
                aria-label={props.grouped ? "Flat list" : "Group list"}
                title={props.grouped ? "Show flat list" : "Group clashes"}
                onClick={() => props.onGroupedChange(!props.grouped)}
              >
                {props.grouped ? (
                  <List className="h-3.5 w-3.5" />
                ) : (
                  <Layers2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--bim-border)] px-2.5 py-1.5">
            <div className="bim-segment bim-segment-compact min-w-0 flex-1">
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
                  onClick={() => props.onContextModeChange(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="shrink-0 text-[10px] tabular-nums text-[var(--bim-text-muted)]">
              {props.grouped
                ? `${groups.length} groups`
                : `${filtered.length}/${props.clashes.length}`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
              <p className="text-[12px] font-medium text-[var(--bim-text)]">
                {props.clashes.length === 0 ? "No clashes yet" : "No matching clashes"}
              </p>
              <p className="text-[10px] text-[var(--bim-text-muted)]">
                {props.clashes.length === 0
                  ? "Configure sets and run a test to find collisions."
                  : "Try another status filter or clear Mine."}
              </p>
              {props.clashes.length === 0 ? (
                <button
                  type="button"
                  className="bim-btn-primary bim-focus-ring flex min-h-9 items-center gap-1.5 px-3 text-[11px]"
                  onClick={() => setTab("setup")}
                >
                  <Settings2 className="h-3.5 w-3.5" aria-hidden />
                  Configure sets & run
                </button>
              ) : null}
            </div>
          ) : (
            <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
              {props.grouped
                ? groups.map(([groupId, groupClashes]) => {
                    const open = expandedGroups.has(groupId);
                    const { title, subtitle } = clashGroupTitle(groupClashes);
                    return (
                      <li key={groupId} className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="bim-focus-ring flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left hover:bg-[var(--bim-hover)]"
                            title={title}
                            onClick={() => {
                              setExpandedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(groupId)) next.delete(groupId);
                                else next.add(groupId);
                                return next;
                              });
                              if (groupClashes[0]) selectClash(groupClashes[0]);
                            }}
                          >
                            {open ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--bim-text-muted)]" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--bim-text-muted)]" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: CLASH_ITEM1_COLOR }}
                                  aria-hidden
                                />
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: CLASH_ITEM2_COLOR }}
                                  aria-hidden
                                />
                                <span className="truncate text-[11px] font-semibold text-[var(--bim-text)]">
                                  {title}
                                </span>
                              </span>
                              {subtitle ? (
                                <span className="mt-0.5 block truncate pl-5 text-[9px] text-[var(--bim-text-muted)]">
                                  {subtitle}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 rounded-md bg-[var(--bim-hover)] px-1.5 text-[10px] text-[var(--bim-text-muted)]">
                              {groupClashes.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="bim-focus-ring bim-rail-btn h-8 w-8"
                            title="Promote group to one issue"
                            aria-label="Promote group to one issue"
                            onClick={() => void promoteGroup(groupClashes)}
                          >
                            <TicketPlus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {open ? (
                          <ul className="space-y-1.5 pl-2">
                            {groupClashes.map((clash) => (
                              <BimClashRow
                                key={clash.id}
                                clash={clash}
                                selected={props.selectedClashId === clash.id}
                                stale={isStale(clash, props.test)}
                                orphaned={Boolean(clash.elementMissingSinceId)}
                                onSelect={() => selectClash(clash)}
                                onOpenDetail={() => selectClash(clash, true)}
                                onResolve={() => void resolveClash(clash)}
                                onDelete={
                                  props.onDeleteClash ? () => confirmDelete(clash) : undefined
                                }
                              />
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })
                : filtered.map((clash) => (
                    <BimClashRow
                      key={clash.id}
                      clash={clash}
                      selected={props.selectedClashId === clash.id}
                      stale={isStale(clash, props.test)}
                      orphaned={Boolean(clash.elementMissingSinceId)}
                      onSelect={() => selectClash(clash)}
                      onOpenDetail={() => selectClash(clash, true)}
                      onResolve={() => void resolveClash(clash)}
                      onDelete={props.onDeleteClash ? () => confirmDelete(clash) : undefined}
                    />
                  ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
