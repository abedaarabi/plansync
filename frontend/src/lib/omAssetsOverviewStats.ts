/** Pure aggregations behind the O&M assets overview (no React, no fetches). */

import type { OmAssetRow } from "@/lib/api-client";
import { assetHasSheetPin } from "@/lib/assetPinFocus";
import { omAssetHasBimLink } from "@/lib/omAssetViewerNavigation";

const DAY_MS = 86_400_000;
const WARRANTY_WINDOW_DAYS = 90;
const TOP_CATEGORIES = 6;

export type OmAssetCountSegment = {
  key: string;
  label: string;
  count: number;
  fill: string;
};

export type OmAssetsLinkStatus = "UNLINKED" | "SHEET" | "PIN" | "BIM";

/** Filter keys applied client-side to the register list. */
export type OmAssetsListFilter =
  | "ALL"
  | "WITH_PHOTO"
  | "MISSING_PHOTO"
  | "ON_DRAWING"
  | "LINKED"
  | "WARRANTY_EXPIRING"
  | OmAssetsLinkStatus
  | `CAT:${string}`;

export type OmAssetsOverviewStats = {
  total: number;
  withPhoto: number;
  missingPhoto: number;
  onDrawing: number;
  linked: number;
  warrantyExpiring: number;
  linkSegments: OmAssetCountSegment[];
  categorySegments: OmAssetCountSegment[];
};

const LINK_LABEL: Record<OmAssetsLinkStatus, string> = {
  UNLINKED: "Unlinked",
  SHEET: "Sheet linked",
  PIN: "Pin on sheet",
  BIM: "3D model",
};

const LINK_FILL: Record<OmAssetsLinkStatus, string> = {
  UNLINKED: "#94a3b8",
  SHEET: "#64748b",
  PIN: "#0d9488",
  BIM: "#0284c7",
};

const LINK_ORDER: readonly OmAssetsLinkStatus[] = ["BIM", "PIN", "SHEET", "UNLINKED"];

const CATEGORY_FILLS = [
  "#2563eb",
  "#0d9488",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#64748b",
];

function todayStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function warrantyDayMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  }
  const t = new Date(`${day}T00:00:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Warranty end is set and falls on or before today + 90 days (includes expired). */
function assetWarrantyExpiringSoon(
  asset: Pick<OmAssetRow, "warrantyExpires">,
  nowMs: number,
): boolean {
  const d = warrantyDayMs(asset.warrantyExpires);
  if (d == null) return false;
  return d <= todayStartMs(nowMs) + WARRANTY_WINDOW_DAYS * DAY_MS;
}

function assetLinkStatus(
  asset: Pick<OmAssetRow, "fileId" | "fileVersionId" | "annotationId" | "pinJson" | "bimAnchor">,
): OmAssetsLinkStatus {
  if (omAssetHasBimLink(asset)) return "BIM";
  if (assetHasSheetPin(asset)) return "PIN";
  if (asset.fileId) return "SHEET";
  return "UNLINKED";
}

function categoryKey(asset: Pick<OmAssetRow, "category">): string {
  const c = asset.category?.trim();
  return c && c.length > 0 ? c : "Uncategorized";
}

function assetMatchesListFilter(
  asset: OmAssetRow,
  filter: OmAssetsListFilter,
  nowMs: number,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "WITH_PHOTO") return asset.hasImage;
  if (filter === "MISSING_PHOTO") return !asset.hasImage;
  if (filter === "ON_DRAWING") return assetHasSheetPin(asset);
  if (filter === "LINKED") return Boolean(asset.fileId);
  if (filter === "WARRANTY_EXPIRING") return assetWarrantyExpiringSoon(asset, nowMs);
  if (filter === "UNLINKED" || filter === "SHEET" || filter === "PIN" || filter === "BIM") {
    return assetLinkStatus(asset) === filter;
  }
  if (filter.startsWith("CAT:")) {
    return categoryKey(asset) === filter.slice(4);
  }
  return true;
}

export function filterOmAssets(
  rows: OmAssetRow[],
  filter: OmAssetsListFilter,
  nowMs: number,
): OmAssetRow[] {
  if (filter === "ALL") return rows;
  return rows.filter((a) => assetMatchesListFilter(a, filter, nowMs));
}

function buildLinkSegments(linkCounts: Map<OmAssetsLinkStatus, number>): OmAssetCountSegment[] {
  const linkSegments: OmAssetCountSegment[] = [];
  for (const key of LINK_ORDER) {
    const count = linkCounts.get(key) ?? 0;
    if (count === 0) continue;
    linkSegments.push({ key, label: LINK_LABEL[key], count, fill: LINK_FILL[key] });
  }
  return linkSegments;
}

function buildCategorySegments(categoryCounts: Map<string, number>): OmAssetCountSegment[] {
  const sortedCats = [...categoryCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const categorySegments: OmAssetCountSegment[] = [];
  let other = 0;
  for (let i = 0; i < sortedCats.length; i += 1) {
    const [label, count] = sortedCats[i]!;
    if (i < TOP_CATEGORIES) {
      categorySegments.push({
        key: `CAT:${label}`,
        label,
        count,
        fill: CATEGORY_FILLS[i % CATEGORY_FILLS.length]!,
      });
    } else {
      other += count;
    }
  }
  if (other > 0) {
    categorySegments.push({
      key: "CAT:__other__",
      label: "Other",
      count: other,
      fill: "#94a3b8",
    });
  }
  return categorySegments;
}

export function computeOmAssetsOverview(rows: OmAssetRow[], nowMs: number): OmAssetsOverviewStats {
  let withPhoto = 0;
  let onDrawing = 0;
  let linked = 0;
  let warrantyExpiring = 0;
  const linkCounts = new Map<OmAssetsLinkStatus, number>();
  const categoryCounts = new Map<string, number>();

  for (const a of rows) {
    if (a.hasImage) withPhoto += 1;
    if (assetHasSheetPin(a)) onDrawing += 1;
    if (a.fileId) linked += 1;
    if (assetWarrantyExpiringSoon(a, nowMs)) warrantyExpiring += 1;

    const link = assetLinkStatus(a);
    linkCounts.set(link, (linkCounts.get(link) ?? 0) + 1);

    const cat = categoryKey(a);
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  return {
    total: rows.length,
    withPhoto,
    missingPhoto: rows.length - withPhoto,
    onDrawing,
    linked,
    warrantyExpiring,
    linkSegments: buildLinkSegments(linkCounts),
    categorySegments: buildCategorySegments(categoryCounts),
  };
}
