import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { disciplineForIfcType } from "./discipline.js";
/** Re-open RESOLVED/IGNORED when distance moved more than this (mm). */
export const CLASH_MATERIALITY_MM = 5;
/** Cluster clashes whose points are within this distance (meters). */
const CLASH_GROUP_RADIUS_M = 1.5;
export function canonicalizeElementPair(a, b) {
    if (a.elementId <= b.elementId) {
        return {
            elementAId: a.elementId,
            elementBId: b.elementId,
            guidA: a.guid,
            guidB: b.guid,
            fileVersionAId: a.fileVersionId,
            fileVersionBId: b.fileVersionId,
        };
    }
    return {
        elementAId: b.elementId,
        elementBId: a.elementId,
        guidA: b.guid,
        guidB: a.guid,
        fileVersionAId: b.fileVersionId,
        fileVersionBId: a.fileVersionId,
    };
}
export function shouldReopenDismissed(status, statusDistanceMm, newDistanceMm, materialityMm = CLASH_MATERIALITY_MM) {
    if (status !== "RESOLVED" && status !== "IGNORED")
        return false;
    if (statusDistanceMm == null || !Number.isFinite(statusDistanceMm))
        return false;
    return Math.abs(newDistanceMm - statusDistanceMm) > materialityMm;
}
export function pairKey(elementAId, elementBId) {
    return `${elementAId}|${elementBId}`;
}
function distSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}
/**
 * Assign stable group ids by clustering points within radius.
 * Existing group ids are preferred when a member of that cluster already has one.
 */
// fallow-ignore-next-line complexity
export function assignClashGroups(items, radiusM = CLASH_GROUP_RADIUS_M) {
    const r2 = radiusM * radiusM;
    const result = new Map();
    const clusters = [];
    for (const item of items) {
        let matched = null;
        for (const cluster of clusters) {
            if (cluster.members.some((m) => distSq(m.point, item.point) <= r2)) {
                matched = cluster;
                break;
            }
        }
        if (matched) {
            matched.members.push(item);
            if (item.groupId &&
                !matched.members.some((m) => m !== item && m.groupId === matched.groupId)) {
                // Prefer an existing group id from any member.
            }
            if (item.groupId) {
                const existingPreferred = matched.members.find((m) => m.groupId)?.groupId;
                if (existingPreferred)
                    matched.groupId = existingPreferred;
            }
        }
        else {
            clusters.push({
                groupId: item.groupId ?? randomUUID(),
                members: [item],
            });
        }
    }
    for (const cluster of clusters) {
        const preferred = cluster.members.map((m) => m.groupId).find((g) => Boolean(g)) ?? cluster.groupId;
        for (const m of cluster.members) {
            result.set(m.id, preferred);
        }
    }
    return result;
}
export function isNoLongerClashing(lastSeenAt, testLastRunAt) {
    if (!testLastRunAt)
        return false;
    return lastSeenAt.getTime() < testLastRunAt.getTime();
}
function parsePoint(json) {
    if (json &&
        typeof json === "object" &&
        "x" in json &&
        "y" in json &&
        "z" in json &&
        typeof json.x === "number" &&
        typeof json.y === "number" &&
        typeof json.z === "number") {
        return json;
    }
    return { x: 0, y: 0, z: 0 };
}
function tradeMatchesDiscipline(trade, discipline) {
    if (!trade?.trim())
        return false;
    const t = trade.toLowerCase();
    const d = discipline.toLowerCase();
    if (t.includes(d) || d.includes(t))
        return true;
    if (d === "mechanical" && /mech|hvac|plumb/.test(t))
        return true;
    if (d === "electrical" && /elec/.test(t))
        return true;
    if (d === "structure" && /struct|steel|concrete/.test(t))
        return true;
    if (d === "architecture" && /arch/.test(t))
        return true;
    if (d === "mep" && /mep|plumb|fire/.test(t))
        return true;
    return false;
}
async function resolveTradeAssignee(projectId, discipline) {
    const members = await prisma.projectMember.findMany({
        where: { projectId, trade: { not: null } },
        select: { userId: true, trade: true },
    });
    const match = members.find((m) => tradeMatchesDiscipline(m.trade, discipline));
    return match?.userId ?? null;
}
// fallow-ignore-next-line complexity
async function resolveHitsToElements(projectId, hits) {
    const fileVersionIds = [...new Set(hits.flatMap((h) => [h.fileVersionIdA, h.fileVersionIdB]))];
    const versions = await prisma.fileVersion.findMany({
        where: { id: { in: fileVersionIds }, file: { projectId } },
        select: { id: true, fileId: true },
    });
    const fvToFile = new Map(versions.map((v) => [v.id, v.fileId]));
    const guidsByFile = new Map();
    const metaByFileGuid = new Map();
    for (const h of hits) {
        const fileA = fvToFile.get(h.fileVersionIdA);
        const fileB = fvToFile.get(h.fileVersionIdB);
        if (!fileA || !fileB)
            continue;
        if (!guidsByFile.has(fileA))
            guidsByFile.set(fileA, new Set());
        if (!guidsByFile.has(fileB))
            guidsByFile.set(fileB, new Set());
        guidsByFile.get(fileA).add(h.guidA);
        guidsByFile.get(fileB).add(h.guidB);
        metaByFileGuid.set(`${fileA}|${h.guidA}`, {
            name: h.nameA?.trim() || null,
            ifcType: h.ifcTypeA?.trim() || null,
        });
        metaByFileGuid.set(`${fileB}|${h.guidB}`, {
            name: h.nameB?.trim() || null,
            ifcType: h.ifcTypeB?.trim() || null,
        });
    }
    const elementByFileGuid = new Map();
    for (const [fileId, guids] of guidsByFile) {
        const els = await prisma.bimElement.findMany({
            where: { fileId, ifcGuid: { in: [...guids] } },
            select: { id: true, ifcGuid: true, ifcType: true, name: true },
        });
        for (const el of els) {
            elementByFileGuid.set(`${fileId}|${el.ifcGuid}`, {
                id: el.id,
                ifcType: el.ifcType,
                name: el.name,
            });
        }
        // Upsert stubs for clash partners missing from the element index so runs
        // still persist (viewer-driven clashes can precede a full element ingest).
        // Fill name/type from the hit when the stored row is empty.
        for (const guid of guids) {
            const key = `${fileId}|${guid}`;
            const meta = metaByFileGuid.get(key) ?? { name: null, ifcType: null };
            const existing = elementByFileGuid.get(key);
            if (existing) {
                const needName = !existing.name && meta.name;
                const needType = !existing.ifcType && meta.ifcType;
                if (needName || needType) {
                    const updated = await prisma.bimElement.update({
                        where: { id: existing.id },
                        data: {
                            ...(needName ? { name: meta.name } : {}),
                            ...(needType ? { ifcType: meta.ifcType } : {}),
                        },
                        select: { id: true, ifcGuid: true, ifcType: true, name: true },
                    });
                    elementByFileGuid.set(key, {
                        id: updated.id,
                        ifcType: updated.ifcType,
                        name: updated.name,
                    });
                }
                continue;
            }
            const created = await prisma.bimElement.upsert({
                where: { fileId_ifcGuid: { fileId, ifcGuid: guid } },
                create: {
                    fileId,
                    ifcGuid: guid,
                    ifcType: meta.ifcType,
                    name: meta.name,
                },
                update: {
                    ...(meta.name ? { name: meta.name } : {}),
                    ...(meta.ifcType ? { ifcType: meta.ifcType } : {}),
                },
                select: { id: true, ifcGuid: true, ifcType: true, name: true },
            });
            elementByFileGuid.set(key, {
                id: created.id,
                ifcType: created.ifcType,
                name: created.name,
            });
        }
    }
    const out = [];
    for (const h of hits) {
        const fileA = fvToFile.get(h.fileVersionIdA);
        const fileB = fvToFile.get(h.fileVersionIdB);
        if (!fileA || !fileB)
            continue;
        const elA = elementByFileGuid.get(`${fileA}|${h.guidA}`);
        const elB = elementByFileGuid.get(`${fileB}|${h.guidB}`);
        if (!elA || !elB)
            continue;
        const pair = canonicalizeElementPair({ elementId: elA.id, guid: h.guidA, fileVersionId: h.fileVersionIdA }, { elementId: elB.id, guid: h.guidB, fileVersionId: h.fileVersionIdB });
        const typeB = pair.elementBId === elB.id ? elB.ifcType : elA.ifcType;
        out.push({
            pair,
            clashType: h.clashType,
            distanceMm: h.distanceMm,
            point: h.point,
            contactCount: Math.max(1, h.contactCount),
            disciplineB: disciplineForIfcType(typeB ?? "Other"),
        });
    }
    return out;
}
// fallow-ignore-next-line complexity
export async function reconcileClashRun(args) {
    const { testId, projectId, userId, payload } = args;
    const now = new Date();
    const existing = await prisma.bimClash.findMany({ where: { testId } });
    const byPair = new Map(existing.map((c) => [pairKey(c.elementAId, c.elementBId), c]));
    const resolved = await resolveHitsToElements(projectId, payload.hits);
    // Collapse multi-contact hits for the same pair (keep deepest / most contacts as representative).
    const bestByPair = new Map();
    for (const hit of resolved) {
        const key = pairKey(hit.pair.elementAId, hit.pair.elementBId);
        const prev = bestByPair.get(key);
        if (!prev) {
            bestByPair.set(key, hit);
            continue;
        }
        const preferNew = Math.abs(hit.distanceMm) > Math.abs(prev.distanceMm) ||
            (Math.abs(hit.distanceMm) === Math.abs(prev.distanceMm) &&
                hit.contactCount > prev.contactCount);
        bestByPair.set(key, {
            ...(preferNew ? hit : prev),
            contactCount: prev.contactCount + hit.contactCount,
        });
    }
    let newCount = 0;
    let reopenedCount = 0;
    let stillClashing = 0;
    const seenKeys = new Set();
    for (const hit of bestByPair.values()) {
        const key = pairKey(hit.pair.elementAId, hit.pair.elementBId);
        seenKeys.add(key);
        const prev = byPair.get(key);
        if (!prev) {
            const assigneeId = await resolveTradeAssignee(projectId, hit.disciplineB);
            await prisma.bimClash.create({
                data: {
                    testId,
                    projectId,
                    ...hit.pair,
                    clashType: hit.clashType,
                    distanceMm: hit.distanceMm,
                    pointJson: hit.point,
                    contactCount: hit.contactCount,
                    status: "NEW",
                    assigneeId,
                    firstSeenAt: now,
                    lastSeenAt: now,
                },
            });
            newCount += 1;
            continue;
        }
        stillClashing += 1;
        const reopen = shouldReopenDismissed(prev.status, prev.statusDistanceMm, hit.distanceMm);
        const data = {
            clashType: hit.clashType,
            distanceMm: hit.distanceMm,
            pointJson: hit.point,
            contactCount: hit.contactCount,
            lastSeenAt: now,
            elementMissingSince: { disconnect: true },
            fileVersionA: { connect: { id: hit.pair.fileVersionAId } },
            fileVersionB: { connect: { id: hit.pair.fileVersionBId } },
        };
        if (reopen) {
            data.status = "ACTIVE";
            data.statusChangedAt = now;
            data.statusDistanceMm = null;
            reopenedCount += 1;
        }
        await prisma.bimClash.update({ where: { id: prev.id }, data });
    }
    let orphaned = 0;
    let noLongerClashing = 0;
    for (const prev of existing) {
        const key = pairKey(prev.elementAId, prev.elementBId);
        if (seenKeys.has(key))
            continue;
        noLongerClashing += 1;
        const versions = await prisma.bimElementVersion.findMany({
            where: {
                elementId: { in: [prev.elementAId, prev.elementBId] },
            },
            orderBy: { fileVersionId: "desc" },
            select: { elementId: true, fileVersionId: true, changeType: true },
        });
        const deletedVersion = versions.find((v) => v.changeType === "DELETED");
        if (deletedVersion && !prev.elementMissingSinceId) {
            await prisma.bimClash.update({
                where: { id: prev.id },
                data: { elementMissingSinceId: deletedVersion.fileVersionId },
            });
            orphaned += 1;
        }
    }
    // Group assignment across all clashes for this test after reconcile.
    const all = await prisma.bimClash.findMany({ where: { testId } });
    const groupMap = assignClashGroups(all.map((c) => ({
        id: c.id,
        point: parsePoint(c.pointJson),
        groupId: c.groupId,
    })));
    await Promise.all(all.map(async (c) => {
        const gid = groupMap.get(c.id);
        if (gid && gid !== c.groupId) {
            await prisma.bimClash.update({ where: { id: c.id }, data: { groupId: gid } });
        }
    }));
    const stats = {
        newCount,
        reopenedCount,
        stillClashing,
        noLongerClashing,
        orphaned,
    };
    await prisma.bimClashTest.update({
        where: { id: testId },
        data: {
            setAJson: payload.setA,
            setBJson: payload.setB,
            clearanceEnabled: payload.clearanceEnabled,
            clearanceMm: payload.clearanceMm,
            lastRunAt: now,
            lastRunById: userId,
            lastRunStats: stats,
        },
    });
    const clashes = await prisma.bimClash.findMany({
        where: { testId },
        orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
    });
    return { clashes, stats };
}
export function parseSetDef(json) {
    if (json &&
        typeof json === "object" &&
        "label" in json &&
        typeof json.label === "string" &&
        Array.isArray(json.rules)) {
        return json;
    }
    return { label: "Set", rules: [] };
}
export function parseRunStats(json) {
    if (!json || typeof json !== "object")
        return null;
    const s = json;
    if (typeof s.newCount !== "number" ||
        typeof s.reopenedCount !== "number" ||
        typeof s.stillClashing !== "number" ||
        typeof s.noLongerClashing !== "number" ||
        typeof s.orphaned !== "number") {
        return null;
    }
    return {
        newCount: s.newCount,
        reopenedCount: s.reopenedCount,
        stillClashing: s.stillClashing,
        noLongerClashing: s.noLongerClashing,
        orphaned: s.orphaned,
    };
}
