import type { Prisma } from "@prisma/client";

export const MAX_PUNCH_REFERENCE_PHOTOS = 8;
export const MAX_PUNCH_PHOTO_BYTES = 15n * 1024n * 1024n;

export type PunchReferencePhotoParsed = {
  id: string;
  s3Key: string;
  fileName: string;
  contentType?: string;
  createdAt: string;
  sizeBytes: number;
};

export function parsePunchReferencePhotos(v: unknown): PunchReferencePhotoParsed[] {
  if (!Array.isArray(v)) return [];
  const out: PunchReferencePhotoParsed[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 80) : "";
    const s3Key = typeof o.s3Key === "string" && o.s3Key.trim() ? o.s3Key.trim().slice(0, 500) : "";
    const fileName =
      typeof o.fileName === "string" && o.fileName.trim() ? o.fileName.trim().slice(0, 200) : "";
    if (!id || !s3Key || !fileName) continue;
    const contentType =
      typeof o.contentType === "string" ? o.contentType.trim().slice(0, 120) : undefined;
    const createdAt =
      typeof o.createdAt === "string" && o.createdAt.trim()
        ? o.createdAt.trim().slice(0, 80)
        : new Date().toISOString();
    let sizeBytes = 0;
    if (typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes) && o.sizeBytes >= 0) {
      sizeBytes = Math.min(Math.floor(o.sizeBytes), 80 * 1024 * 1024);
    }
    out.push({ id, s3Key, fileName, contentType, createdAt, sizeBytes });
  }
  return out.slice(0, MAX_PUNCH_REFERENCE_PHOTOS);
}

export function punchReferencePhotosToJsonValue(
  photos: PunchReferencePhotoParsed[],
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(photos)) as Prisma.InputJsonValue;
}

export function punchPhotosStorageBytes(photos: PunchReferencePhotoParsed[]): bigint {
  return photos.reduce((n, p) => n + BigInt(p.sizeBytes || 0), 0n);
}
