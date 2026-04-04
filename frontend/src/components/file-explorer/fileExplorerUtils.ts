import type { CloudFile, FileVersion, Folder, Project } from "@/types/projects";
import { isPdfFile } from "@/lib/isPdfFile";

export function formatBytes(n: string | number | bigint): string {
  const v = typeof n === "bigint" ? Number(n) : Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} MB`;
  return `${(v / 1024 ** 3).toFixed(2)} GB`;
}

export function folderBreadcrumb(folderId: string | null, folders: Folder[]): Folder[] {
  if (!folderId) return [];
  const map = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  let cur: string | null = folderId;
  while (cur) {
    const f = map.get(cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parentId;
  }
  return path;
}

export function sortedVersions(f: CloudFile): FileVersion[] {
  return [...f.versions].sort((a, b) => b.version - a.version);
}

export function formatItemDate(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

/** Date + time or em dash when missing */
export function formatItemDateOrDash(iso?: string | null): string {
  if (iso == null || iso === "") return "—";
  return formatItemDate(iso);
}

/** Direct files + subfolders in this folder (for “N items” hints). */
export function countDirectChildren(
  project: Project,
  folderId: string | null,
): { folders: number; files: number; total: number } {
  const folders = project.folders.filter((f) => f.parentId === folderId).length;
  const files = project.files.filter((f) => f.folderId === folderId).length;
  return { folders, files, total: folders + files };
}

export function filterByName<T extends { name: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.name.toLowerCase().includes(q));
}

/** Grid title: hide “.pdf” for drawings; keep full name for other types. */
export function fileExplorerDisplayName(file: { name: string; mimeType: string }): string {
  if (isPdfFile(file)) return file.name.replace(/\.pdf$/i, "");
  return file.name;
}
