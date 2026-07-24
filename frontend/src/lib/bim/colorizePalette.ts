/** Balanced colorize palette — clear on dark viewports without harsh saturation. */
const COLORIZE_PALETTE = [
  "#4d9ae8",
  "#e06c6c",
  "#52b872",
  "#e8a030",
  "#9470d8",
  "#38a8b8",
  "#d85898",
  "#78b848",
  "#e08848",
  "#6070d8",
  "#40a898",
  "#c85858",
  "#c8a838",
  "#8068c0",
  "#4890c8",
  "#b850a8",
  "#48a878",
  "#c84868",
  "#5868c8",
  "#38a0a0",
  "#d88038",
  "#8868c0",
  "#48c068",
  "#c85878",
] as const;

/** Opacity for colorized geometry — visible but not flat/opaque. */
export const COLORIZE_HIGHLIGHT_OPACITY = 0.9;

const COLORIZE_MAX_DISTINCT = 24;
const COLORIZE_OTHER_LABEL = "Other";

export type ColorizeLegendEntry = {
  value: string;
  color: string;
  count: number;
  guids: string[];
};

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Stable auto color for a property value. */
function colorForValue(value: string, orderIndex?: number): string {
  if (orderIndex != null && orderIndex >= 0 && orderIndex < COLORIZE_PALETTE.length) {
    return COLORIZE_PALETTE[orderIndex]!;
  }
  return COLORIZE_PALETTE[hashString(value) % COLORIZE_PALETTE.length]!;
}

/** Group GUIDs by distinct property values and assign palette colors. */
// fallow-ignore-next-line complexity
export function buildColorizeLegend(
  entries: { guid: string; value: string }[],
): ColorizeLegendEntry[] {
  const buckets = new Map<string, string[]>();
  for (const { guid, value } of entries) {
    const key = value.trim() || "(empty)";
    const list = buckets.get(key) ?? [];
    list.push(guid);
    buckets.set(key, list);
  }

  const sorted = [...buckets.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0]);
  });

  const legend: ColorizeLegendEntry[] = [];
  let otherGuids: string[] = [];

  sorted.forEach(([value, guids], index) => {
    if (index < COLORIZE_MAX_DISTINCT) {
      legend.push({
        value,
        color: colorForValue(value, index),
        count: guids.length,
        guids,
      });
    } else {
      otherGuids = otherGuids.concat(guids);
    }
  });

  if (otherGuids.length > 0) {
    legend.push({
      value: COLORIZE_OTHER_LABEL,
      color: colorForValue(COLORIZE_OTHER_LABEL, COLORIZE_MAX_DISTINCT),
      count: otherGuids.length,
      guids: otherGuids,
    });
  }

  return legend;
}
