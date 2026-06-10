import type { CloudFile, Project } from "@/types/projects";
import { folderPathLabel } from "@/lib/folderPathLabel";

export type SheetPickRow = {
  file: CloudFile;
  version: { id: string; version: number };
  group: string;
};

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
