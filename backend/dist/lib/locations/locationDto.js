function trimOrNull(value) {
    if (value == null)
        return null;
    const t = value.trim();
    return t.length > 0 ? t : null;
}
export function normalizeLocationInput(input) {
    let latitude = null;
    let longitude = null;
    if (input.latitude != null &&
        input.longitude != null &&
        Number.isFinite(input.latitude) &&
        Number.isFinite(input.longitude)) {
        latitude = input.latitude;
        longitude = input.longitude;
    }
    return {
        name: input.name.trim(),
        code: trimOrNull(input.code),
        address: trimOrNull(input.address),
        city: trimOrNull(input.city),
        country: trimOrNull(input.country),
        latitude,
        longitude,
        notes: trimOrNull(input.notes),
    };
}
export function normalizeBuildingInput(input) {
    return {
        name: input.name.trim(),
        code: trimOrNull(input.code),
        buildingType: input.buildingType ?? null,
        floorsApprox: input.floorsApprox == null || Number.isNaN(input.floorsApprox)
            ? null
            : Math.max(0, Math.floor(input.floorsApprox)),
        notes: trimOrNull(input.notes),
    };
}
export function locationJson(loc) {
    return {
        id: loc.id,
        name: loc.name,
        code: loc.code,
        address: loc.address,
        city: loc.city,
        country: loc.country,
        latitude: loc.latitude,
        longitude: loc.longitude,
        notes: loc.notes,
        buildingCount: loc.buildingCount ?? 0,
        createdAt: loc.createdAt.toISOString(),
        updatedAt: loc.updatedAt.toISOString(),
    };
}
export function buildingMetaJson(b) {
    return {
        id: b.id,
        name: b.name,
        code: b.code,
        buildingType: b.buildingType,
        floorsApprox: b.floorsApprox,
        notes: b.notes,
        hasImage: Boolean(b.imageS3Key),
    };
}
