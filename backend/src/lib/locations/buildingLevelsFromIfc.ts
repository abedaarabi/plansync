import { prisma } from "../prisma.js";
import type { Env } from "../env.js";
import { getObjectStream } from "../s3.js";
import { webStreamToBuffer } from "../bim/streamUtils.js";
import { extractStoreysFromIfc, type StoreyPreview } from "../bim/storeyExtract.js";
import { parseQuantityIndexBuffer } from "../bim/quantityIndexBuilder.js";

async function readIfcBytes(env: Env, s3Key: string): Promise<Uint8Array> {
  const obj = await getObjectStream(env, s3Key);
  if (!obj.ok) throw new Error(obj.error);
  const buf = await webStreamToBuffer(obj.stream);
  return new Uint8Array(buf);
}

function mergeElementCounts(
  storeys: StoreyPreview[],
  byLevel: Record<string, { count: number }>,
): StoreyPreview[] {
  return storeys.map((s) => ({
    ...s,
    elementCount: byLevel[s.sourceName]?.count ?? s.elementCount,
  }));
}

/** Upsert BimModelLevel rows for a building-scoped IFC after conversion summary is ready. */
export async function syncBuildingLevelsFromIfc(env: Env, fileVersionId: string): Promise<number> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: true },
  });
  if (!fv?.file.buildingId) return 0;

  const buildingId = fv.file.buildingId;
  const projectId = fv.file.projectId;

  let storeys: StoreyPreview[] = [];
  if (fv.quantityIndexS3Key) {
    try {
      const obj = await getObjectStream(env, fv.quantityIndexS3Key);
      if (obj.ok) {
        const buf = await webStreamToBuffer(obj.stream);
        const index = parseQuantityIndexBuffer(buf);
        if (index?.byLevel) {
          storeys = Object.entries(index.byLevel).map(([name, agg]) => ({
            sourceName: name,
            displayName: name,
            elevationMeters: null,
            elementCount: agg.count,
            sourceIfcGuid: null,
          }));
          storeys.sort((a, b) => {
            const ea = a.elevationMeters;
            const eb = b.elevationMeters;
            if (ea != null && eb != null && ea !== eb) return ea - eb;
            return a.sourceName.localeCompare(b.sourceName);
          });
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (storeys.length === 0) {
    const ifcBytes = await readIfcBytes(env, fv.s3Key);
    storeys = await extractStoreysFromIfc(ifcBytes);
  }

  let sortOrder = 0;
  for (const storey of storeys) {
    await prisma.bimModelLevel.upsert({
      where: {
        buildingId_sourceName: {
          buildingId,
          sourceName: storey.sourceName,
        },
      },
      create: {
        projectId,
        buildingId,
        ifcFileVersionId: fileVersionId,
        sourceName: storey.sourceName,
        displayName: storey.displayName,
        elevationMeters: storey.elevationMeters,
        sourceIfcGuid: storey.sourceIfcGuid ?? null,
        sortOrder: sortOrder++,
        elementCount: storey.elementCount,
      },
      update: {
        ifcFileVersionId: fileVersionId,
        displayName: storey.displayName,
        elevationMeters: storey.elevationMeters,
        sourceIfcGuid: storey.sourceIfcGuid ?? null,
        sortOrder: sortOrder++,
        elementCount: storey.elementCount,
      },
    });
  }

  return storeys.length;
}

/** Backfill levels for ready building IFC versions that were converted before sync ran. */
export async function ensureBuildingLevelsSynced(env: Env, buildingId: string): Promise<void> {
  const ifcFiles = await prisma.file.findMany({
    where: { buildingId, buildingAssetType: "IFC" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  for (const file of ifcFiles) {
    const fv = file.versions[0];
    if (!fv || fv.bimConversionStatus !== "ready" || !fv.quantityIndexS3Key) continue;
    await syncBuildingLevelsFromIfc(env, fv.id).catch((err) => {
      console.error("[locations] ensure building levels sync failed", fv.id, err);
    });
  }
}
