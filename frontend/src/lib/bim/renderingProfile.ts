import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import type { BimEnvironmentPreset, BimFogMode } from "@/lib/bim/viewportAppearance";

/** Bump when IFC → Fragments conversion settings change (invalidates IndexedDB cache). */
export const BIM_RENDER_PROFILE_VERSION = 2;

export const BIM_GEOMETRY_PROFILE = "LOD 500" as const;

export type BimViewportPreset = {
  id: BimEnvironmentPreset;
  label: string;
  bgZenith: string;
  bgUpper: string;
  bgMid: string;
  bgHorizon: string;
  bgHaze: string;
  container: string;
  fog: string;
  grid: string;
  sun: string;
  sunIntensity: number;
  ambient: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  rim: string;
  rimIntensity: number;
  exposure: number;
  fogNearScale: number;
  fogFarScale: number;
  horizonGlow: [number, number, number];
};

const BIM_SKY_PRESETS: Record<BimEnvironmentPreset, BimViewportPreset> = {
  clear: {
    id: "clear",
    label: "Clear sky",
    bgZenith: "#2569a8",
    bgUpper: "#4a90c8",
    bgMid: "#78b4dc",
    bgHorizon: "#b9daf1",
    bgHaze: "#e8f4fc",
    container: "#e8f4fc",
    fog: "#c5e0f2",
    grid: "#8bb8d4",
    sun: "#fff4e6",
    sunIntensity: 1.52,
    ambient: "#e8f2fa",
    ambientIntensity: 0.58,
    hemiSky: "#a8d0ef",
    hemiGround: "#e0eef8",
    hemiIntensity: 0.52,
    rim: "#d4ecff",
    rimIntensity: 0.3,
    exposure: 1.08,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [255, 248, 236],
  },
  overcast: {
    id: "overcast",
    label: "Overcast",
    bgZenith: "#5c6b7a",
    bgUpper: "#7a8a99",
    bgMid: "#9aa8b5",
    bgHorizon: "#c5ced6",
    bgHaze: "#dce3ea",
    container: "#dce3ea",
    fog: "#b8c4ce",
    grid: "#94a3b0",
    sun: "#f1f5f9",
    sunIntensity: 0.95,
    ambient: "#eef2f6",
    ambientIntensity: 0.72,
    hemiSky: "#cbd5e1",
    hemiGround: "#e2e8f0",
    hemiIntensity: 0.58,
    rim: "#f8fafc",
    rimIntensity: 0.18,
    exposure: 0.98,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [241, 245, 249],
  },
  golden_hour: {
    id: "golden_hour",
    label: "Golden hour",
    bgZenith: "#4a6a8a",
    bgUpper: "#7a8cb0",
    bgMid: "#c4a882",
    bgHorizon: "#f0c987",
    bgHaze: "#fdecd3",
    container: "#fdecd3",
    fog: "#e8c896",
    grid: "#c9a66b",
    sun: "#ffedd5",
    sunIntensity: 1.35,
    ambient: "#fff7ed",
    ambientIntensity: 0.52,
    hemiSky: "#fcd9a8",
    hemiGround: "#f5e6d0",
    hemiIntensity: 0.48,
    rim: "#ffe4b5",
    rimIntensity: 0.35,
    exposure: 1.12,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [255, 220, 160],
  },
  dusk: {
    id: "dusk",
    label: "Dusk",
    bgZenith: "#1e3a5f",
    bgUpper: "#3d5a80",
    bgMid: "#7b6b8a",
    bgHorizon: "#c4846c",
    bgHaze: "#e8b4a0",
    container: "#e8b4a0",
    fog: "#9aabb8",
    grid: "#7a8a99",
    sun: "#ffd4a3",
    sunIntensity: 1.1,
    ambient: "#4a5568",
    ambientIntensity: 0.65,
    hemiSky: "#8899aa",
    hemiGround: "#6b7280",
    hemiIntensity: 0.45,
    rim: "#f0c987",
    rimIntensity: 0.28,
    exposure: 1.05,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [255, 180, 140],
  },
  twilight: {
    id: "twilight",
    label: "Twilight",
    bgZenith: "#0f2847",
    bgUpper: "#1e4976",
    bgMid: "#4a6fa5",
    bgHorizon: "#8bafd4",
    bgHaze: "#b8d4e8",
    container: "#b8d4e8",
    fog: "#7a9cb8",
    grid: "#6b8aa8",
    sun: "#dbeafe",
    sunIntensity: 0.85,
    ambient: "#64748b",
    ambientIntensity: 0.68,
    hemiSky: "#93c5fd",
    hemiGround: "#475569",
    hemiIntensity: 0.5,
    rim: "#bfdbfe",
    rimIntensity: 0.22,
    exposure: 0.95,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [147, 197, 253],
  },
  studio: {
    id: "studio",
    label: "Studio neutral",
    bgZenith: "#e2e8f0",
    bgUpper: "#eef2f6",
    bgMid: "#f1f5f9",
    bgHorizon: "#f8fafc",
    bgHaze: "#ffffff",
    container: "#f8fafc",
    fog: "#e2e8f0",
    grid: "#cbd5e1",
    sun: "#ffffff",
    sunIntensity: 1.25,
    ambient: "#f8fafc",
    ambientIntensity: 0.75,
    hemiSky: "#ffffff",
    hemiGround: "#f1f5f9",
    hemiIntensity: 0.55,
    rim: "#ffffff",
    rimIntensity: 0.15,
    exposure: 1.0,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [248, 250, 252],
  },
  arctic: {
    id: "arctic",
    label: "Arctic",
    bgZenith: "#5b8fb9",
    bgUpper: "#8cb4d4",
    bgMid: "#b8d4e8",
    bgHorizon: "#dceef8",
    bgHaze: "#f0f9ff",
    container: "#f0f9ff",
    fog: "#c5e0f2",
    grid: "#9ec5dd",
    sun: "#ffffff",
    sunIntensity: 1.65,
    ambient: "#f0f9ff",
    ambientIntensity: 0.62,
    hemiSky: "#e0f2fe",
    hemiGround: "#f8fafc",
    hemiIntensity: 0.54,
    rim: "#ffffff",
    rimIntensity: 0.35,
    exposure: 1.15,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [224, 242, 254],
  },
  desert: {
    id: "desert",
    label: "Desert sun",
    bgZenith: "#6b8cae",
    bgUpper: "#c4a574",
    bgMid: "#e8c896",
    bgHorizon: "#f5deb3",
    bgHaze: "#fef3c7",
    container: "#fef3c7",
    fog: "#e8c896",
    grid: "#d4a574",
    sun: "#fffbeb",
    sunIntensity: 1.75,
    ambient: "#fef9c3",
    ambientIntensity: 0.5,
    hemiSky: "#fde68a",
    hemiGround: "#f5e6d0",
    hemiIntensity: 0.46,
    rim: "#fff7ed",
    rimIntensity: 0.32,
    exposure: 1.1,
    fogNearScale: 1,
    fogFarScale: 1,
    horizonGlow: [255, 237, 180],
  },
};

/** Active preset defaults — use {@link getViewportColors}. */
export const BIM_VIEWPORT = BIM_SKY_PRESETS.clear;

/** Matches `--bim-accent` in globals.css */
export const BIM_ACCENT = "#2563eb";
const BIM_ACCENT_HOVER = "#3b82f6";

/** Selection / pre-select hover — aligned with app accent. */
export const BIM_SELECTION = {
  fill: BIM_ACCENT,
  fillOpacity: 0.48,
  hover: BIM_ACCENT_HOVER,
  hoverOpacity: 0.26,
} as const;

export function getViewportColors(preset: BimEnvironmentPreset = "clear"): BimViewportPreset {
  return BIM_SKY_PRESETS[preset];
}

/** Procedural sky gradient with a soft warm horizon band. */
export function createBimSkyTexture(preset: BimEnvironmentPreset = "clear"): THREE.CanvasTexture {
  const colors = getViewportColors(preset);
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, colors.bgZenith);
    sky.addColorStop(0.28, colors.bgUpper);
    sky.addColorStop(0.52, colors.bgMid);
    sky.addColorStop(0.78, colors.bgHorizon);
    sky.addColorStop(1, colors.bgHaze);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const [r, g, b] = colors.horizonGlow;
    const glow = ctx.createLinearGradient(0, canvas.height * 0.68, 0, canvas.height);
    glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
    glow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.16)`);
    glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.32)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Fog color blended toward horizon when camera is above the model. */
export function resolveFogColor(
  preset: BimEnvironmentPreset,
  sphere: THREE.Sphere,
  camera: THREE.Camera,
): THREE.Color {
  const colors = getViewportColors(preset);
  const fog = new THREE.Color(colors.fog);
  const haze = new THREE.Color(colors.bgHaze);
  if (
    !(camera instanceof THREE.PerspectiveCamera) &&
    !(camera instanceof THREE.OrthographicCamera)
  ) {
    return fog;
  }
  const elev = (camera.position.y - sphere.center.y) / Math.max(sphere.radius, 1);
  if (elev > 0.15) {
    fog.lerp(haze, Math.min(0.45, elev * 0.35));
  }
  return fog;
}

/** Fog distance multipliers for appearance fog mode. */
export function fogDistanceScales(mode: BimFogMode): { near: number; far: number } | null {
  switch (mode) {
    case "off":
      return null;
    case "light":
      return { near: 1.6, far: 1.45 };
    case "heavy":
      return { near: 0.55, far: 0.62 };
    default:
      return { near: 1, far: 1 };
  }
}

/** Semi-transparent fill fallback for IfcSpace volumes. */
export const BIM_SPACE_MATERIAL = {
  color: "#4d9de0",
  opacity: 0.24,
} as const;

/** High-detail IFC → Fragments conversion (full tessellation, space boundaries). */
export function configureLod500Importer(importer: FRAGS.IfcImporter): void {
  Object.assign(importer.geometryProcessSettings, {
    threshold: 10_000,
    precision: 1e8,
    normalPrecision: 1e9,
    planePrecision: 1e6,
    faceThreshold: 0.45,
    forceTransparentSpaces: true,
    processIfcRelSpaceBoundarySecondLevel: true,
  });
  importer.doubleSidedMaterials = true;
}
