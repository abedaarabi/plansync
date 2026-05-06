import type { Prisma } from "@prisma/client";

export const MAX_ISSUE_REFERENCE_PHOTOS = 12;
export const MAX_ISSUE_PHOTO_BYTES = 15n * 1024n * 1024n;
export const MAX_ISSUE_PHOTO_SKETCH_BYTES = 48_000;

export const ALLOWED_ISSUE_PHOTO_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  /** Common default from iPhone / iPad camera. */
  "image/heic",
  "image/heif",
]);

export type IssueReferencePhotoParsed = {
  id: string;
  s3Key: string;
  fileName: string;
  contentType?: string;
  createdAt: string;
  sizeBytes: number;
  sketch?: unknown;
};

export function sketchJsonByteSize(sk: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(sk)).length;
  } catch {
    return MAX_ISSUE_PHOTO_SKETCH_BYTES + 1;
  }
}

export function parseReferencePhotos(v: unknown): IssueReferencePhotoParsed[] {
  if (!Array.isArray(v)) return [];
  const out: IssueReferencePhotoParsed[] = [];
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
    const sketchRaw = "sketch" in o ? o.sketch : undefined;
    const sketch =
      sketchRaw !== undefined && sketchJsonByteSize(sketchRaw) <= MAX_ISSUE_PHOTO_SKETCH_BYTES
        ? sketchRaw
        : undefined;
    out.push({
      id,
      s3Key,
      fileName,
      contentType,
      createdAt,
      sizeBytes,
      ...(sketch !== undefined ? { sketch } : {}),
    });
  }
  return out.slice(0, MAX_ISSUE_REFERENCE_PHOTOS);
}

export function referencePhotosToJsonValue(
  photos: IssueReferencePhotoParsed[],
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(photos)) as Prisma.InputJsonValue;
}

export function issuePhotosStorageBytes(photos: IssueReferencePhotoParsed[]): bigint {
  return photos.reduce((n, p) => n + BigInt(p.sizeBytes || 0), 0n);
}
