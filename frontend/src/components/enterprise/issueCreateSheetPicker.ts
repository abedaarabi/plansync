import type { CloudFile, Folder, Project } from "@/types/projects";

export type SheetPickRow = {
  file: CloudFile;
  version: { id: string; version: number };
  group: string;
};

function folderPathLabel(folders: Folder[], folderId: string | null): string {
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
  return segments.length ? segments.join(" / ") : "Project root";
}

export function sheetRowsForProject(project: Project): SheetPickRow[] {
  const out: SheetPickRow[] = [];
  for (const f of project.files) {
    const group = folderPathLabel(project.folders, f.folderId);
    for (const v of f.versions) {
      out.push({ file: f, version: { id: v.id, version: v.version }, group });
    }
  }
  return out.sort((a, b) => {
    const g = a.group.localeCompare(b.group);
    if (g !== 0) return g;
    const n = a.file.name.localeCompare(b.file.name);
    if (n !== 0) return n;
    return b.version.version - a.version.version;
  });
}

export function groupSheetRows(rows: SheetPickRow[]): { group: string; items: SheetPickRow[] }[] {
  const map = new Map<string, SheetPickRow[]>();
  for (const r of rows) {
    const arr = map.get(r.group) ?? [];
    arr.push(r);
    map.set(r.group, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({ group, items }));
}
