import { prisma } from "./prisma.js";
import { logActivity } from "./activity.js";
import { ActivityType } from "@prisma/client";
import { parseFolderTreeFromJson } from "./folderStructureTemplate.js";
const MAX_TEMPLATE_DEPTH = 12;
function parentWhere(parentId) {
    return { parentId };
}
async function findOrCreateFolder(tx, projectId, parentId, name) {
    const existing = await tx.folder.findFirst({
        where: { projectId, ...parentWhere(parentId), name },
    });
    if (existing)
        return { folder: existing, created: false };
    const folder = await tx.folder.create({
        data: { projectId, parentId, name },
    });
    return { folder, created: true };
}
async function applyTemplateNodes(tx, projectId, parentId, nodes, depth, createdOut) {
    if (depth > MAX_TEMPLATE_DEPTH) {
        throw new Error("Folder template is too deeply nested.");
    }
    let createdCount = 0;
    let reusedCount = 0;
    for (const node of nodes) {
        const name = node.name.trim();
        if (!name)
            continue;
        const { folder, created } = await findOrCreateFolder(tx, projectId, parentId, name);
        if (created) {
            createdCount += 1;
            createdOut.push({ id: folder.id, name: folder.name });
        }
        else {
            reusedCount += 1;
        }
        if (node.children?.length) {
            const sub = await applyTemplateNodes(tx, projectId, folder.id, node.children, depth + 1, createdOut);
            createdCount += sub.createdCount;
            reusedCount += sub.reusedCount;
        }
    }
    return { createdCount, reusedCount };
}
/** Topologically order folders so parents are always before children. */
function orderedFoldersForCopy(folders) {
    const childrenByParent = new Map();
    for (const f of folders) {
        const p = f.parentId;
        if (!childrenByParent.has(p))
            childrenByParent.set(p, []);
        childrenByParent.get(p).push(f);
    }
    for (const list of childrenByParent.values()) {
        list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
    const out = [];
    const walk = (parentId) => {
        for (const f of childrenByParent.get(parentId) ?? []) {
            out.push(f);
            walk(f.id);
        }
    };
    walk(null);
    return out;
}
async function logFolderCreates(workspaceId, actorUserId, projectId, items) {
    for (const item of items) {
        await logActivity(workspaceId, ActivityType.FOLDER_CREATED, {
            actorUserId,
            entityId: item.id,
            projectId,
            metadata: { name: item.name },
        });
    }
}
export async function applyFolderStructureFromTemplate(opts) {
    const row = await prisma.folderStructureTemplate.findFirst({
        where: { slug: opts.templateId, isActive: true },
    });
    if (!row) {
        throw new Error("Unknown folder template.");
    }
    let tree;
    try {
        tree = parseFolderTreeFromJson(row.tree);
    }
    catch {
        throw new Error("Invalid folder template data.");
    }
    if (!tree.length) {
        throw new Error("Folder template is empty.");
    }
    if (opts.targetParentId) {
        const parent = await prisma.folder.findFirst({
            where: { id: opts.targetParentId, projectId: opts.projectId },
        });
        if (!parent)
            throw new Error("Destination folder not found.");
    }
    const createdFolders = [];
    const result = await prisma.$transaction(async (tx) => {
        return applyTemplateNodes(tx, opts.projectId, opts.targetParentId, tree, 0, createdFolders);
    });
    await logFolderCreates(opts.workspaceId, opts.actorUserId, opts.projectId, createdFolders);
    return result;
}
export async function copyFolderStructureBetweenProjects(opts) {
    if (opts.sourceProjectId === opts.targetProjectId) {
        throw new Error("Choose a different source project.");
    }
    if (opts.targetParentId) {
        const parent = await prisma.folder.findFirst({
            where: { id: opts.targetParentId, projectId: opts.targetProjectId },
        });
        if (!parent)
            throw new Error("Destination folder not found.");
    }
    const sourceFolders = await prisma.folder.findMany({
        where: { projectId: opts.sourceProjectId },
        select: { id: true, name: true, parentId: true },
    });
    if (sourceFolders.length === 0) {
        return { createdCount: 0, reusedCount: 0 };
    }
    const ordered = orderedFoldersForCopy(sourceFolders);
    const idMap = new Map();
    const createdFolders = [];
    const result = await prisma.$transaction(async (tx) => {
        let createdCount = 0;
        let reusedCount = 0;
        for (const src of ordered) {
            const newParentId = src.parentId ? idMap.get(src.parentId) : opts.targetParentId;
            if (src.parentId && newParentId === undefined) {
                throw new Error("Invalid source folder tree.");
            }
            const { folder, created } = await findOrCreateFolder(tx, opts.targetProjectId, newParentId ?? null, src.name);
            idMap.set(src.id, folder.id);
            if (created) {
                createdCount += 1;
                createdFolders.push({ id: folder.id, name: folder.name });
            }
            else {
                reusedCount += 1;
            }
        }
        return { createdCount, reusedCount };
    });
    await logFolderCreates(opts.workspaceId, opts.actorUserId, opts.targetProjectId, createdFolders);
    return result;
}
