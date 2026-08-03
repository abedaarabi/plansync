/** Pure aggregations behind the Files & Drawings overview (no React, no fetches). */

import type { CloudFile, Project } from "@/types/projects";
import { isIfcFile, isImageThumbnailFile, isPdfFile } from "@/lib/isPdfFile";

export type FilesCountSegment = {
  key: string;
  label: string;
  count: number;
  fill: string;
};

export type FilesOverviewFilter =
  | "ALL"
  | "PDF"
  | "IFC"
  | "IMAGE"
  | "OTHER"
  | "MULTI_VERSION"
  | "WITH_COMMENTS"
  | "BIM_PUBLISHED"
  | `DISC:${string}`;

export type FilesOverviewStats = {
  totalFiles: number;
  folders: number;
  pdfs: number;
  ifcs: number;
  images: number;
  other: number;
  multiVersion: number;
  withComments: number;
  bimPublished: number;
  /** Sum of all revision sizes in this project (bytes). */
  totalBytes: number;
  kindSegments: FilesCountSegment[];
  disciplineSegments: FilesCountSegment[];
};

const KIND_FILL = {
  PDF: "#2563eb",
  IFC: "#0d9488",
  IMAGE: "#d97706",
  OTHER: "#94a3b8",
} as const;

const DISC_FILLS = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#0891b2", "#d97706", "#64748b"];
const TOP_DISCIPLINES = 6;

function fileKind(f: CloudFile): "PDF" | "IFC" | "IMAGE" | "OTHER" {
  if (isPdfFile(f)) return "PDF";
  if (isIfcFile(f)) return "IFC";
  if (isImageThumbnailFile(f)) return "IMAGE";
  return "OTHER";
}

function hasBimPublished(f: CloudFile): boolean {
  return f.versions.some((v) => Boolean(v.bimPublishedAt));
}

function fileMatchesOverviewFilter(f: CloudFile, filter: FilesOverviewFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "PDF") return isPdfFile(f);
  if (filter === "IFC") return isIfcFile(f);
  if (filter === "IMAGE") return isImageThumbnailFile(f);
  if (filter === "OTHER") return fileKind(f) === "OTHER";
  if (filter === "MULTI_VERSION") return f.versions.length > 1;
  if (filter === "WITH_COMMENTS") return (f.commentCount ?? 0) > 0;
  if (filter === "BIM_PUBLISHED") return hasBimPublished(f);
  if (filter.startsWith("DISC:")) {
    const d = filter.slice(5);
    return (f.disciplines ?? []).some((x) => x === d);
  }
  return true;
}

export function filterProjectFiles(files: CloudFile[], filter: FilesOverviewFilter): CloudFile[] {
  if (filter === "ALL") return files;
  return files.filter((f) => fileMatchesOverviewFilter(f, filter));
}

function versionBytes(v: { sizeBytes: string | number | bigint }): number {
  const n = typeof v.sizeBytes === "bigint" ? Number(v.sizeBytes) : Number(v.sizeBytes);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// fallow-ignore-next-line complexity
export function computeFilesOverview(
  project: Pick<Project, "files" | "folders">,
): FilesOverviewStats {
  const files = project.files;
  const folders = project.folders;
  let pdfs = 0;
  let ifcs = 0;
  let images = 0;
  let other = 0;
  let multiVersion = 0;
  let withComments = 0;
  let bimPublished = 0;
  let totalBytes = 0;
  const discCounts = new Map<string, number>();

  for (const f of files) {
    const kind = fileKind(f);
    if (kind === "PDF") pdfs += 1;
    else if (kind === "IFC") ifcs += 1;
    else if (kind === "IMAGE") images += 1;
    else other += 1;
    if (f.versions.length > 1) multiVersion += 1;
    if ((f.commentCount ?? 0) > 0) withComments += 1;
    if (hasBimPublished(f)) bimPublished += 1;
    for (const v of f.versions) totalBytes += versionBytes(v);
    for (const d of f.disciplines ?? []) {
      const key = d.trim();
      if (!key) continue;
      discCounts.set(key, (discCounts.get(key) ?? 0) + 1);
    }
  }

  const kindSegments: FilesCountSegment[] = (
    [
      ["PDF", "PDFs", pdfs, KIND_FILL.PDF],
      ["IFC", "IFC / BIM", ifcs, KIND_FILL.IFC],
      ["IMAGE", "Images", images, KIND_FILL.IMAGE],
      ["OTHER", "Other", other, KIND_FILL.OTHER],
    ] as const
  )
    .filter(([, , count]) => count > 0)
    .map(([key, label, count, fill]) => ({ key, label, count, fill }));

  const sortedDisc = [...discCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const disciplineSegments: FilesCountSegment[] = [];
  let otherDisc = 0;
  sortedDisc.forEach(([label, count], i) => {
    if (i < TOP_DISCIPLINES) {
      disciplineSegments.push({
        key: `DISC:${label}`,
        label,
        count,
        fill: DISC_FILLS[i % DISC_FILLS.length]!,
      });
    } else {
      otherDisc += count;
    }
  });
  if (otherDisc > 0) {
    disciplineSegments.push({
      key: "DISC:__other__",
      label: "Other",
      count: otherDisc,
      fill: "#94a3b8",
    });
  }

  return {
    totalFiles: files.length,
    folders: folders.length,
    pdfs,
    ifcs,
    images,
    other,
    multiVersion,
    withComments,
    bimPublished,
    totalBytes,
    kindSegments,
    disciplineSegments,
  };
}

export function filesOverviewFilterLabel(filter: FilesOverviewFilter): string {
  if (filter === "ALL") return "All files";
  if (filter === "PDF") return "PDFs";
  if (filter === "IFC") return "IFC / BIM models";
  if (filter === "IMAGE") return "Images";
  if (filter === "OTHER") return "Other files";
  if (filter === "MULTI_VERSION") return "Multi-version files";
  if (filter === "WITH_COMMENTS") return "Files with comments";
  if (filter === "BIM_PUBLISHED") return "Published BIM models";
  if (filter.startsWith("DISC:")) {
    const d = filter.slice(5);
    return d === "__other__" ? "Other disciplines" : `Discipline: ${d}`;
  }
  return "Filtered files";
}
