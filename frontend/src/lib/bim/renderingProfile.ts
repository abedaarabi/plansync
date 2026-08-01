import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import { BIM_PALETTE } from "@/lib/bim/bimPalette";
import type {
  BimBackgroundTheme,
  BimEnvironmentPreset,
  BimFogMode,
} from "@/lib/bim/viewportAppearance";

/** Bump when IFC → Fragments conversion settings change (invalidates IndexedDB cache). */
export const BIM_RENDER_PROFILE_VERSION = 2;

export const BIM_GEOMETRY_PROFILE = "LOD 500" as const;

const {
  canvas: CANVAS,
  viewer: VIEWER,
  ui: UI,
  status: STATUS,
  interaction: INTERACTION,
  lighting: LIGHTING,
  materials: MAT,
} = BIM_PALETTE;

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

export type BimBackgroundProfile = {
  top: string;
  middle: string;
  bottom: string;
  container: string;
  horizonGlow: [number, number, number];
};

/** Default enterprise stage — palette colors only. */
const CINEMATIC_PRESET: BimViewportPreset = {
  id: "cinematic",
  label: "Cinematic",
  bgZenith: CANVAS.background,
  bgUpper: CANVAS.background,
  bgMid: UI.panel,
  bgHorizon: UI.panelSecondary,
  bgHaze: CANVAS.background,
  container: CANVAS.background,
  fog: UI.panelSecondary,
  grid: VIEWER.grid,
  sun: MAT.ceiling,
  sunIntensity: 1.55,
  ambient: UI.textMuted,
  ambientIntensity: 0.32,
  hemiSky: UI.textSecondary,
  hemiGround: UI.panel,
  hemiIntensity: 0.45,
  rim: UI.disabled,
  rimIntensity: 0.22,
  exposure: 1.0,
  fogNearScale: 1.15,
  fogFarScale: 1.1,
  horizonGlow: [17, 24, 39],
};

const BIM_SKY_PRESETS: Record<BimEnvironmentPreset, BimViewportPreset> = {
  cinematic: CINEMATIC_PRESET,
  clear: {
    ...CINEMATIC_PRESET,
    id: "clear",
    label: "Clear sky",
    bgZenith: STATUS.primary,
    bgUpper: INTERACTION.hoveredOutline,
    bgMid: MAT.glass,
    bgHorizon: MAT.ceiling,
    bgHaze: UI.textPrimary,
    container: UI.panelSecondary,
    fog: UI.disabled,
    sun: MAT.ceiling,
    sunIntensity: LIGHTING.directional,
    ambient: UI.textSecondary,
    ambientIntensity: LIGHTING.ambient,
    hemiSky: MAT.glass,
    hemiGround: MAT.floor,
    hemiIntensity: 0.4,
    rim: STATUS.information,
    rimIntensity: 0.2,
    horizonGlow: [125, 211, 252],
  },
  overcast: {
    ...CINEMATIC_PRESET,
    id: "overcast",
    label: "Overcast",
    bgZenith: UI.border,
    bgUpper: UI.disabled,
    bgMid: UI.textMuted,
    bgHorizon: MAT.floor,
    bgHaze: MAT.ceiling,
    container: UI.panelSecondary,
    fog: UI.disabled,
    sun: MAT.ceiling,
    sunIntensity: LIGHTING.directional * 0.85,
    ambient: UI.textSecondary,
    ambientIntensity: LIGHTING.ambient,
    hemiSky: UI.textMuted,
    hemiGround: MAT.floor,
    hemiIntensity: 0.45,
    rim: MAT.ceiling,
    rimIntensity: 0.16,
    horizonGlow: [191, 197, 204],
  },
  golden_hour: {
    ...CINEMATIC_PRESET,
    id: "golden_hour",
    label: "Golden hour",
    bgZenith: UI.panel,
    bgUpper: STATUS.warning,
    bgMid: STATUS.warning,
    bgHorizon: MAT.ceiling,
    bgHaze: UI.panelSecondary,
    container: CANVAS.background,
    fog: UI.panelSecondary,
    sun: MAT.ceiling,
    sunIntensity: LIGHTING.directional,
    ambient: UI.textMuted,
    ambientIntensity: LIGHTING.ambient * 0.85,
    hemiSky: STATUS.warning,
    hemiGround: UI.panel,
    hemiIntensity: 0.4,
    rim: STATUS.warning,
    rimIntensity: 0.28,
    horizonGlow: [245, 158, 11],
  },
  dusk: {
    ...CINEMATIC_PRESET,
    id: "dusk",
    label: "Dusk",
    bgZenith: CANVAS.background,
    bgUpper: UI.panel,
    bgMid: STATUS.danger,
    bgHorizon: STATUS.warning,
    bgHaze: UI.panelSecondary,
    container: CANVAS.background,
    fog: UI.panelSecondary,
    sun: MAT.ceiling,
    sunIntensity: LIGHTING.directional * 0.9,
    ambient: UI.disabled,
    ambientIntensity: LIGHTING.ambient * 0.75,
    hemiSky: STATUS.primary,
    hemiGround: UI.panel,
    hemiIntensity: 0.38,
    rim: STATUS.warning,
    rimIntensity: 0.22,
    horizonGlow: [239, 68, 68],
  },
  twilight: {
    ...CINEMATIC_PRESET,
    id: "twilight",
    label: "Twilight",
    bgZenith: CANVAS.background,
    bgUpper: UI.panel,
    bgMid: STATUS.primary,
    bgHorizon: INTERACTION.hoveredOutline,
    bgHaze: UI.panelSecondary,
    container: CANVAS.background,
    fog: UI.panelSecondary,
    sun: MAT.glass,
    sunIntensity: LIGHTING.directional * 0.75,
    ambient: UI.disabled,
    ambientIntensity: LIGHTING.ambient * 0.8,
    hemiSky: STATUS.primary,
    hemiGround: UI.panel,
    hemiIntensity: 0.42,
    rim: MAT.glass,
    rimIntensity: 0.2,
    horizonGlow: [59, 130, 246],
  },
  studio: {
    ...CINEMATIC_PRESET,
    id: "studio",
    label: "Studio neutral",
    bgZenith: UI.panelSecondary,
    bgUpper: UI.border,
    bgMid: MAT.floor,
    bgHorizon: MAT.ceiling,
    bgHaze: MAT.wall,
    container: UI.panelSecondary,
    fog: MAT.floor,
    sun: MAT.ceiling,
    sunIntensity: LIGHTING.directional,
    ambient: UI.textSecondary,
    ambientIntensity: LIGHTING.ambient,
    hemiSky: MAT.ceiling,
    hemiGround: MAT.floor,
    hemiIntensity: 0.4,
    rim: MAT.wall,
    rimIntensity: 0.14,
    horizonGlow: [212, 212, 216],
  },
  arctic: {
    ...CINEMATIC_PRESET,
    id: "arctic",
    label: "Arctic",
    bgZenith: STATUS.primary,
    bgUpper: INTERACTION.hoveredOutline,
    bgMid: MAT.glass,
    bgHorizon: MAT.ceiling,
    bgHaze: UI.textPrimary,
    container: UI.panelSecondary,
    fog: MAT.glass,
    sun: MAT.ceiling,
    sunIntensity: LIGHTING.directional,
    ambient: UI.textSecondary,
    ambientIntensity: LIGHTING.ambient,
    hemiSky: MAT.glass,
    hemiGround: MAT.ceiling,
    hemiIntensity: 0.45,
    rim: MAT.ceiling,
    rimIntensity: 0.25,
    horizonGlow: [125, 211, 252],
  },
  desert: {
    ...CINEMATIC_PRESET,
    id: "desert",
    label: "Desert sun",
    bgZenith: UI.disabled,
    bgUpper: STATUS.warning,
    bgMid: STATUS.warning,
    bgHorizon: MAT.ceiling,
    bgHaze: MAT.wall,
    container: UI.panelSecondary,
    fog: STATUS.warning,
    sun: MAT.ceiling,
    sunIntensity: LIGHTING.directional,
    ambient: UI.textMuted,
    ambientIntensity: LIGHTING.ambient * 0.9,
    hemiSky: STATUS.warning,
    hemiGround: MAT.floor,
    hemiIntensity: 0.4,
    rim: MAT.ceiling,
    rimIntensity: 0.24,
    horizonGlow: [245, 158, 11],
  },
};

/** Active preset defaults — use {@link getViewportColors}. */
export const BIM_VIEWPORT = BIM_SKY_PRESETS.cinematic;

/** Matches `--bim-accent` in globals.css */
export const BIM_ACCENT = STATUS.primary;

/** Selection / hover — outline + soft glow from the interaction palette. */
export const BIM_SELECTION = {
  fill: INTERACTION.selectedOutline,
  fillOpacity: 0.2,
  hover: INTERACTION.hoveredOutline,
  hoverOpacity: 0.16,
  glow: INTERACTION.selectedGlow,
} as const;

const BIM_BACKGROUND_PROFILES: Record<BimBackgroundTheme, BimBackgroundProfile> = {
  professional_dark: {
    top: CANVAS.background,
    middle: UI.panel,
    bottom: UI.panelSecondary,
    container: CANVAS.background,
    horizonGlow: [17, 24, 39],
  },
  professional_light: {
    top: MAT.ceiling,
    middle: MAT.wall,
    bottom: MAT.floor,
    container: MAT.wall,
    horizonGlow: [200, 205, 210],
  },
  white: {
    top: UI.textPrimary,
    middle: UI.textPrimary,
    bottom: MAT.ceiling,
    container: UI.textPrimary,
    horizonGlow: [229, 231, 235],
  },
  transparent: {
    top: CANVAS.background,
    middle: CANVAS.background,
    bottom: CANVAS.background,
    container: CANVAS.background,
    horizonGlow: [15, 23, 42],
  },
};

export function getViewportColors(preset: BimEnvironmentPreset = "cinematic"): BimViewportPreset {
  return BIM_SKY_PRESETS[preset];
}

export function getBimBackgroundProfile(
  theme: BimBackgroundTheme = "professional_dark",
): BimBackgroundProfile {
  return BIM_BACKGROUND_PROFILES[theme];
}

/** Procedural neutral viewport gradient; lighting remains controlled by the environment preset. */
export function createBimSkyTexture(
  theme: BimBackgroundTheme = "professional_dark",
): THREE.CanvasTexture {
  const colors = getBimBackgroundProfile(theme);
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, colors.top);
    sky.addColorStop(0.48, colors.middle);
    sky.addColorStop(1, colors.bottom);
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
      // Start well past the model so normal zoom-out keeps colors intact.
      return { near: 4.2, far: 2.8 };
    case "heavy":
      return { near: 2.2, far: 1.6 };
    default:
      return { near: 3.2, far: 2.2 };
  }
}

/** Semi-transparent fill fallback for IfcSpace volumes. */
export const BIM_SPACE_MATERIAL = {
  color: STATUS.information,
  opacity: 0.16,
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
