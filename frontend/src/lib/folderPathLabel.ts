import type { Folder } from "@/types/projects";

function folderPathSegments(folders: Folder[], folderId: string | null): string[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const segments: string[] = [];
  let cur: string | null = folderId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const row = byId.get(cur);
    if (!row) break;
    segments.unshift(row.name);
    cur = row.parentId;
  }
  return segments;
}

/** Human-readable folder path for file pickers (e.g. "Drawings / Level 1"). */
export function folderPathLabel(folders: Folder[], folderId: string | null): string {
  const segments = folderPathSegments(folders, folderId);
  return segments.length ? segments.join(" / ") : "Project root";
}
