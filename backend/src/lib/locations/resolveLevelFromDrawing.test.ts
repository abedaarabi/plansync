import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstLevel = vi.hoisted(() => vi.fn());
const findFirstMap = vi.hoisted(() => vi.fn());
const findManyMaps = vi.hoisted(() => vi.fn());

vi.mock("../prisma.js", () => ({
  prisma: {
    bimModelLevel: {
      findFirst: (...args: unknown[]) => findFirstLevel(...args),
    },
    drawingLevelMap: {
      findFirst: (...args: unknown[]) => findFirstMap(...args),
      findMany: (...args: unknown[]) => findManyMaps(...args),
    },
  },
}));

import {
  resolveLevelForCreate,
  resolveLevelIdFromDrawing,
  resolveLevelIdFromStoreyName,
} from "./resolveLevelFromDrawing.js";

describe("resolveLevelIdFromDrawing", () => {
  beforeEach(() => {
    findFirstLevel.mockReset();
    findFirstMap.mockReset();
    findManyMaps.mockReset();
  });

  it("returns null without file or explicit level", async () => {
    await expect(resolveLevelIdFromDrawing({ projectId: "p1" })).resolves.toBeNull();
    expect(findFirstLevel).not.toHaveBeenCalled();
    expect(findManyMaps).not.toHaveBeenCalled();
  });

  it("prefers explicit levelId in the same project", async () => {
    findFirstLevel.mockResolvedValue({ id: "lvl_1", displayName: "Level 1" });

    await expect(
      resolveLevelIdFromDrawing({
        projectId: "p1",
        fileId: "pdf_1",
        explicitLevelId: "lvl_1",
      }),
    ).resolves.toEqual({ levelId: "lvl_1", levelName: "Level 1" });

    expect(findFirstLevel).toHaveBeenCalledWith({
      where: { id: "lvl_1", projectId: "p1" },
      select: { id: true, displayName: true },
    });
    expect(findManyMaps).not.toHaveBeenCalled();
  });

  it("returns null when explicit level is missing", async () => {
    findFirstLevel.mockResolvedValue(null);
    await expect(
      resolveLevelIdFromDrawing({
        projectId: "p1",
        explicitLevelId: "missing",
      }),
    ).resolves.toBeNull();
  });

  it("resolves by page number (1-based → pageIndex)", async () => {
    findFirstMap.mockResolvedValue({
      bimModelLevel: { id: "lvl_2", displayName: "L2" },
    });

    await expect(
      resolveLevelIdFromDrawing({
        projectId: "p1",
        fileId: "pdf_1",
        pageNumber: 2,
      }),
    ).resolves.toEqual({ levelId: "lvl_2", levelName: "L2" });

    expect(findFirstMap).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "p1", pdfFileId: "pdf_1", pageIndex: 1 },
      }),
    );
  });

  it("falls back to a single whole-file map (pageIndex 0)", async () => {
    findManyMaps.mockResolvedValue([
      {
        pageIndex: 0,
        bimModelLevel: { id: "lvl_g", displayName: "Ground" },
      },
    ]);

    await expect(resolveLevelIdFromDrawing({ projectId: "p1", fileId: "pdf_1" })).resolves.toEqual({
      levelId: "lvl_g",
      levelName: "Ground",
    });
  });

  it("does not guess when multiple page maps exist without a page", async () => {
    findManyMaps.mockResolvedValue([
      {
        pageIndex: 1,
        bimModelLevel: { id: "lvl_a", displayName: "A" },
      },
      {
        pageIndex: 2,
        bimModelLevel: { id: "lvl_b", displayName: "B" },
      },
    ]);

    await expect(
      resolveLevelIdFromDrawing({ projectId: "p1", fileId: "pdf_1" }),
    ).resolves.toBeNull();
  });

  it("uses the first map when it is pageIndex 0 even if another exists", async () => {
    findManyMaps.mockResolvedValue([
      {
        pageIndex: 0,
        bimModelLevel: { id: "lvl_all", displayName: "All" },
      },
      {
        pageIndex: 1,
        bimModelLevel: { id: "lvl_p1", displayName: "P1" },
      },
    ]);

    await expect(
      resolveLevelIdFromDrawing({ projectId: "p1", fileId: "  pdf_1  " }),
    ).resolves.toEqual({ levelId: "lvl_all", levelName: "All" });
  });
});

describe("resolveLevelIdFromStoreyName", () => {
  beforeEach(() => {
    findFirstLevel.mockReset();
  });

  it("returns null for blank storey names", async () => {
    await expect(
      resolveLevelIdFromStoreyName({ projectId: "p1", storeyName: "  " }),
    ).resolves.toBeNull();
    expect(findFirstLevel).not.toHaveBeenCalled();
  });

  it("matches source or display name case-insensitively", async () => {
    findFirstLevel.mockResolvedValue({ id: "lvl_1", displayName: "Level 1" });

    await expect(
      resolveLevelIdFromStoreyName({
        projectId: "p1",
        storeyName: "LEVEL 1",
        buildingId: "b1",
      }),
    ).resolves.toEqual({ levelId: "lvl_1", levelName: "Level 1" });

    expect(findFirstLevel).toHaveBeenCalledWith({
      where: {
        projectId: "p1",
        buildingId: "b1",
        OR: [
          { sourceName: { equals: "LEVEL 1", mode: "insensitive" } },
          { displayName: { equals: "LEVEL 1", mode: "insensitive" } },
        ],
      },
      select: { id: true, displayName: true },
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("resolveLevelForCreate", () => {
  beforeEach(() => {
    findFirstLevel.mockReset();
    findFirstMap.mockReset();
    findManyMaps.mockReset();
  });

  it("clears when explicitLevelId is null", async () => {
    await expect(
      resolveLevelForCreate({ projectId: "p1", explicitLevelId: null, fileId: "pdf_1" }),
    ).resolves.toEqual({ level: null });
    expect(findManyMaps).not.toHaveBeenCalled();
  });

  it("errors when an explicit level is missing", async () => {
    findFirstLevel.mockResolvedValue(null);
    await expect(
      resolveLevelForCreate({ projectId: "p1", explicitLevelId: "missing" }),
    ).resolves.toEqual({
      level: null,
      error: "Level not found in this project",
    });
  });

  it("falls back to BIM storey name when drawing has no map", async () => {
    findManyMaps.mockResolvedValue([]);
    findFirstLevel.mockResolvedValue({ id: "lvl_s", displayName: "Storey A" });

    await expect(
      resolveLevelForCreate({
        projectId: "p1",
        fileId: "pdf_1",
        bimStoreyName: "Storey A",
      }),
    ).resolves.toEqual({
      level: { levelId: "lvl_s", levelName: "Storey A" },
    });
  });
});
