import { beforeEach, describe, expect, it, vi } from "vitest";

const levelFindFirst = vi.hoisted(() => vi.fn());
const levelFindMany = vi.hoisted(() => vi.fn());
const fileFindFirst = vi.hoisted(() => vi.fn());
const mapFindFirst = vi.hoisted(() => vi.fn());
const mapCreate = vi.hoisted(() => vi.fn());

vi.mock("../prisma.js", () => ({
  prisma: {
    bimModelLevel: {
      findFirst: (...args: unknown[]) => levelFindFirst(...args),
      findMany: (...args: unknown[]) => levelFindMany(...args),
    },
    file: {
      findFirst: (...args: unknown[]) => fileFindFirst(...args),
    },
    drawingLevelMap: {
      findFirst: (...args: unknown[]) => mapFindFirst(...args),
      create: (...args: unknown[]) => mapCreate(...args),
    },
  },
}));

import { assignDrawingToLevel } from "./mappingService.js";

const level = {
  id: "lvl_1",
  projectId: "p1",
  buildingId: "b1",
};

const pdfFile = {
  id: "pdf_1",
  projectId: "p1",
  buildingId: "b1",
  versions: [{ id: "fv_pdf_1" }],
};

describe("assignDrawingToLevel", () => {
  beforeEach(() => {
    levelFindFirst.mockReset();
    levelFindMany.mockReset();
    fileFindFirst.mockReset();
    mapFindFirst.mockReset();
    mapCreate.mockReset();

    levelFindFirst.mockResolvedValue(level);
    fileFindFirst.mockResolvedValue(pdfFile);
    levelFindMany.mockResolvedValue([{ id: "lvl_1" }, { id: "lvl_2" }]);
    mapFindFirst.mockResolvedValue(null);
    mapCreate.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: "map_1",
      ...(data as object),
    }));
  });

  it("creates a PDF-only map with null IFC and pageIndex 0", async () => {
    const row = await assignDrawingToLevel({
      levelId: "lvl_1",
      fileAssetId: "pdf_1",
      projectId: "p1",
    });

    expect(mapCreate).toHaveBeenCalledWith({
      data: {
        projectId: "p1",
        ifcFileVersionId: null,
        bimModelLevelId: "lvl_1",
        pdfFileId: "pdf_1",
        pdfFileVersionId: "fv_pdf_1",
        pageIndex: 0,
      },
    });
    expect(row).toMatchObject({
      id: "map_1",
      ifcFileVersionId: null,
      pageIndex: 0,
    });
  });

  it("rejects when the drawing is already on this level", async () => {
    mapFindFirst.mockResolvedValueOnce({ id: "existing" });

    await expect(
      assignDrawingToLevel({
        levelId: "lvl_1",
        fileAssetId: "pdf_1",
        projectId: "p1",
      }),
    ).rejects.toThrow("Drawing already assigned to this level");
    expect(mapCreate).not.toHaveBeenCalled();
  });

  it("rejects when the drawing is on another level in the building", async () => {
    mapFindFirst
      .mockResolvedValueOnce(null) // alreadyOnLevel
      .mockResolvedValueOnce({ id: "other", bimModelLevelId: "lvl_2" });

    await expect(
      assignDrawingToLevel({
        levelId: "lvl_1",
        fileAssetId: "pdf_1",
        projectId: "p1",
      }),
    ).rejects.toThrow("Drawing is already assigned to another level in this building");
    expect(mapCreate).not.toHaveBeenCalled();
  });

  it("rejects PDF from a different building", async () => {
    fileFindFirst.mockResolvedValue({
      ...pdfFile,
      buildingId: "b_other",
    });

    await expect(
      assignDrawingToLevel({
        levelId: "lvl_1",
        fileAssetId: "pdf_1",
        projectId: "p1",
      }),
    ).rejects.toThrow("PDF belongs to a different building");
  });

  it("rejects missing level", async () => {
    levelFindFirst.mockResolvedValue(null);
    await expect(
      assignDrawingToLevel({
        levelId: "missing",
        fileAssetId: "pdf_1",
        projectId: "p1",
      }),
    ).rejects.toThrow("Level not found");
  });
});
