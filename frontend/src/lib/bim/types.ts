/** BIM quantity index types (mirrors backend). */
export type BimLodFlags = {
  identity: boolean;
  dimensions: boolean;
  quantities: boolean;
  material: boolean;
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

export type BimQuantityIndex = {
  version: 1;
  fileVersionId: string;
  generatedAt: string;
  loq: BimLoqReport;
  elements: BimQuantityEntry[];
  byType: Record<string, BimTypeAggregate>;
  byLevel: Record<string, { level: string; count: number; guids: string[] }>;
};

export type BimConversionStatus = {
  fileVersionId: string;
  conversionStatus: string;
  fragmentsReady: boolean;
  quantityIndexReady: boolean;
  loq: BimLoqReport | null;
  jobRunId: string | null;
};

export type BimSavedViewRecord = {
  id: string;
  name: string;
  cameraJson: Record<string, unknown>;
  filtersJson?: Record<string, unknown> | null;
  hiddenGuids?: string[] | null;
  isolatedGuids?: string[] | null;
};
