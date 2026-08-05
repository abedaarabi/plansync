import * as THREE from "three";

/** Large IFC models are usually mm; smaller bounds suggest metres. */
export function detectModelUnitsFromRadius(radius: number | null | undefined): "m" | "mm" {
  if (radius == null || !Number.isFinite(radius)) return "m";
  return radius > 500 ? "mm" : "m";
}

// fallow-ignore-next-line complexity
export function isValidBox3(box: THREE.Box3 | null | undefined): box is THREE.Box3 {
  if (!box || box.isEmpty()) return false;
  const { min, max } = box;
  return (
    Number.isFinite(min.x) &&
    Number.isFinite(min.y) &&
    Number.isFinite(min.z) &&
    Number.isFinite(max.x) &&
    Number.isFinite(max.y) &&
    Number.isFinite(max.z) &&
    min.x <= max.x &&
    min.y <= max.y &&
    min.z <= max.z
  );
}

/** Standing eye height in model units (metres or millimetres). */
export function walkEyeHeight(box: THREE.Box3, units: "m" | "mm"): number {
  if (!isValidBox3(box)) {
    return units === "mm" ? 1700 : 1.7;
  }
  const size = box.getSize(new THREE.Vector3());
  if (units === "mm") {
    return THREE.MathUtils.clamp(size.y * 0.05, 1400, 2100);
  }
  return THREE.MathUtils.clamp(size.y * 0.05, 1.4, 2.1);
}

// fallow-ignore-next-line complexity
export function walkFeetInset(clampBox: THREE.Box3, units: "m" | "mm"): number {
  const minInset = units === "mm" ? 250 : 0.25;
  if (!isValidBox3(clampBox)) return minInset;
  const size = clampBox.getSize(new THREE.Vector3());
  const span = Math.min(Math.abs(size.x), Math.abs(size.z));
  if (!Number.isFinite(span) || span <= 0) return minInset;
  return Math.max(span * 0.02, minInset);
}

/** Resolve walkable floor elevation (fragments are not THREE.Raycaster-safe). */
// fallow-ignore-next-line complexity
export function findWalkFloorY(
  hintY: number,
  modelBox: THREE.Box3 | null,
  storeyFloorY: number | null,
): number {
  if (storeyFloorY != null && Number.isFinite(storeyFloorY)) {
    return storeyFloorY;
  }
  if (Number.isFinite(hintY)) return hintY;
  if (isValidBox3(modelBox)) return modelBox.min.y;
  return 0;
}

/** Place walk camera on the model floor near the orbit pivot (or bbox center). */
// fallow-ignore-next-line complexity
export function clampWalkEyePosition(opts: {
  pivot: THREE.Vector3;
  modelBox: THREE.Box3;
  eyeHeight: number;
  footprintBox?: THREE.Box3;
  units: "m" | "mm";
  storeyFloorY: number | null;
}): THREE.Vector3 {
  const { pivot, modelBox, units, storeyFloorY } = opts;
  const footprintBox = opts.footprintBox ?? modelBox;
  const clampBox = isValidBox3(footprintBox)
    ? footprintBox
    : isValidBox3(modelBox)
      ? modelBox
      : null;

  let x = pivot.x;
  let z = pivot.z;
  if (clampBox) {
    const inset = walkFeetInset(clampBox, units);
    const center = clampBox.getCenter(new THREE.Vector3());
    const loX = Math.min(clampBox.min.x + inset, clampBox.max.x - inset);
    const hiX = Math.max(clampBox.min.x + inset, clampBox.max.x - inset);
    const loZ = Math.min(clampBox.min.z + inset, clampBox.max.z - inset);
    const hiZ = Math.max(clampBox.min.z + inset, clampBox.max.z - inset);
    x = Number.isFinite(pivot.x) ? THREE.MathUtils.clamp(pivot.x, loX, hiX) : center.x;
    z = Number.isFinite(pivot.z) ? THREE.MathUtils.clamp(pivot.z, loZ, hiZ) : center.z;
  }

  const hintY = Number.isFinite(pivot.y) ? pivot.y : isValidBox3(modelBox) ? modelBox.min.y : 0;
  const floorY = findWalkFloorY(hintY, modelBox, storeyFloorY);
  const safeEyeHeight = Number.isFinite(opts.eyeHeight)
    ? opts.eyeHeight
    : walkEyeHeight(modelBox, units);
  return new THREE.Vector3(x, floorY + safeEyeHeight, z);
}

/** Match IFC storey key from source/display name or alias. */
// fallow-ignore-next-line complexity
export function resolveStoreyName(
  name: string | null | undefined,
  storeyKeys: Iterable<string>,
): string | null {
  if (!name) return null;
  const keys = [...storeyKeys];
  if (keys.includes(name)) return name;
  const lower = name.toLowerCase();
  for (const key of keys) {
    if (key.toLowerCase() === lower) return key;
  }
  for (const key of keys) {
    const kl = key.toLowerCase();
    if (kl.includes(lower) || lower.includes(kl)) return key;
  }
  return null;
}
