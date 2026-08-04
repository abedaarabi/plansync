import type * as FRAGS from "@thatopen/fragments";

type IfcImporterLike = Pick<FRAGS.IfcImporter, "geometryProcessSettings" | "doubleSidedMaterials">;

/** High-detail IFC → Fragments (server conversion / full-fidelity path). */
export function configureLod500Importer(importer: IfcImporterLike): void {
  Object.assign(importer.geometryProcessSettings, {
    threshold: 10_000,
    precision: 1e8,
    normalPrecision: 1e9,
    planePrecision: 1e6,
    faceThreshold: 0.45,
    forceTransparentSpaces: true,
    processIfcRelSpaceBoundarySecondLevel: true,
  });
  importer.doubleSidedMaterials = true;
}

/**
 * Lower-memory emergency client fallback. Server still produces LOD500 later;
 * this only needs to render something without exhausting the browser tab.
 */
export function configureLiteFallbackImporter(importer: IfcImporterLike): void {
  Object.assign(importer.geometryProcessSettings, {
    threshold: 1_000,
    precision: 1e6,
    normalPrecision: 1e7,
    planePrecision: 1e5,
    faceThreshold: 0.35,
    forceTransparentSpaces: false,
    processIfcRelSpaceBoundarySecondLevel: false,
  });
  importer.doubleSidedMaterials = false;
}
