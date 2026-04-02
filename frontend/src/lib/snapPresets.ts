/** Quick snap strength presets (radius in CSS pixels). */
export const SNAP_PRESETS = [
  { id: "off", label: "Off", snap: false, radius: 0 },
  { id: "light", label: "Light", snap: true, radius: 8 },
  { id: "medium", label: "Med", snap: true, radius: 14 },
  { id: "strong", label: "Strong", snap: true, radius: 32 },
] as const;

export type SnapPresetId = (typeof SNAP_PRESETS)[number]["id"] | "custom";

export function getActiveSnapPresetId(snapToGeometry: boolean, snapRadiusPx: number): SnapPresetId {
  if (!snapToGeometry) return "off";
  const r = Math.round(snapRadiusPx);
  const hit = SNAP_PRESETS.find((p) => p.snap && p.radius === r);
  return hit ? hit.id : "custom";
}
