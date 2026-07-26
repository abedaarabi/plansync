/** Monday-based week; returns UTC YYYY-MM-DD of that week's Friday. */
export function workWeekFridayKey(reportDateIso) {
    const d = new Date(reportDateIso);
    if (Number.isNaN(d.getTime()))
        return reportDateIso.slice(0, 10);
    const dow = d.getUTCDay();
    const monOffset = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + monOffset));
    const fri = new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + 4));
    return fri.toISOString().slice(0, 10);
}
