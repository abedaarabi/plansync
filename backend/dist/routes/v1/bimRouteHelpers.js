import { prisma } from "../../lib/prisma.js";
import { isProjectAccessError, loadProjectForMember } from "../../lib/projectAccess.js";
import { requireBimProPlusAccess } from "../../lib/planFeatureGates.js";
import { getObjectStream } from "../../lib/s3.js";
import { parseQuantityIndexBuffer } from "../../lib/bim/quantityIndexBuilder.js";
import { webStreamToBuffer } from "../../lib/bim/streamUtils.js";
export async function loadBimFileVersion(fileVersionId) {
    return prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: { include: { workspace: true } } } } },
    });
}
export function requireBimPro(workspace) {
    return requireBimProPlusAccess(workspace);
}
export async function authorizeBimFileVersion(c, fileVersionId, opts) {
    const fv = await loadBimFileVersion(fileVersionId);
    if (!fv)
        return { response: c.json({ error: "Not found" }, 404) };
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if (isProjectAccessError(access)) {
        return { response: c.json({ error: access.error }, access.status) };
    }
    if (opts?.requirePro) {
        const pro = requireBimPro(fv.file.project.workspace);
        if (pro)
            return { response: c.json({ error: pro.error }, pro.status) };
    }
    return { fv };
}
export async function readBimQuantityIndex(env, fv) {
    if (!fv.quantityIndexS3Key)
        return null;
    try {
        const obj = await getObjectStream(env, fv.quantityIndexS3Key);
        if (!obj.ok)
            return null;
        const raw = await webStreamToBuffer(obj.stream);
        return parseQuantityIndexBuffer(raw);
    }
    catch {
        return null;
    }
}
