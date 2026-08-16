/** Shared BIM clash detection types (API + viewer). */
export function runModeNeedsClearance(mode) {
    return mode !== "HARD";
}
export function runModeFromClearanceEnabled(clearanceEnabled) {
    return clearanceEnabled ? "BOTH" : "HARD";
}
export function filterHitsByRunMode(hits, mode) {
    if (mode === "BOTH")
        return hits;
    if (mode === "HARD") {
        return hits.filter((h) => h.clashType === "HARD" || h.clashType === "DUPLICATE");
    }
    return hits.filter((h) => h.clashType === "CLEARANCE" || h.clashType === "DUPLICATE");
}
