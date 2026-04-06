export type FileVersion = {
  id: string;
  version: number;
  sizeBytes: string | number | bigint;
  s3Key: string;
  /** When this revision was uploaded */
  createdAt?: string;
};

export type CloudFile = {
  id: string;
  name: string;
  mimeType: string;
  folderId: string | null;
  /** When the file record was first created */
  createdAt?: string;
  updatedAt?: string;
  /** Last time opened in the viewer (from server) */
  lastOpenedAt?: string | null;
  versions: FileVersion[];
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  projectId: string;
  /** When the folder was created */
  createdAt?: string;
  updatedAt?: string;
};

import type { ProjectStageValue } from "@/lib/projectStage";
import type { ProjectCurrencyCode } from "@/lib/projectCurrency";
import type { ProjectMeasurementSystem } from "@/lib/projectMeasurement";

export type Project = {
  id: string;
  name: string;
  /** ISO 4217 — budget and cost display */
  currency?: ProjectCurrencyCode | string;
  /** Metric vs imperial for measurements and takeoff defaults */
  measurementSystem?: ProjectMeasurementSystem | string;
  /** Lifecycle stage (planning → construction → completed, etc.) */
  stage?: ProjectStageValue | string;
  /** Manual overall completion 0–100 */
  progressPercent?: number;
  /** Job / contract reference */
  projectNumber?: string | null;
  /** Budget in local currency (API returns decimal string) */
  localBudget?: string | null;
  /** e.g. sq ft, scope */
  projectSize?: string | null;
  /** e.g. Commercial, Residential */
  projectType?: string | null;
  location?: string | null;
  /** WGS84 map pin (both set or both absent). */
  latitude?: number | null;
  longitude?: number | null;
  /** Normalized project / client website */
  websiteUrl?: string | null;
  /** Favicon URL for display (derived from website hostname) */
  logoUrl?: string | null;
  /** ISO datetime string */
  startDate?: string | null;
  /** ISO datetime string */
  endDate?: string | null;
  folders: Folder[];
  files: CloudFile[];
};
