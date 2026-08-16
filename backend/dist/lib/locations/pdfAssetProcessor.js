import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../prisma.js";
import { getObjectStream, putObjectBuffer } from "../s3.js";
import { webStreamToBuffer } from "../bim/streamUtils.js";
import { buildingAssetThumbnailKey } from "../bim/s3Keys.js";
import { notifyBimJobEvent } from "../bim/bimJobNotify.js";
async function rasterizePdfFirstPage(pdfBytes) {
    // pdf-lib doesn't rasterize; use sharp on embedded preview if available, else placeholder PNG.
    // For production PDF rasterization we'd use pdfjs-dist or poppler — here create a simple placeholder
    // and attempt pdf page dimensions for aspect ratio.
    let width = 800;
    let height = 600;
    try {
        const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const page = doc.getPage(0);
        const size = page.getSize();
        const scale = 800 / Math.max(size.width, 1);
        width = Math.round(size.width * scale);
        height = Math.round(size.height * scale);
    }
    catch {
        /* defaults */
    }
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#cbd5e1" stroke-width="2"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14" fill="#64748b">PDF</text>
  </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
}
async function processPdfAsset(env, fileVersionId, userId) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: true } } },
    });
    if (!fv)
        throw new Error("File version not found");
    const { file } = fv;
    const workspaceId = file.project.workspaceId;
    await prisma.fileVersion.update({
        where: { id: fileVersionId },
        data: { assetProcessingStatus: "PROCESSING", assetProcessingError: null },
    });
    try {
        const obj = await getObjectStream(env, fv.s3Key);
        if (!obj.ok)
            throw new Error(obj.error);
        const pdfBuf = await webStreamToBuffer(obj.stream);
        const thumbBuf = await rasterizePdfFirstPage(Buffer.from(pdfBuf));
        const thumbKey = buildingAssetThumbnailKey(workspaceId, file.projectId, file.id, fileVersionId);
        await putObjectBuffer(env, thumbKey, thumbBuf, "image/png");
        await prisma.fileVersion.update({
            where: { id: fileVersionId },
            data: {
                thumbnailS3Key: thumbKey,
                assetProcessingStatus: "READY",
                assetProcessingError: null,
            },
        });
        if (userId) {
            await notifyBimJobEvent("bim.pdf_ready", {
                env,
                workspaceId,
                projectId: file.projectId,
                projectName: file.project.name,
                fileId: file.id,
                fileVersionId,
                fileName: file.name,
                versionNumber: fv.version,
                userId,
                jobStartedAt: null,
            });
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.fileVersion.update({
            where: { id: fileVersionId },
            data: { assetProcessingStatus: "FAILED", assetProcessingError: message },
        });
        throw err;
    }
}
export async function enqueuePdfAssetProcessing(env, fileVersionId, userId) {
    void processPdfAsset(env, fileVersionId, userId).catch((err) => {
        console.error("[locations.pdf] processing failed", fileVersionId, err);
    });
}
