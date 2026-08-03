import { describe, expect, it } from "vitest";
import type { Folder } from "@/types/projects";
import { folderSubtreeIds, isInFolderSubtree } from "@/lib/folderSubtree";

const folders: Folder[] = [
  {
    id: "a",
    name: "A",
    parentId: null,
    projectId: "p1",
  },
  {
    id: "b",
    name: "B",
    parentId: "a",
    projectId: "p1",
  },
  {
    id: "c",
    name: "C",
    parentId: "b",
    projectId: "p1",
  },
  {
    id: "d",
    name: "D",
    parentId: null,
    projectId: "p1",
  },
];

describe("folderSubtreeIds", () => {
  it("returns null for project root (whole tree)", () => {
    expect(folderSubtreeIds(null, folders)).toBeNull();
  });

  it("includes the folder and nested descendants", () => {
    expect([...folderSubtreeIds("a", folders)!].sort()).toEqual(["a", "b", "c"]);
    expect([...folderSubtreeIds("b", folders)!].sort()).toEqual(["b", "c"]);
  });
});

describe("isInFolderSubtree", () => {
  it("matches whole project when subtree is null", () => {
    expect(isInFolderSubtree(null, null)).toBe(true);
    expect(isInFolderSubtree("a", null)).toBe(true);
  });

  it("matches nested locations under a folder", () => {
    const subtree = folderSubtreeIds("a", folders);
    expect(isInFolderSubtree("c", subtree)).toBe(true);
    expect(isInFolderSubtree("d", subtree)).toBe(false);
    expect(isInFolderSubtree(null, subtree)).toBe(false);
  });
});
