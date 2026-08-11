import { prisma } from "../prisma.js";

export type ResolvedLevel = {
  levelId: string;
  levelName: string;
};

/**
 * Resolve a building level for an issue/asset.
 * Prefer explicit levelId; else map PDF file (+ optional page) via DrawingLevelMap.
 */
export async function resolveLevelIdFromDrawing(params: {
  projectId: string;
  fileId?: string | null;
  pageNumber?: number | null;
  explicitLevelId?: string | null;
}): Promise<ResolvedLevel | null> {
  if (params.explicitLevelId) {
    const level = await prisma.bimModelLevel.findFirst({
      where: { id: params.explicitLevelId, projectId: params.projectId },
      select: { id: true, displayName: true },
    });
    if (!level) return null;
    return { levelId: level.id, levelName: level.displayName };
  }

  const fileId = params.fileId?.trim();
  if (!fileId) return null;

  const pageIndex =
    params.pageNumber != null && params.pageNumber >= 1 ? params.pageNumber - 1 : null;

  if (pageIndex != null) {
    const pageMap = await prisma.drawingLevelMap.findFirst({
      where: {
        projectId: params.projectId,
        pdfFileId: fileId,
        pageIndex,
      },
      include: { bimModelLevel: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (pageMap) {
      return {
        levelId: pageMap.bimModelLevel.id,
        levelName: pageMap.bimModelLevel.displayName,
      };
    }
  }

  // Whole-file simple assign uses pageIndex 0; also any single map for this PDF.
  const maps = await prisma.drawingLevelMap.findMany({
    where: { projectId: params.projectId, pdfFileId: fileId },
    include: { bimModelLevel: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  if (maps.length === 0) return null;
  if (maps.length === 1 || maps[0]!.pageIndex === 0) {
    const m = maps[0]!;
    return { levelId: m.bimModelLevel.id, levelName: m.bimModelLevel.displayName };
  }
  // Multiple page maps and no matching page — do not guess.
  return null;
}

/** Best-effort match IFC storey name to a building level. */
export async function resolveLevelIdFromStoreyName(params: {
  projectId: string;
  storeyName: string;
  buildingId?: string | null;
}): Promise<ResolvedLevel | null> {
  const name = params.storeyName.trim();
  if (!name) return null;

  const where = {
    projectId: params.projectId,
    ...(params.buildingId ? { buildingId: params.buildingId } : {}),
    OR: [
      { sourceName: { equals: name, mode: "insensitive" as const } },
      { displayName: { equals: name, mode: "insensitive" as const } },
    ],
  };

  const level = await prisma.bimModelLevel.findFirst({
    where,
    select: { id: true, displayName: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!level) return null;
  return { levelId: level.id, levelName: level.displayName };
}

/**
 * Resolve level for issue/asset create: explicit id, drawing map, or BIM storey name.
 * `explicitLevelId === null` clears; `undefined` means auto-resolve.
 */
export async function resolveLevelForCreate(params: {
  projectId: string;
  fileId?: string | null;
  pageNumber?: number | null;
  explicitLevelId?: string | null;
  bimStoreyName?: string | null;
}): Promise<{ level: ResolvedLevel | null; error?: string }> {
  if (params.explicitLevelId === null) {
    return { level: null };
  }

  let level = await resolveLevelIdFromDrawing({
    projectId: params.projectId,
    fileId: params.fileId,
    pageNumber: params.pageNumber,
    explicitLevelId: params.explicitLevelId,
  });

  if (!level && params.bimStoreyName) {
    const storey = params.bimStoreyName.trim();
    if (storey) {
      level = await resolveLevelIdFromStoreyName({
        projectId: params.projectId,
        storeyName: storey,
      });
    }
  }

  if (params.explicitLevelId && !level) {
    return { level: null, error: "Level not found in this project" };
  }
  return { level };
}
