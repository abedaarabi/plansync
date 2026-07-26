const LEVEL_WORDS = {
    ground: 0,
    basement: -1,
    cellar: -1,
    lower: -0.5,
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    roof: 99,
    penthouse: 99,
};
function normalizeText(s) {
    return s
        .toLowerCase()
        .replace(/[_\-./\\]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function levelIndexFromText(text) {
    const norm = normalizeText(text);
    const lMatch = norm.match(/\bl\s*0*(\d+)\b/);
    if (lMatch)
        return Number.parseInt(lMatch[1], 10);
    const levelMatch = norm.match(/\blevel\s*0*(\d+)\b/);
    if (levelMatch)
        return Number.parseInt(levelMatch[1], 10);
    for (const [word, idx] of Object.entries(LEVEL_WORDS)) {
        if (norm.includes(word))
            return idx;
    }
    return null;
}
function elevationFromText(text) {
    const norm = normalizeText(text);
    const mMatch = norm.match(/([+-]?\d+(?:\.\d+)?)\s*m(?:eter|etre)?s?\b/);
    if (mMatch)
        return Number.parseFloat(mMatch[1]);
    const elMatch = norm.match(/\belev(?:ation)?\s*[:=]?\s*([+-]?\d+(?:\.\d+)?)/);
    if (elMatch)
        return Number.parseFloat(elMatch[1]);
    return null;
}
function sortedLevels(levels) {
    return [...levels].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder)
            return a.sortOrder - b.sortOrder;
        const ea = a.elevationMeters;
        const eb = b.elevationMeters;
        if (ea != null && eb != null && ea !== eb)
            return ea - eb;
        return a.displayName.localeCompare(b.displayName);
    });
}
function bestLevelByIndex(levels, idx) {
    const ordered = sortedLevels(levels);
    if (idx < 0)
        return ordered[0] ?? null;
    if (idx >= ordered.length)
        return ordered[ordered.length - 1] ?? null;
    return ordered[idx] ?? null;
}
function bestLevelByElevation(levels, target) {
    let best = null;
    let bestDist = Infinity;
    for (const level of levels) {
        if (level.elevationMeters == null)
            continue;
        const dist = Math.abs(level.elevationMeters - target);
        if (dist < bestDist) {
            bestDist = dist;
            best = level;
        }
    }
    return bestDist <= 1.5 ? best : null;
}
/** Auto-suggest level assignments for PDF pages (filename → AI → elevation → page order). */
export function suggestMappings(levels, pdfCandidates) {
    if (levels.length === 0 || pdfCandidates.length === 0)
        return [];
    const ordered = sortedLevels(levels);
    const suggestions = [];
    const used = new Set();
    const trySuggest = (candidate, level, confidence, reason) => {
        if (!level)
            return;
        const key = `${candidate.pdfFileId}:${candidate.pageIndex}`;
        if (used.has(key))
            return;
        used.add(key);
        suggestions.push({
            pdfFileId: candidate.pdfFileId,
            pageIndex: candidate.pageIndex,
            bimModelLevelId: level.id,
            sourceName: level.sourceName,
            confidence,
            reason,
        });
    };
    for (const candidate of pdfCandidates) {
        const fileText = candidate.fileName;
        const idx = levelIndexFromText(fileText);
        if (idx != null) {
            trySuggest(candidate, bestLevelByIndex(ordered, idx), 0.92, "filename level pattern");
            continue;
        }
    }
    for (const candidate of pdfCandidates) {
        const key = `${candidate.pdfFileId}:${candidate.pageIndex}`;
        if (used.has(key))
            continue;
        const aiText = candidate.summaryMarkdown ?? "";
        const idx = levelIndexFromText(aiText);
        if (idx != null) {
            trySuggest(candidate, bestLevelByIndex(ordered, idx), 0.85, "sheet AI keywords");
            continue;
        }
    }
    for (const candidate of pdfCandidates) {
        const key = `${candidate.pdfFileId}:${candidate.pageIndex}`;
        if (used.has(key))
            continue;
        const elev = elevationFromText(candidate.fileName) ??
            elevationFromText(candidate.summaryMarkdown ?? "");
        if (elev != null) {
            trySuggest(candidate, bestLevelByElevation(ordered, elev), 0.75, "elevation match");
        }
    }
    const byFile = new Map();
    for (const c of pdfCandidates) {
        const key = `${c.pdfFileId}:${c.pageIndex}`;
        if (used.has(key))
            continue;
        const list = byFile.get(c.pdfFileId) ?? [];
        list.push(c);
        byFile.set(c.pdfFileId, list);
    }
    for (const pages of byFile.values()) {
        pages.sort((a, b) => a.pageIndex - b.pageIndex);
        for (let i = 0; i < pages.length; i++) {
            const candidate = pages[i];
            const key = `${candidate.pdfFileId}:${candidate.pageIndex}`;
            if (used.has(key))
                continue;
            trySuggest(candidate, ordered[i] ?? null, 0.55, "page order vs level order");
        }
    }
    return suggestions.sort((a, b) => b.confidence - a.confidence);
}
