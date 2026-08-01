import type { Env } from "../env.js";
import { prisma } from "../prisma.js";
import { putObjectBuffer } from "../s3.js";
import { bimFragmentsKey, bimGeometryManifestKey, bimGeometryTileKey } from "./s3Keys.js";
import { hashBufferSha256 } from "./metadataHash.js";

type GeometryManifestTile = {
  id: string;
  bounds: [number, number, number, number, number, number];
  contentHash: string;
  byteLength: number;
  guidCount: number;
};

type GeometryManifest = {
  schemaVersion: 1;
  fileVersionId: string;
  monolithic: boolean;
  bounds: [number, number, number, number, number, number];
  tiles: GeometryManifestTile[];
};

const DEFAULT_BOUNDS: GeometryManifest["bounds"] = [0, 0, 0, 0, 0, 0];

/** Register monolithic fragments as a single tile (Phase 2 migrates to spatial partition). */
export async function registerMonolithicGeometryTile(opts: {
  env: Env;
  workspaceId: string;
  projectId: string;
  fileId: string;
  fileVersionId: string;
  fragmentsBuffer: Buffer;
  priorFileVersionId?: string | null;
}): Promise<string> {
  const contentHash = hashBufferSha256(opts.fragmentsBuffer);
  const tileKey = bimGeometryTileKey(opts.workspaceId, contentHash);
  const manifestKey = bimGeometryManifestKey(
    opts.workspaceId,
    opts.projectId,
    opts.fileId,
    opts.fileVersionId,
  );

  let reused = false;
  if (opts.priorFileVersionId) {
    const priorTile = await prisma.bimVersionTile.findFirst({
      where: {
        fileVersionId: opts.priorFileVersionId,
        contentHash,
      },
    });
    if (priorTile) {
      await prisma.bimGeometryTile.update({
        where: { contentHash },
        data: { refCount: { increment: 1 } },
      });
      reused = true;
    }
  }

  if (!reused) {
    const existing = await prisma.bimGeometryTile.findUnique({
      where: { contentHash },
    });
    if (existing) {
      await prisma.bimGeometryTile.update({
        where: { contentHash },
        data: { refCount: { increment: 1 } },
      });
    } else {
      const put = await putObjectBuffer(
        opts.env,
        tileKey,
        opts.fragmentsBuffer,
        "application/octet-stream",
      );
      if (!put.ok) throw new Error(put.error);
      await prisma.bimGeometryTile.create({
        data: {
          contentHash,
          s3Key: tileKey,
          byteLength: BigInt(opts.fragmentsBuffer.byteLength),
          bounds: DEFAULT_BOUNDS,
          refCount: 1,
        },
      });
    }
  }

  const manifest: GeometryManifest = {
    schemaVersion: 1,
    fileVersionId: opts.fileVersionId,
    monolithic: true,
    bounds: DEFAULT_BOUNDS,
    tiles: [
      {
        id: "0_0_0",
        bounds: DEFAULT_BOUNDS,
        contentHash,
        byteLength: opts.fragmentsBuffer.byteLength,
        guidCount: 0,
      },
    ],
  };

  const manifestPut = await putObjectBuffer(
    opts.env,
    manifestKey,
    Buffer.from(JSON.stringify(manifest), "utf8"),
    "application/json",
  );
  if (!manifestPut.ok) throw new Error(manifestPut.error);

  await prisma.bimVersionTile.upsert({
    where: {
      fileVersionId_tileId: { fileVersionId: opts.fileVersionId, tileId: "0_0_0" },
    },
    create: {
      fileVersionId: opts.fileVersionId,
      tileId: "0_0_0",
      contentHash,
    },
    update: { contentHash },
  });

  await prisma.fileVersion.update({
    where: { id: opts.fileVersionId },
    data: {
      fragmentsS3Key: bimFragmentsKey(
        opts.workspaceId,
        opts.projectId,
        opts.fileId,
        opts.fileVersionId,
      ),
      geometryManifestS3Key: manifestKey,
    },
  });

  return manifestKey;
}
