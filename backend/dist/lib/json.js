export function workspaceJson(ws) {
    return {
        ...ws,
        storageUsedBytes: ws.storageUsedBytes.toString(),
        storageQuotaBytes: ws.storageQuotaBytes.toString(),
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
