import type { Context } from "hono";
import { prisma } from "../../lib/prisma.js";
import { isProjectAccessError, loadProjectForMember } from "../../lib/projectAccess.js";
import { requireBimProPlusAccess } from "../../lib/planFeatureGates.js";
import type { Env } from "../../lib/env.js";
import { getObjectStream } from "../../lib/s3.js";
import { parseQuantityIndexBuffer } from "../../lib/bim/quantityIndexBuilder.js";
import { webStreamToBuffer } from "../../lib/bim/streamUtils.js";
import type { BimQuantityIndex } from "../../lib/bim/types.js";

export async function loadBimFileVersion(fileVersionId: string) {
  return prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: { include: { workspace: true } } } } },
  });
}

export type BimFileVersion = NonNullable<Awaited<ReturnType<typeof loadBimFileVersion>>>;

export function requireBimPro(workspace: {
  subscriptionStatus: string | null;
  billingPlan?: string | null;
  currentPeriodEnd?: Date | string | null;
  stripeSubscriptionId?: string | null;
}) {
  return requireBimProPlusAccess(workspace);
}

export async function authorizeBimFileVersion(
  c: Context,
  fileVersionId: string,
  opts?: { requirePro?: boolean },
): Promise<{ fv: BimFileVersion } | { response: Response }> {
  const fv = await loadBimFileVersion(fileVersionId);
  if (!fv) return { response: c.json({ error: "Not found" }, 404) };
  const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
  if (isProjectAccessError(access)) {
    return { response: c.json({ error: access.error }, access.status) };
  }
  if (opts?.requirePro) {
    const pro = requireBimPro(fv.file.project.workspace);
    if (pro) return { response: c.json({ error: pro.error }, pro.status) };
  }
  return { fv };
}

export async function authorizeSameFileCompare(
  c: Context,
  fileVersionId: string,
  baseFileVersionId: string | undefined,
): Promise<{ fv: BimFileVersion; base: BimFileVersion } | { response: Response }> {
  if (!baseFileVersionId) {
    return { response: c.json({ error: "baseFileVersionId required" }, 400) };
  }
  const auth = await authorizeBimFileVersion(c, fileVersionId, { requirePro: true });
  if ("response" in auth) return auth;
  const base = await loadBimFileVersion(baseFileVersionId);
  if (!base) return { response: c.json({ error: "Not found" }, 404) };
  if (auth.fv.fileId !== base.fileId) {
    return { response: c.json({ error: "Versions must be same file" }, 400) };
  }
  return { fv: auth.fv, base };
}

export async function readBimQuantityIndex(
  env: Env,
  fv: { quantityIndexS3Key: string | null },
): Promise<BimQuantityIndex | null> {
  if (!fv.quantityIndexS3Key) return null;
  try {
    const obj = await getObjectStream(env, fv.quantityIndexS3Key);
    if (!obj.ok) return null;
    const raw = await webStreamToBuffer(obj.stream);
    return parseQuantityIndexBuffer(raw);
  } catch {
    return null;
  }
}
