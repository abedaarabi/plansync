import { z } from "zod";
/** Payload from the web viewer — stored in `FileVersion.annotationBlob` (Pro cloud). */
export const viewerStatePutSchema = z.object({
    annotations: z.array(z.any()).max(8000),
    calibrationByPage: z
        .record(z.string(), z.object({
        pageIndex: z.number(),
        mmPerPdfUnit: z.number(),
    }))
        .optional(),
    currentPage: z.number().int().min(1).max(100_000).optional(),
    scale: z.number().min(0.001).max(500).optional(),
    measureUnit: z.enum(["mm", "cm", "m", "in", "ft"]).optional(),
    snapToGeometry: z.boolean().optional(),
    snapRadiusPx: z.number().min(0).max(48).optional(),
    takeoffItems: z.array(z.any()).max(4000).optional(),
    takeoffZones: z.array(z.any()).max(12_000).optional(),
    takeoffPackageStatus: z.enum(["draft", "checked", "approved"]).optional(),
});
/** Prisma select: keep PDF bytes / listing responses small (omit large JSON). */
export const fileVersionPublicSelect = {
    id: true,
    fileId: true,
    version: true,
    s3Key: true,
    sizeBytes: true,
    sha256: true,
    label: true,
    uploadedById: true,
    lockedByUserId: true,
    lockedAt: true,
    lockExpiresAt: true,
    createdAt: true,
    annotationBlobRevision: true,
};
