/** Normalized rect stored on asset.pinJson when linking from the viewer. */
export type AssetPinNormRect = { x: number; y: number; w: number; h: number };

export function rectNormFromAssetPinJson(
  pinJson: unknown,
  pageNumber: number | null | undefined,
): { rectNorm: AssetPinNormRect; pageNumber: number } | null {
  if (!pinJson || typeof pinJson !== "object") return null;
  const raw = pinJson as { normRect?: AssetPinNormRect; pageIndex?: number };
  const r = raw.normRect;
  if (
    !r ||
    typeof r.x !== "number" ||
    typeof r.y !== "number" ||
    typeof r.w !== "number" ||
    typeof r.h !== "number"
  ) {
    return null;
  }
  const pageIndex0 =
    typeof raw.pageIndex === "number" && Number.isFinite(raw.pageIndex)
      ? raw.pageIndex
      : pageNumber != null && pageNumber >= 1
        ? pageNumber - 1
        : 0;
  return { rectNorm: r, pageNumber: pageIndex0 + 1 };
}

export function assetHasSheetPin(asset: {
  annotationId?: string | null;
  fileVersionId?: string | null;
  pinJson?: unknown;
}): boolean {
  return Boolean(
    asset.fileVersionId && (asset.annotationId || rectNormFromAssetPinJson(asset.pinJson, null)),
  );
}
