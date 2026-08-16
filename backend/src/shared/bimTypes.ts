/** Shared BIM quantity index types (API + viewer). */
export type BimLodFlags = {
  identity: boolean;
  dimensions: boolean;
  quantities: boolean;
  material: boolean;
  /** True when IFC carries authored surface / style color (not default gray). */
  color: boolean;
};

export type BimElementQuantities = {
  length?: number;
  area?: number;
  volume?: number;
  count?: number;
  weight?: number;
};

export type BimQuantityEntry = {
  expressId: number;
  guid: string;
  ifcType: string;
  name: string | null;
  /**
   * IFC type-object name from IfcRelDefinesByType → RelatingType.Name
   * (e.g. Revit type / family type). Null when the export has no type relation.
   * Absent on legacy indexes until rebuild.
   */
  typeName?: string | null;
  level: string | null;
  material: string | null;
  discipline: string | null;
  /** Authored IFC surface color (#rrggbb), when present in export. */
  surfaceColor?: string | null;
  quantities: BimElementQuantities;
  quantitySource: "base" | "qto" | "computed" | "missing";
  lodFlags: BimLodFlags;
  /** Federated viewer — source model when indices are merged. */
  sourceFileVersionId?: string;
  sourceModelId?: string;
  sourceLabel?: string;
};

export type BimLoqReport = {
  totalElements: number;
  withIdentity: number;
  withLevel: number;
  withMaterial: number;
  withQuantities: number;
  withAuthoredColor: number;
  pctQuantities: number;
  pctMaterial: number;
  pctLevel: number;
  pctIdentity: number;
  pctAuthoredColor: number;
  recommendedExportHints: string[];
};

export type BimTypeAggregate = {
  ifcType: string;
  count: number;
  guids: string[];
  totalLength?: number;
  totalArea?: number;
  totalVolume?: number;
};

export type BimLevelAggregate = {
  level: string;
  count: number;
  guids: string[];
};

/** IFC type-object name (Revit type / family type) rollup. */
export type BimTypeNameAggregate = {
  typeName: string;
  count: number;
  guids: string[];
};

export type BimQuantityIndex = {
  version: 1;
  fileVersionId: string;
  generatedAt: string;
  loq: BimLoqReport;
  elements: BimQuantityEntry[];
  byType: Record<string, BimTypeAggregate>;
  byLevel: Record<string, BimLevelAggregate>;
  /** Present on indexes built after type-name extraction; absent on legacy caches. */
  byTypeName?: Record<string, BimTypeNameAggregate>;
  /** Fast pass — byType/byLevel only; elements may be empty. */
  partial?: boolean;
};
