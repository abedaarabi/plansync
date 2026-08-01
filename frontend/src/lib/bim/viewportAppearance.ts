/** Viewport appearance settings — environment, materials, fog, grid. */

export type BimEnvironmentPreset =
  | "cinematic"
  | "clear"
  | "overcast"
  | "golden_hour"
  | "dusk"
  | "twilight"
  | "studio"
  | "arctic"
  | "desert";

export type BimColorMode =
  | "ifc_priority"
  | "ifc_only"
  | "discipline"
  | "type_palette"
  | "monochrome"
  | "high_contrast"
  | "soft_pastel"
  | "technical";

export type BimSpaceDisplayMode =
  | "ifc_storey"
  | "uniform_blue"
  | "ifc_only"
  | "by_storey"
  | "subtle"
  | "vivid"
  | "hidden"
  | "outline";

export type BimFogMode = "auto" | "light" | "heavy" | "off";

export type BimGridMode = "show" | "fade_far" | "subtle" | "hide";

export type BimQualityPreset = "auto" | "low" | "medium" | "high" | "ultra";

export type BimBackgroundTheme =
  | "professional_dark"
  | "professional_light"
  | "white"
  | "transparent";

export type BimEdgeMode = "off" | "subtle" | "engineering";

export type BimGridSpacing = "auto" | "fine" | "standard" | "coarse";

export type BimNavigationSpeed = "slow" | "normal" | "fast";

export type BimViewportAppearance = {
  environment: BimEnvironmentPreset;
  backgroundTheme: BimBackgroundTheme;
  colorMode: BimColorMode;
  spaceDisplay: BimSpaceDisplayMode;
  fogMode: BimFogMode;
  gridMode: BimGridMode;
  gridSpacing: BimGridSpacing;
  gridAxes: boolean;
  qualityPreset: BimQualityPreset;
  ssaoEnabled: boolean;
  edgeMode: BimEdgeMode;
  navigationSpeed: BimNavigationSpeed;
};

export const DEFAULT_BIM_VIEWPORT_APPEARANCE: BimViewportAppearance = {
  environment: "cinematic",
  backgroundTheme: "professional_dark",
  colorMode: "ifc_priority",
  spaceDisplay: "subtle",
  fogMode: "off",
  gridMode: "subtle",
  gridSpacing: "auto",
  gridAxes: false,
  qualityPreset: "auto",
  ssaoEnabled: true,
  edgeMode: "subtle",
  navigationSpeed: "normal",
};

export type BimAppearanceOption<T extends string> = {
  id: T;
  label: string;
  hint?: string;
};

export const BIM_ENVIRONMENT_OPTIONS: BimAppearanceOption<BimEnvironmentPreset>[] = [
  { id: "cinematic", label: "Cinematic", hint: "Dark cool stage — modern game-engine look" },
  { id: "clear", label: "Clear sky", hint: "Bright daytime outdoor view" },
  { id: "overcast", label: "Overcast", hint: "Soft gray clouds, even diffuse light" },
  { id: "golden_hour", label: "Golden hour", hint: "Warm sunset tones on the horizon" },
  { id: "dusk", label: "Dusk", hint: "Deep blue sky with violet horizon glow" },
  { id: "twilight", label: "Twilight", hint: "Blue hour — cool ambient, low sun" },
  { id: "studio", label: "Studio neutral", hint: "Flat neutral backdrop for presentations" },
  { id: "arctic", label: "Arctic", hint: "Cold pale sky, crisp high-key lighting" },
  { id: "desert", label: "Desert sun", hint: "Warm haze, strong direct sunlight" },
];

export const BIM_BACKGROUND_THEME_OPTIONS: BimAppearanceOption<BimBackgroundTheme>[] = [
  {
    id: "professional_dark",
    label: "Professional dark",
    hint: "Low-glare neutral stage for long review sessions",
  },
  {
    id: "professional_light",
    label: "Professional light",
    hint: "Soft gray studio background with high readability",
  },
  { id: "white", label: "White", hint: "Clean presentation and print-like review" },
  {
    id: "transparent",
    label: "Transparent",
    hint: "Show the application surface behind the model",
  },
];

export const BIM_COLOR_MODE_OPTIONS: BimAppearanceOption<BimColorMode>[] = [
  { id: "ifc_priority", label: "IFC first", hint: "Model colors, then smart fallbacks" },
  { id: "ifc_only", label: "IFC only", hint: "Strict authored colors — grays stay gray" },
  { id: "discipline", label: "By discipline", hint: "Structure, MEP, arch palette" },
  { id: "type_palette", label: "By IFC type", hint: "Walls, slabs, ducts, etc." },
  { id: "monochrome", label: "Monochrome", hint: "Grayscale shading" },
  { id: "high_contrast", label: "High contrast", hint: "Bold saturated discipline colors" },
  { id: "soft_pastel", label: "Soft pastel", hint: "Muted presentation tones" },
  { id: "technical", label: "Technical", hint: "Neutral shell, colored systems only" },
];

export const BIM_SPACE_DISPLAY_OPTIONS: BimAppearanceOption<BimSpaceDisplayMode>[] = [
  { id: "ifc_storey", label: "IFC + level hue", hint: "Space color with storey tint" },
  { id: "uniform_blue", label: "Uniform blue", hint: "Classic BIM space fill" },
  { id: "ifc_only", label: "IFC space color", hint: "No fallback tint" },
  { id: "by_storey", label: "By level", hint: "Strong color per building storey" },
  { id: "subtle", label: "Subtle", hint: "Low-opacity space volumes" },
  { id: "vivid", label: "Vivid", hint: "Higher opacity for zone review" },
  { id: "hidden", label: "Hidden", hint: "Hide space volumes" },
  { id: "outline", label: "Outline hint", hint: "Very faint fill, emissive edge" },
];

export const BIM_FOG_MODE_OPTIONS: BimAppearanceOption<BimFogMode>[] = [
  { id: "auto", label: "Auto", hint: "Scales with model size and camera height" },
  { id: "light", label: "Light haze", hint: "Minimal depth fade" },
  { id: "heavy", label: "Heavy atmosphere", hint: "Stronger distance fade" },
  { id: "off", label: "Off", hint: "No fog" },
];

export const BIM_GRID_MODE_OPTIONS: BimAppearanceOption<BimGridMode>[] = [
  { id: "show", label: "Show grid", hint: "Standard ground reference" },
  { id: "fade_far", label: "Fade at distance", hint: "Long-range grid fade" },
  { id: "subtle", label: "Subtle", hint: "Low-contrast grid lines" },
  { id: "hide", label: "Hidden", hint: "No ground grid" },
];

export const BIM_GRID_SPACING_OPTIONS: BimAppearanceOption<BimGridSpacing>[] = [
  { id: "auto", label: "Automatic", hint: "Scale spacing to the loaded model" },
  { id: "fine", label: "Fine", hint: "Dense reference grid for detailed coordination" },
  { id: "standard", label: "Standard", hint: "Balanced engineering grid" },
  { id: "coarse", label: "Coarse", hint: "Large-scale site and campus reference" },
];

export const BIM_QUALITY_PRESET_OPTIONS: BimAppearanceOption<BimQualityPreset>[] = [
  { id: "auto", label: "Automatic", hint: "Adapts effects to the device and live frame time" },
  { id: "low", label: "Low", hint: "MSAA only; ambient occlusion and shadows disabled" },
  { id: "medium", label: "Medium", hint: "Ambient occlusion with efficient edge smoothing" },
  { id: "high", label: "High", hint: "Ambient occlusion, SMAA, and soft shadows when supported" },
  { id: "ultra", label: "Ultra", hint: "Highest idle-frame quality on capable desktop GPUs" },
];

export const BIM_EDGE_MODE_OPTIONS: BimAppearanceOption<BimEdgeMode>[] = [
  { id: "off", label: "Off", hint: "Pure shaded materials" },
  { id: "subtle", label: "Subtle", hint: "Thin low-contrast geometry definition" },
  { id: "engineering", label: "Engineering", hint: "Stronger technical edges for dense models" },
];

export const BIM_NAVIGATION_SPEED_OPTIONS: BimAppearanceOption<BimNavigationSpeed>[] = [
  {
    id: "slow",
    label: "Slow",
    hint: "Gentle orbit, pan, and zoom for precise review",
  },
  {
    id: "normal",
    label: "Normal",
    hint: "Balanced navigation with smooth damping",
  },
  {
    id: "fast",
    label: "Fast",
    hint: "Snappy camera for rapid model traversal",
  },
];

export function mergeViewportAppearance(
  base: BimViewportAppearance,
  patch: Partial<BimViewportAppearance>,
): BimViewportAppearance {
  return { ...base, ...patch };
}
