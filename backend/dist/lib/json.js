import { parseTakeoffPricingFromSettingsJson } from "./takeoffPricing.js";
import { workspaceLogoUrlForClients } from "./workspaceLogo.js";
/** JSON-safe workspace row; `logoUrl` is a browser-loadable URL (hosted or external). Omits `logoS3Key`. */
export function workspaceJson(ws, env) {
    const { logoS3Key, logoUrl: _rawLogo, storageUsedBytes, storageQuotaBytes, ...rest } = ws;
    const logoUrl = env != null
        ? workspaceLogoUrlForClients(env, { id: ws.id, logoS3Key, logoUrl: ws.logoUrl })
        : ws.logoUrl;
    return {
        ...rest,
        logoUrl,
        storageUsedBytes: storageUsedBytes.toString(),
        storageQuotaBytes: storageQuotaBytes.toString(),
    };
}
export function fileVersionJson(fv) {
    return {
        ...fv,
        sizeBytes: fv.sizeBytes.toString(),
    };
}
function localBudgetToJson(v) {
    if (v == null)
        return null;
    if (typeof v === "object" && v !== null && "toString" in v) {
        return v.toString();
    }
    return null;
}
/** Project list includes `files.versions` with BigInt `sizeBytes` — JSON-safe. */
export function projectTreeJson(project) {
    const { localBudget, ...rest } = project;
    return {
        ...rest,
        localBudget: localBudgetToJson(localBudget),
        files: project.files.map((f) => ({
            ...f,
            versions: f.versions.map(fileVersionJson),
        })),
    };
}
/** Single project row from Prisma — JSON-safe `localBudget`. */
export function projectRowJson(row) {
    const { localBudget, ...rest } = row;
    return {
        ...rest,
        localBudget: localBudgetToJson(localBudget),
    };
}
/** Single-project API shape (GET/PATCH `/projects/:id`) — exposes takeoff pricing from `settingsJson` only. */
export function projectDetailApiJson(project) {
    return projectRowJson({
        id: project.id,
        name: project.name,
        workspaceId: project.workspaceId,
        projectNumber: project.projectNumber,
        currency: project.currency,
        measurementSystem: project.measurementSystem,
        localBudget: project.localBudget,
        projectSize: project.projectSize,
        projectType: project.projectType,
        location: project.location,
        latitude: project.latitude,
        longitude: project.longitude,
        websiteUrl: project.websiteUrl,
        logoUrl: project.logoUrl,
        stage: project.stage,
        progressPercent: project.progressPercent,
        startDate: project.startDate,
        endDate: project.endDate,
        operationsMode: project.operationsMode ?? false,
        takeoffPricing: parseTakeoffPricingFromSettingsJson(project.settingsJson),
    });
}
