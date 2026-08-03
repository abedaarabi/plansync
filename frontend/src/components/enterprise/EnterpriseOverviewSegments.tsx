"use client";

type OverviewCountSegment = {
  key: string;
  label: string;
  count: number;
  fill: string;
};

type SegmentBarProps = {
  segments: OverviewCountSegment[];
  onSelect?: (key: string) => void;
  label: string;
  /** Keys that render as non-clickable (e.g. synthetic “Other”). */
  nonSelectableKeys?: ReadonlySet<string> | readonly string[];
};

function isSelectableKey(
  key: string,
  onSelect: SegmentBarProps["onSelect"],
  nonSelectableKeys: SegmentBarProps["nonSelectableKeys"],
): boolean {
  if (!onSelect) return false;
  if (!nonSelectableKeys) return true;
  return !Array.from(nonSelectableKeys).includes(key);
}

export function OverviewSegmentBar({
  segments,
  onSelect,
  label,
  nonSelectableKeys,
}: SegmentBarProps) {
  const total = segments.reduce((a, s) => a + s.count, 0);
  if (total === 0) return null;
  return (
    <div
      className="w-full rounded-lg bg-[var(--enterprise-bg)] p-px ring-1 ring-[var(--enterprise-border)]/80"
      role={onSelect ? "group" : "img"}
      aria-label={`${label}, ${total} total`}
    >
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-md">
        {segments.map((s) => {
          if (isSelectableKey(s.key, onSelect, nonSelectableKeys)) {
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect?.(s.key)}
                className="min-h-full min-w-1 rounded-sm p-0 transition-opacity hover:opacity-75"
                style={{ flexGrow: s.count, backgroundColor: s.fill }}
                title={`${s.label}: ${s.count} — filter list`}
                aria-label={`Filter by ${s.label} (${s.count})`}
              />
            );
          }
          return (
            <div
              key={s.key}
              className="min-h-full min-w-1 rounded-sm"
              style={{ flexGrow: s.count, backgroundColor: s.fill }}
              title={`${s.label}: ${s.count}`}
            />
          );
        })}
      </div>
    </div>
  );
}

type SegmentLegendProps = {
  segments: OverviewCountSegment[];
  onSelect?: (key: string) => void;
  activeKey?: string;
  nonSelectableKeys?: ReadonlySet<string> | readonly string[];
};

export function OverviewSegmentLegend({
  segments,
  onSelect,
  activeKey,
  nonSelectableKeys,
}: SegmentLegendProps) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
      {segments.map((s) => {
        const selectable = isSelectableKey(s.key, onSelect, nonSelectableKeys);
        const active = activeKey === s.key;
        const inner = (
          <>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
              style={{ backgroundColor: s.fill }}
              aria-hidden
            />
            {s.label}{" "}
            <span className="tabular-nums font-semibold text-[var(--enterprise-text)]">
              {s.count}
            </span>
          </>
        );
        if (!selectable) {
          return (
            <li
              key={s.key}
              className="inline-flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-[var(--enterprise-text-muted)]"
            >
              {inner}
            </li>
          );
        }
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect?.(s.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] ${
                active
                  ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-text)]"
                  : "text-[var(--enterprise-text-muted)]"
              }`}
            >
              {inner}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
