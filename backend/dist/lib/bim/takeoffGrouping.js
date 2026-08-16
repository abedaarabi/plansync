function formatCategoryLabel(ifcType) {
    return ifcType.replace(/^Ifc/i, "") || ifcType;
}
/** Recommended takeoff key: Type name when present, else IFC category. */
export function costGroupForEntry(entry) {
    const typeName = entry.typeName?.trim();
    if (typeName) {
        return { key: `typename:${typeName}`, label: typeName, source: "typeName" };
    }
    const ifcType = entry.ifcType?.trim() || "IfcProduct";
    return {
        key: `type:${ifcType}`,
        label: formatCategoryLabel(ifcType),
        source: "ifcType",
    };
}
/** Group quantity entries for auto-map / cost takeoff lines. */
export function groupEntriesForCostTakeoff(entries) {
    const map = new Map();
    for (const entry of entries) {
        const { key, label, source } = costGroupForEntry(entry);
        let group = map.get(key);
        if (!group) {
            group = {
                key,
                label,
                source,
                ifcType: entry.ifcType || null,
                typeName: entry.typeName?.trim() || null,
                guids: [],
                entries: [],
            };
            map.set(key, group);
        }
        group.guids.push(entry.guid);
        group.entries.push(entry);
        if (!group.ifcType && entry.ifcType)
            group.ifcType = entry.ifcType;
    }
    return [...map.values()].sort((a, b) => b.guids.length - a.guids.length || a.label.localeCompare(b.label));
}
