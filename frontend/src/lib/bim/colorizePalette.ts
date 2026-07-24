import { BIM_PALETTE } from "@/lib/bim/bimPalette";

const { status: S, mep: M, interaction: I, materials: MAT } = BIM_PALETTE;

/** Balanced colorize palette — only colors from the viewer system. */
const COLORIZE_PALETTE = [
  S.primary,
  S.danger,
  S.success,
  S.warning,
  M.communication,
  S.information,
  M.hvac,
  M.plumbing,
  M.electrical,
  M.fire,
  I.hoveredOutline,
  MAT.glass,
  S.primary,
  M.communication,
  S.information,
  M.hvac,
  S.success,
  S.danger,
  S.primary,
  S.information,
  S.warning,
  M.communication,
  S.success,
  S.danger,
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
