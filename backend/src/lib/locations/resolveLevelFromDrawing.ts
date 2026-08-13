import { prisma } from "../prisma.js";

export type ResolvedLevel = {
  levelId: string;
  levelName: string;
  buildingId: string | null;
};

function toResolved(level: {
  id: string;
  displayName: string;
  buildingId: string | null;
}): ResolvedLevel {
  return {
    levelId: level.id,
    levelName: level.displayName,
    buildingId: level.buildingId ?? null,
  };
}

const levelSelect = {
  id: true,
  displayName: true,
  buildingId: true,
} as const;

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
      select: levelSelect,
    });
    if (!level) return null;
    return toResolved(level);
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
      include: { bimModelLevel: { select: levelSelect } },
      orderBy: { createdAt: "asc" },
    });
    if (pageMap) {
      return toResolved(pageMap.bimModelLevel);
    }
  }

  // Whole-file simple assign uses pageIndex 0; also any single map for this PDF.
  const maps = await prisma.drawingLevelMap.findMany({
    where: { projectId: params.projectId, pdfFileId: fileId },
    include: { bimModelLevel: { select: levelSelect } },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  if (maps.length === 0) return null;
  if (maps.length === 1 || maps[0]!.pageIndex === 0) {
    return toResolved(maps[0]!.bimModelLevel);
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
    select: levelSelect,
    orderBy: { sortOrder: "asc" },
  });
  if (!level) return null;
  return toResolved(level);
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
  buildingId?: string | null;
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
        buildingId: params.buildingId,
      });
    }
  }

  if (params.explicitLevelId && !level) {
    return { level: null, error: "Level not found in this project" };
  }
  return { level };
}

/** Validate building belongs to project (via its site location). */
async function resolveBuildingForProject(params: {
  projectId: string;
  buildingId: string;
}): Promise<{ buildingId: string; buildingName: string } | null> {
  const building = await prisma.building.findFirst({
    where: {
      id: params.buildingId,
      location: { projectId: params.projectId },
    },
    select: { id: true, name: true },
  });
  if (!building) return null;
  return { buildingId: building.id, buildingName: building.name };
}

/**
 * Resolve final buildingId for create/patch:
 * - level wins when present (and must match explicit building if both sent)
 * - else explicit building
 */
export async function resolveBuildingIdForIssue(params: {
  projectId: string;
  explicitBuildingId?: string | null;
  levelBuildingId?: string | null;
}): Promise<{ buildingId: string | null | undefined; error?: string }> {
  if (params.explicitBuildingId === null && params.levelBuildingId == null) {
    return { buildingId: null };
  }

  if (params.levelBuildingId) {
    if (params.explicitBuildingId && params.explicitBuildingId !== params.levelBuildingId) {
      return {
        buildingId: undefined,
        error: "Level does not belong to the selected building",
      };
    }
    return { buildingId: params.levelBuildingId };
  }

  if (params.explicitBuildingId === undefined) {
    return { buildingId: undefined };
  }
  if (params.explicitBuildingId === null) {
    return { buildingId: null };
  }

  const b = await resolveBuildingForProject({
    projectId: params.projectId,
    buildingId: params.explicitBuildingId,
  });
  if (!b) return { buildingId: undefined, error: "Building not found in this project" };
  return { buildingId: b.buildingId };
}
