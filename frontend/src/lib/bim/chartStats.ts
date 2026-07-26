import type { BimQuantityIndex } from "@/lib/bim/types";

export type BimChartSegmentKind = "type" | "level" | "discipline";

export type BimChartSegment = {
  id: string;
  label: string;
  kind: BimChartSegmentKind;
  count: number;
  totalArea: number | null;
  totalVolume: number | null;
  guids: string[];
};

export type BimAnalyticsSnapshot = {
  totalElements: number;
  typeCount: number;
  levelCount: number;
  totalArea: number | null;
  totalVolume: number | null;
  loqQuantitiesPct: number | null;
  topTypes: BimChartSegment[];
  topLevels: BimChartSegment[];
  disciplines: BimChartSegment[];
};

const TOP_N = 10;

/** Human-readable IFC type label (IfcWallStandardCase → Wall Standard Case). */
function formatIfcTypeLabel(ifcType: string): string {
  const stripped = ifcType.replace(/^Ifc/i, "").trim();
  if (!stripped) return ifcType;
  return stripped.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function formatQuantity(value: number, unit: string, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: digits })} ${unit}`;
}

export function segmentIsFullySelected(
  segment: BimChartSegment,
  selectedGuids: Set<string>,
): boolean {
  if (segment.guids.length === 0) return false;
  return segment.guids.every((g) => selectedGuids.has(g));
}

/** Build chart-ready aggregates from a quantity index (single model or federated merge). */
// fallow-ignore-next-line complexity
export function buildAnalyticsSnapshot(
  index: BimQuantityIndex | null,
): BimAnalyticsSnapshot | null {
  if (!index) return null;

  const topTypes = Object.values(index.byType)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N)
    .map(
      (agg): BimChartSegment => ({
        id: agg.ifcType,
        label: formatIfcTypeLabel(agg.ifcType),
        kind: "type",
        count: agg.count,
        totalArea: agg.totalArea ?? null,
        totalVolume: agg.totalVolume ?? null,
        guids: agg.guids,
      }),
    );

  const topLevels = Object.values(index.byLevel)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N)
    .map(
      (agg): BimChartSegment => ({
        id: agg.level,
        label: agg.level,
        kind: "level",
        count: agg.count,
        totalArea: null,
        totalVolume: null,
        guids: agg.guids,
      }),
    );

  const disciplineBuckets = new Map<
    string,
    {
      count: number;
      guids: string[];
      area: number;
      volume: number;
      hasArea: boolean;
      hasVolume: boolean;
    }
  >();
  for (const el of index.elements) {
    const key = el.discipline?.trim() || "Unassigned";
    let bucket = disciplineBuckets.get(key);
    if (!bucket) {
      bucket = { count: 0, guids: [], area: 0, volume: 0, hasArea: false, hasVolume: false };
      disciplineBuckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.guids.push(el.guid);
    if (el.quantities.area != null) {
      bucket.area += el.quantities.area;
      bucket.hasArea = true;
    }
    if (el.quantities.volume != null) {
      bucket.volume += el.quantities.volume;
      bucket.hasVolume = true;
    }
  }

  const disciplines = [...disciplineBuckets.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP_N)
    .map(
      ([id, bucket]): BimChartSegment => ({
        id,
        label: id,
        kind: "discipline",
        count: bucket.count,
        totalArea: bucket.hasArea ? bucket.area : null,
        totalVolume: bucket.hasVolume ? bucket.volume : null,
        guids: bucket.guids,
      }),
    );

  let totalArea = 0;
  let totalVolume = 0;
  let hasArea = false;
  let hasVolume = false;
  for (const agg of Object.values(index.byType)) {
    if (agg.totalArea != null) {
      totalArea += agg.totalArea;
      hasArea = true;
    }
    if (agg.totalVolume != null) {
      totalVolume += agg.totalVolume;
      hasVolume = true;
    }
  }

  return {
    totalElements: index.elements.length,
    typeCount: Object.keys(index.byType).length,
    levelCount: Object.keys(index.byLevel).length,
    totalArea: hasArea ? totalArea : null,
    totalVolume: hasVolume ? totalVolume : null,
    loqQuantitiesPct: index.loq?.pctQuantities ?? null,
    topTypes,
    topLevels,
    disciplines,
  };
}
