import { prisma } from "./prisma.js";

/** True when another user holds an active (non-expired) lock on this revision. */
export async function fileVersionWriteBlocked(
  fileVersionId: string,
  userId: string,
): Promise<boolean> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    select: { lockedByUserId: true, lockExpiresAt: true },
  });
  if (!fv?.lockedByUserId) return false;
  if (fv.lockExpiresAt && fv.lockExpiresAt < new Date()) return false;
  return fv.lockedByUserId !== userId;
}
