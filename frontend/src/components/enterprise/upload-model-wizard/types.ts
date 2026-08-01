export type IfcClientAnalysis = {
  schema: string | null;
  projectName: string | null;
  buildingName: string | null;
  storeyCount: number | null;
  elementCountEstimate: number | null;
  disciplines: string[];
  units: string | null;
  hasMaterials: boolean | null;
  duplicateGuidSamples: number;
  fileSizeBytes: number;
  estimatedGpuMb: number | null;
  warnings: string[];
};
