import { prisma } from "../prisma.js";
import { loadProjectWithAuth } from "../permissions.js";
export async function loadLocationForUser(c, locationId) {
    const location = await prisma.location.findUnique({
        where: { id: locationId },
        include: { project: { include: { workspace: true } } },
    });
    if (!location)
        return { response: c.json({ error: "Location not found" }, 404) };
    const auth = await loadProjectWithAuth(location.projectId, c.get("user").id);
    if ("error" in auth)
        return { response: c.json({ error: auth.error }, auth.status) };
    return { location, ctx: auth.ctx };
}
export async function loadBuildingForUser(c, buildingId) {
    const building = await prisma.building.findUnique({
        where: { id: buildingId },
        include: {
            location: {
                include: { project: { include: { workspace: true } } },
            },
        },
    });
    if (!building)
        return { response: c.json({ error: "Building not found" }, 404) };
    const auth = await loadProjectWithAuth(building.location.projectId, c.get("user").id);
    if ("error" in auth)
        return { response: c.json({ error: auth.error }, auth.status) };
    return { building, location: building.location, ctx: auth.ctx };
}
export async function loadLevelForUser(c, levelId) {
    const level = await prisma.bimModelLevel.findUnique({
        where: { id: levelId },
        include: {
            building: {
                include: {
                    location: {
                        include: { project: { include: { workspace: true } } },
                    },
                },
            },
            project: { include: { workspace: true } },
        },
    });
    if (!level)
        return { response: c.json({ error: "Level not found" }, 404) };
    const auth = await loadProjectWithAuth(level.projectId, c.get("user").id);
    if ("error" in auth)
        return { response: c.json({ error: auth.error }, auth.status) };
    return { level, ctx: auth.ctx };
}
export function buildingFolderKey(buildingId) {
    return `__building__${buildingId}`;
}
