import type { BimSelection } from "@/components/bim-viewer/bimEngine";
import type { OmAssetBimAnchor } from "@/lib/api-client/operations-maintenance-assets";
import { emptyAssetDraft, type AssetFormDraft } from "@/components/enterprise/OmAssetFormFields";
import { selectionToBimAnchor } from "@/lib/bim/bimIssueAnchor";

/** Farther framing than default zoom-to-selection (0.82) — keeps element in context. */
export const BIM_ASSET_SOFT_FIT_SCALE = 1.35;

const MANUFACTURER_KEYS = ["manufacturer", "maker", "vendor", "supplier"];
const MODEL_KEYS = [
  "model",
  "modelreference",
  "model reference",
  "articlenumber",
  "article number",
];

function findPsetValue(selection: BimSelection, keys: string[]): string | null {
  const want = new Set(keys.map((k) => k.toLowerCase()));
  for (const row of selection.attributes) {
    if (want.has(row.label.trim().toLowerCase()) && row.value.trim()) {
      return row.value.trim();
    }
  }
  for (const pset of selection.psets) {
    for (const prop of pset.props) {
      if (want.has(prop.label.trim().toLowerCase()) && prop.value.trim()) {
        return prop.value.trim();
      }
    }
  }
  return null;
}

function formatPosition(pos: { x: number; y: number; z: number }): string {
  const r = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));
  return `x=${r(pos.x)}, y=${r(pos.y)}, z=${r(pos.z)}`;
}

function buildNotesFromSelection(selection: BimSelection): string {
  const lines: string[] = [];
  if (selection.ifcGuid) lines.push(`IFC GUID: ${selection.ifcGuid}`);
  if (selection.ifcType) lines.push(`Type: ${selection.ifcType}`);
  if (selection.storey) lines.push(`Level: ${selection.storey}`);
  if (selection.position) lines.push(`Position: ${formatPosition(selection.position)}`);
  if (selection.sourceLabel) lines.push(`Model: ${selection.sourceLabel}`);
  return lines.join("\n");
}

export function bimAnchorFromSelection(selection: BimSelection): OmAssetBimAnchor | undefined {
  const anchor = selectionToBimAnchor(selection);
  if (!anchor?.ifcGuid || anchor.ifcGuid === "viewport-markup") return undefined;
  return {
    ifcGuid: anchor.ifcGuid,
    localId: anchor.localId,
    name: anchor.name,
    ifcType: anchor.ifcType,
    spatialPath: anchor.spatialPath,
    position: anchor.position,
    fileVersionId: selection.fileVersionId ?? undefined,
  };
}

/** Prefill O&M asset form fields from a BIM element selection. */
export function assetDraftFromBimSelection(selection: BimSelection): AssetFormDraft {
  const draft = emptyAssetDraft();
  const name = selection.name?.trim() || selection.ifcType?.trim() || "Equipment";
  draft.name = name;
  draft.category = selection.ifcType?.trim() ?? "";
  draft.locationLabel = selection.storey?.trim() ?? "";
  draft.manufacturer = findPsetValue(selection, MANUFACTURER_KEYS) ?? "";
  draft.model = findPsetValue(selection, MODEL_KEYS) ?? "";
  draft.notes = buildNotesFromSelection(selection);
  return draft;
}
