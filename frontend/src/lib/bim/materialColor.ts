import { BIM_PALETTE } from "@/lib/bim/bimPalette";
import { disciplineForIfcType } from "@/lib/bim/discipline";
import {
  applyBimSurfaceMaps,
  surfaceKindFromIfcType,
  type BimSurfaceKind,
} from "@/lib/bim/materialSurfaces";
import type { BimColorMode, BimSpaceDisplayMode } from "@/lib/bim/viewportAppearance";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";

const { materials: M, mep: MEP, status: STATUS, ui: UI, interaction: IX } = BIM_PALETTE;

/** Default web-ifc / Revit export gray — treated as “no authored color”. */
const DEFAULT_GRAY_SAMPLES: readonly [number, number, number][] = [
  [0.5, 0.5, 0.5],
  [0.75, 0.75, 0.75],
  [0.752, 0.752, 0.752],
  [0.8, 0.8, 0.8],
  [0.878, 0.878, 0.878],
  [0.498, 0.498, 0.498],
  [0.702, 0.702, 0.702],
];

export type BimPbrParams = {
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  surfaceKind: BimSurfaceKind;
};

export type BimResolvedColor = {
  color: THREE.Color;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  renderTier: number;
  pbr: BimPbrParams;
};

/** Render order tiers — higher draws later (glass/spaces on top). */
export const BimRenderTier = {
  opaqueStructure: 0,
  opaqueDefault: 1,
  semiTransparent: 2,
  space: 3,
  glass: 4,
} as const;

const DISCIPLINE_COLORS: Record<string, string> = {
  Structure: M.column,
  Architecture: M.wall,
  Mechanical: MEP.hvac,
  Electrical: MEP.electrical,
  MEP: MEP.plumbing,
  Other: UI.disabled,
};

/** Default IFC materials + MEP — from BIM_PALETTE only. */
const IFC_TYPE_COLORS: Record<string, string> = {
  IfcWall: M.wall,
  IfcWallStandardCase: M.wall,
  IfcSlab: M.floor,
  IfcColumn: M.column,
  IfcBeam: M.column,
  IfcMember: M.column,
  IfcPlate: M.column,
  IfcDoor: M.door,
  IfcWindow: M.glass,
  IfcCurtainWall: M.glass,
  IfcRoof: M.ceiling,
  IfcStair: M.floor,
  IfcRailing: M.door,
  IfcCovering: M.ceiling,
  IfcPipeSegment: MEP.plumbing,
  IfcPipeFitting: MEP.plumbing,
  IfcFlowSegment: MEP.plumbing,
  IfcFlowFitting: MEP.plumbing,
  IfcSanitaryTerminal: MEP.plumbing,
  IfcDuctSegment: MEP.hvac,
  IfcDuctFitting: MEP.hvac,
  IfcAirTerminal: MEP.hvac,
  IfcCableCarrierSegment: MEP.electrical,
  IfcCableSegment: MEP.electrical,
  IfcElectricDistributionBoard: MEP.electrical,
  IfcLightFixture: MEP.electrical,
  IfcAlarm: MEP.fire,
  IfcFireSuppressionTerminal: MEP.fire,
  IfcProtectiveDevice: MEP.fire,
  IfcCommunicationsAppliance: MEP.communication,
  IfcAudioVisualAppliance: MEP.communication,
  IfcFlowTerminal: MEP.hvac,
  IfcFurnishingElement: M.door,
  IfcFooting: M.column,
  IfcPile: M.column,
  IfcBuildingElementProxy: M.wall,
  IfcOpeningElement: UI.border,
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// fallow-ignore-next-line complexity
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

// fallow-ignore-next-line complexity
function isDefaultGrayColor(r: number, g: number, b: number, a = 255): boolean {
  const sr = r / 255;
  const sg = g / 255;
  const sb = b / 255;
  for (const [dr, dg, db] of DEFAULT_GRAY_SAMPLES) {
    if (Math.abs(sr - dr) < 0.04 && Math.abs(sg - dg) < 0.04 && Math.abs(sb - db) < 0.04) {
      return true;
    }
  }
  const [, sat] = rgbToHsl(sr, sg, sb);
  return sat < 0.06 && a >= 250;
}

function normalizeIfcType(ifcType: string | null | undefined): string {
  if (!ifcType) return "IfcProduct";
  const t = ifcType.trim();
  if (t.startsWith("IFC") && !t.startsWith("Ifc")) return `Ifc${t.slice(3)}`;
  return t;
}

function isGlassType(ifcType: string): boolean {
  return /window|curtain|glass|plate|glazing|skylight|transom|panel/i.test(ifcType);
}

function isSpaceType(ifcType: string): boolean {
  return normalizeIfcType(ifcType).toLowerCase() === "ifcspace";
}

const SPACE_CATEGORY_PATTERN = /^IFCSPACE$/i;

/** Item local IDs for IfcSpace elements that have geometry. */
export async function buildSpaceItemIds(model: FRAGS.FragmentsModel): Promise<Set<number>> {
  const out = new Set<number>();
  try {
    const byCategory = await model.getItemsOfCategories([SPACE_CATEGORY_PATTERN]);
    for (const ids of Object.values(byCategory)) {
      for (const id of ids) out.add(id);
    }
  } catch {
    /* optional */
  }
  return out;
}

/** Material local IDs used exclusively or partially by IfcSpace samples. */
// fallow-ignore-next-line complexity
export async function buildSpaceMaterialIds(
  model: FRAGS.FragmentsModel,
  spaceItemIds?: Set<number>,
): Promise<Set<number>> {
  const items = spaceItemIds ?? (await buildSpaceItemIds(model));
  const out = new Set<number>();
  if (items.size === 0) return out;

  try {
    const samples = await model.getSamples();
    for (const sample of samples.values()) {
      if (items.has(sample.item)) out.add(sample.material);
    }
  } catch {
    /* optional */
  }
  return out;
}

function isStructureType(ifcType: string): boolean {
  return disciplineForIfcType(ifcType) === "Structure";
}

export type BimMaterialColorOptions = {
  colorMode?: BimColorMode;
  spaceDisplay?: BimSpaceDisplayMode;
};

function disciplineColor(ifcType: string): THREE.Color {
  const hex =
    DISCIPLINE_COLORS[disciplineForIfcType(normalizeIfcType(ifcType))] ?? DISCIPLINE_COLORS.Other;
  return new THREE.Color(hex);
}

// fallow-ignore-next-line complexity
function applyColorMode(
  color: THREE.Color,
  ifcType: string,
  src: { r: number; g: number; b: number; a: number } | undefined,
  mode: BimColorMode,
): THREE.Color {
  const type = normalizeIfcType(ifcType);
  const hasIfc = src != null && !isDefaultGrayColor(src.r, src.g, src.b, src.a);
  const out = color.clone();

  switch (mode) {
    case "ifc_only":
      if (hasIfc && src) {
        out.setRGB(src.r / 255, src.g / 255, src.b / 255, THREE.SRGBColorSpace);
      } else {
        out.set(UI.disabled);
      }
      break;
    case "discipline":
      out.copy(disciplineColor(type));
      break;
    case "type_palette":
      out.copy(fallbackColorForType(type));
      break;
    case "monochrome": {
      const hsl = { h: 0, s: 0, l: 0 };
      (hasIfc && src
        ? out.setRGB(src.r / 255, src.g / 255, src.b / 255, THREE.SRGBColorSpace)
        : out.copy(fallbackColorForType(type))
      ).getHSL(hsl);
      out.setHSL(hsl.h, 0, hsl.l);
      break;
    }
    case "high_contrast":
      out.copy(disciplineColor(type));
      out.multiplyScalar(1.12);
      break;
    case "soft_pastel":
      if (hasIfc && src) {
        out.setRGB(src.r / 255, src.g / 255, src.b / 255, THREE.SRGBColorSpace);
      } else {
        out.copy(fallbackColorForType(type));
      }
      {
        const hsl = { h: 0, s: 0, l: 0 };
        out.getHSL(hsl);
        // Keep form readable on the dark cinematic stage — muted, not washed out.
        out.setHSL(hsl.h, hsl.s * 0.55, Math.min(0.72, Math.max(0.28, hsl.l * 0.92 + 0.02)));
      }
      break;
    case "technical": {
      const disc = disciplineForIfcType(type);
      if (disc === "Mechanical" || disc === "Electrical" || disc === "MEP") {
        out.copy(disciplineColor(type));
      } else {
        out.set(M.ceiling);
      }
      break;
    }
    default:
      if (hasIfc && src) {
        out.setRGB(src.r / 255, src.g / 255, src.b / 255, THREE.SRGBColorSpace);
      } else {
        out.copy(fallbackColorForType(type));
      }
      break;
  }
  return out;
}

function spaceColorFromStorey(storey: string | null): THREE.Color {
  const hue = storeyHueOffset(storey) / 360;
  const c = new THREE.Color();
  c.setHSL(hue, 0.32, 0.52);
  return c;
}
// fallow-ignore-next-line complexity
function fallbackColorForType(ifcType: string): THREE.Color {
  const key = normalizeIfcType(ifcType);
  const mapped = IFC_TYPE_COLORS[key];
  if (mapped) return new THREE.Color(mapped);

  const n = key.toLowerCase();
  if (/sprinkler|fire|alarm|protective|extinguish/.test(n)) return new THREE.Color(MEP.fire);
  if (/communicat|data|telecom|network|audiovisual|sensor/.test(n)) {
    return new THREE.Color(MEP.communication);
  }
  if (/duct|hvac|air.?terminal|fan|chiller|boiler/.test(n)) return new THREE.Color(MEP.hvac);
  if (/pipe|plumb|sanitary|drain|sewer|valve|pump/.test(n)) return new THREE.Color(MEP.plumbing);
  if (/electric|cable|conduit|light|lamp|switch|outlet/.test(n)) {
    return new THREE.Color(MEP.electrical);
  }

  const hex = DISCIPLINE_COLORS[disciplineForIfcType(key)] ?? DISCIPLINE_COLORS.Other;
  return new THREE.Color(hex);
}

/** Storey name → stable hue shift for space differentiation. */
function storeyHueOffset(storey: string | null | undefined): number {
  if (!storey) return 0;
  let hash = 0;
  for (let i = 0; i < storey.length; i++) hash = (hash * 31 + storey.charCodeAt(i)) | 0;
  return ((hash % 360) + 360) % 360;
}

function pbr(
  roughness: number,
  metalness: number,
  envMapIntensity: number,
  surfaceKind: BimSurfaceKind,
  clearcoat = 0,
  clearcoatRoughness = 0.35,
): BimPbrParams {
  return { roughness, metalness, envMapIntensity, clearcoat, clearcoatRoughness, surfaceKind };
}

// fallow-ignore-next-line complexity
function derivePbrParams(ifcType: string, alpha: number, doubleSided: boolean): BimPbrParams {
  const t = normalizeIfcType(ifcType);
  const kind = surfaceKindFromIfcType(t);
  // Keep env/clearcoat low — strong IBL reads as white shine on BIM solids.
  if (isGlassType(t) || alpha < 180) {
    return pbr(0.18, 0, 0.35, "glass");
  }
  if (/column|beam|member|plate|reinfor|steel|metal/i.test(t)) {
    return pbr(0.45, 0.35, 0.4, "metal");
  }
  if (/pipe|duct|terminal|flow|fitting|cable|conduit|electric|light|lamp/i.test(t)) {
    return pbr(0.5, 0.22, 0.35, "metal");
  }
  if (/door|furnish/i.test(t)) {
    return pbr(0.68, 0.04, 0.28, "plastic");
  }
  if (/slab|wall|roof|stair|railing|covering|footing|foundation/i.test(t)) {
    return pbr(0.86, 0.01, 0.22, "concrete");
  }
  if (doubleSided) {
    return pbr(0.75, 0.03, 0.28, kind);
  }
  return pbr(0.78, 0.02, 0.25, kind);
}

/** Lift midtones / saturation so materials stay readable on the dark cinematic stage. */
function boostColorForVisibility(color: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const l = clamp01(0.22 + hsl.l * 0.78);
  const s = clamp01(hsl.s * 1.12 + (hsl.s > 0.04 ? 0.04 : 0));
  color.setHSL(hsl.h, s, l);
  return color;
}

export function fallbackColorHexForType(ifcType: string): string {
  return `#${fallbackColorForType(ifcType).getHexString()}`;
}

// fallow-ignore-next-line complexity
export function resolveSpaceColor(
  src: { r: number; g: number; b: number; a: number } | undefined,
  storey: string | null,
  fallbackHex: string,
  fallbackOpacity: number,
  options: BimMaterialColorOptions = {},
): BimResolvedColor {
  const mode = options.spaceDisplay ?? "ifc_storey";

  if (mode === "hidden") {
    return {
      color: new THREE.Color(fallbackHex),
      opacity: 0,
      transparent: true,
      depthWrite: false,
      renderTier: BimRenderTier.space,
      pbr: pbr(0.55, 0.02, 0.75, "default"),
    };
  }

  let base = new THREE.Color(fallbackHex);
  const hasIfc = src != null && !isDefaultGrayColor(src.r, src.g, src.b, src.a);

  if (mode === "uniform_blue") {
    base.set(fallbackHex);
  } else if (mode === "by_storey") {
    base.copy(spaceColorFromStorey(storey));
  } else if (mode === "ifc_only") {
    if (hasIfc && src) {
      base.setRGB(src.r / 255, src.g / 255, src.b / 255, THREE.SRGBColorSpace);
    } else {
      base.set(fallbackHex);
    }
  } else if (hasIfc && src) {
    base.setRGB(src.r / 255, src.g / 255, src.b / 255, THREE.SRGBColorSpace);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    hsl.h = (hsl.h + storeyHueOffset(storey) / 360) % 1;
    hsl.s = clamp01(Math.max(hsl.s, 0.35));
    hsl.l = clamp01(Math.min(Math.max(hsl.l, 0.45), 0.62));
    base.setHSL(hsl.h, hsl.s, hsl.l);
  } else {
    base.copy(spaceColorFromStorey(storey));
    base.lerp(new THREE.Color(fallbackHex), 0.35);
  }

  let opacity = fallbackOpacity;
  if (mode === "subtle") opacity = IX.nonSelectedOpacity;
  else if (mode === "vivid") opacity = 0.38;
  else if (mode === "outline") opacity = IX.hiddenOpacity;
  else if (src && src.a < 255) opacity = clamp01(src.a / 255) * 0.85;

  return {
    color: base,
    opacity,
    transparent: opacity > 0,
    depthWrite: false,
    renderTier: BimRenderTier.space,
    pbr: pbr(0.6, 0.02, 0.7, "default"),
  };
}

// fallow-ignore-next-line complexity
export function resolveElementColor(
  ifcType: string,
  src: { r: number; g: number; b: number; a: number; renderedFaces?: number } | undefined,
  options: BimMaterialColorOptions = {},
): BimResolvedColor {
  const type = normalizeIfcType(ifcType);
  const alpha = src?.a ?? 255;
  const doubleSided = src?.renderedFaces === 1;
  const pbr = derivePbrParams(type, alpha, doubleSided);
  const mode = options.colorMode ?? "ifc_priority";

  const color = boostColorForVisibility(applyColorMode(new THREE.Color(), type, src, mode));

  const opacity = clamp01(alpha / 255);
  const transparent = opacity < 0.995 || isGlassType(type);
  let renderTier: number = BimRenderTier.opaqueDefault;
  if (isGlassType(type)) renderTier = BimRenderTier.glass;
  else if (transparent) renderTier = BimRenderTier.semiTransparent;
  else if (isStructureType(type)) renderTier = BimRenderTier.opaqueStructure;

  return {
    color,
    opacity: isGlassType(type) ? Math.min(opacity, M.glassOpacity) : opacity,
    transparent,
    depthWrite: !transparent || isStructureType(type),
    renderTier,
    pbr,
  };
}

/** Apply resolved color/PBR onto a Fragments-safe MeshStandardMaterial. */
// fallow-ignore-next-line complexity
function applyResolvedPbr(
  mat: THREE.MeshStandardMaterial,
  resolved: BimResolvedColor,
  spaceDisplay?: BimSpaceDisplayMode,
): void {
  mat.color.copy(resolved.color);
  mat.opacity = resolved.opacity;
  mat.transparent = resolved.transparent;
  mat.depthWrite = resolved.depthWrite;
  mat.visible = resolved.opacity > 0;
  mat.roughness = resolved.pbr.roughness;
  mat.metalness = resolved.pbr.metalness;
  mat.envMapIntensity = resolved.pbr.envMapIntensity;
  mat.side = THREE.DoubleSide;
  mat.fog = true;
  mat.flatShading = false;
  mat.userData.renderTier = resolved.renderTier;
  mat.metalnessMap = null;
  mat.map = null;
  applyBimSurfaceMaps(mat, resolved.pbr.surfaceKind);

  const isSpace = resolved.renderTier === BimRenderTier.space;
  if (isSpace && spaceDisplay === "outline") {
    mat.emissive.set(STATUS.primary);
    mat.emissiveIntensity = 0.35;
  } else if (isSpace) {
    mat.emissive.set(STATUS.information);
    mat.emissiveIntensity = 0.1;
  } else if (resolved.renderTier === BimRenderTier.glass) {
    mat.emissive.copy(resolved.color).multiplyScalar(0.04);
    mat.emissiveIntensity = 1;
  } else {
    mat.emissive.copy(resolved.color).multiplyScalar(0.035);
    mat.emissiveIntensity = 0.85;
  }

  mat.needsUpdate = true;
}

// fallow-ignore-next-line complexity
export function upgradeLambertToStandard(
  lambert: THREE.MeshLambertMaterial,
  resolved: BimResolvedColor,
  spaceDisplay?: BimSpaceDisplayMode,
): THREE.MeshStandardMaterial {
  const standard = new THREE.MeshStandardMaterial();

  standard.side = lambert.side;
  standard.polygonOffset = lambert.polygonOffset;
  standard.polygonOffsetFactor = lambert.polygonOffsetFactor;
  standard.polygonOffsetUnits = lambert.polygonOffsetUnits;
  standard.userData = {
    ...lambert.userData,
    renderTier: resolved.renderTier,
    upgradedFromLambert: true,
  };
  applyResolvedPbr(standard, resolved, spaceDisplay);
  return standard;
}

export type MaterialItemContext = {
  materialLocalId: number;
  itemLocalIds: number[];
  dominantType: string;
  isSpace: boolean;
  storey: string | null;
};

// fallow-ignore-next-line complexity
export async function buildMaterialItemContext(
  model: FRAGS.FragmentsModel,
  storeyByLocalId: Map<number, string>,
): Promise<Map<number, MaterialItemContext>> {
  const materialToItems = new Map<number, Set<number>>();
  const itemTypes = new Map<number, string>();
  const spaceItemIds = await buildSpaceItemIds(model);
  for (const id of spaceItemIds) {
    itemTypes.set(id, "IfcSpace");
  }

  try {
    const samples = await model.getSamples();
    for (const sample of samples.values()) {
      let set = materialToItems.get(sample.material);
      if (!set) {
        set = new Set();
        materialToItems.set(sample.material, set);
      }
      set.add(sample.item);
    }
  } catch {
    return new Map();
  }

  const allItemIds = [...new Set([...materialToItems.values()].flatMap((s) => [...s]))];
  const chunkSize = 400;
  for (let i = 0; i < allItemIds.length; i += chunkSize) {
    const chunk = allItemIds.slice(i, i + chunkSize);
    try {
      const rows = await model.getItemsData(chunk, {
        attributesDefault: true,
        relationsDefault: { attributes: false, relations: false },
      });
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        const id = chunk[j];
        if (!row || id == null) continue;
        const cat = row._category;
        const type =
          cat && !Array.isArray(cat) && "value" in cat
            ? String((cat as FRAGS.ItemAttribute).value ?? "IfcProduct")
            : "IfcProduct";
        itemTypes.set(id, normalizeIfcType(type));
      }
    } catch {
      /* optional */
    }
  }

  const out = new Map<number, MaterialItemContext>();
  for (const [materialLocalId, itemSet] of materialToItems) {
    const itemLocalIds = [...itemSet];
    const typeCounts = new Map<string, number>();
    for (const itemId of itemLocalIds) {
      const t = itemTypes.get(itemId) ?? "IfcProduct";
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    let dominantType = "IfcProduct";
    let max = 0;
    for (const [t, c] of typeCounts) {
      if (c > max) {
        max = c;
        dominantType = t;
      }
    }
    const isSpace = itemLocalIds.some(
      (id) => spaceItemIds.has(id) || isSpaceType(itemTypes.get(id) ?? ""),
    );
    let storey: string | null = null;
    for (const itemId of itemLocalIds) {
      const s = storeyByLocalId.get(itemId);
      if (s) {
        storey = s;
        break;
      }
    }
    out.set(materialLocalId, {
      materialLocalId,
      itemLocalIds,
      dominantType,
      isSpace,
      storey,
    });
  }
  return out;
}

export function applyRenderOrderToModel(model: FRAGS.FragmentsModel): void {
  // fallow-ignore-next-line complexity
  model.object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    let tier: number = BimRenderTier.opaqueDefault;
    for (const m of mats) {
      const t = (m as THREE.Material).userData?.renderTier;
      if (typeof t === "number" && t > tier) tier = t;
    }
    child.renderOrder = tier;
  });
}

export function replaceMaterialReferences(
  root: THREE.Object3D,
  from: THREE.Material,
  to: THREE.Material,
): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => (m === from ? to : m));
    } else if (child.material === from) {
      child.material = to;
    }
  });
}

function meshItemLocalIds(mesh: THREE.Mesh): number[] {
  const raw = mesh.userData?.itemIds as Set<number> | number[] | undefined;
  if (!raw) return [];
  return raw instanceof Set ? [...raw] : [...raw];
}

/** Apply space styling to tile meshes tagged with IfcSpace item IDs. */
export function applySpaceDisplayToModelMeshes(
  model: FRAGS.FragmentsModel,
  spaceItemIds: Set<number>,
  resolveSpace: (storey: string | null) => BimResolvedColor,
  storeyByItemId: Map<number, string>,
  applyMaterial: (
    material: THREE.Material,
    resolved: BimResolvedColor,
    storey: string | null,
  ) => THREE.Material | void,
): void {
  if (spaceItemIds.size === 0) return;

  // fallow-ignore-next-line complexity
  model.object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const itemIds = meshItemLocalIds(child);
    if (!itemIds.some((id) => spaceItemIds.has(id))) return;

    let storey: string | null = null;
    for (const id of itemIds) {
      const name = storeyByItemId.get(id);
      if (name) {
        storey = name;
        break;
      }
    }
    const resolved = resolveSpace(storey);
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i];
      if (!mat || ("isLodMaterial" in mat && mat.isLodMaterial)) continue;
      const next = applyMaterial(mat, resolved, storey);
      if (next && next !== mat) {
        if (Array.isArray(child.material)) child.material[i] = next;
        else child.material = next;
      }
    }
  });
}
