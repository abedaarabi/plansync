export type {
  BimElementQuantities,
  BimLoqReport,
  BimQuantityEntry,
  BimQuantityIndex,
} from "@plansync/shared/bimTypes";

export type BimConversionStatus = {
  fileVersionId: string;
  conversionStatus: string;
  fragmentsReady: boolean;
  quantityIndexSummaryReady: boolean;
  quantityIndexReady: boolean;
  partial: boolean;
  indexProgress: number | null;
  indexPhase: "summary" | "full" | null;
  loq: import("@plansync/shared/bimTypes").BimLoqReport | null;
  jobRunId: string | null;
  bimPublishedAt: string | null;
  levelCount: number;
  mappedSheetCount: number;
};

export type BimSavedViewRecord = {
  id: string;
  name: string;
  cameraJson: Record<string, unknown>;
  filtersJson?: Record<string, unknown> | null;
  hiddenGuids?: string[] | null;
  isolatedGuids?: string[] | null;
  updatedAt: string;
};
