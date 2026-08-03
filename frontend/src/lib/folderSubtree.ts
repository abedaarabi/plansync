import type { Folder } from "@/types/projects";

/**
 * Folder id plus all nested folder ids.
 * When `rootId` is null (project root), returns `null` meaning the whole tree.
 */
export function folderSubtreeIds(rootId: string | null, folders: Folder[]): Set<string> | null {
  if (rootId == null) return null;
  const ids = new Set<string>();
  const walk = (id: string) => {
    ids.add(id);
    for (const f of folders) {
      if (f.parentId === id) walk(f.id);
    }
  };
  walk(rootId);
  return ids;
}

/** True when a file/folder location is inside `subtree` (or anywhere if subtree is null). */
export function isInFolderSubtree(
  locationFolderId: string | null,
  subtree: Set<string> | null,
): boolean {
  if (subtree == null) return true;
  if (locationFolderId == null) return false;
  return subtree.has(locationFolderId);
}
