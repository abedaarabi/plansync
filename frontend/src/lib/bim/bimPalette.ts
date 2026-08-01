/**
 * IFC Viewer color system — single source of truth.
 * Do not invent colors outside this palette.
 */

export const BIM_PALETTE = {
  canvas: {
    background: "#0F172A",
  },

  materials: {
    concrete: "#C8CDD2",
    steel: "#737B84",
    aluminum: "#AAB2B9",
    wood: "#9A7658",
    wall: "#D0D3D6",
    floor: "#B8BEC4",
    column: "#858D95",
    ceiling: "#DADDE0",
    door: "#9A7658",
    glass: "#A9C7D2",
    glassOpacity: 0.24,
  },

  mep: {
    hvac: "#6F95AC",
    plumbing: "#668E78",
    electrical: "#C8874A",
    fire: "#B95252",
    communication: "#817A9C",
  },

  viewer: {
    grid: "#334155",
    gridOpacity: 0.18,
    axisX: "#EF4444",
    axisY: "#22C55E",
    axisZ: "#3B82F6",
  },

  interaction: {
    selectedOutline: "#4F8FD7",
    selectedGlow: "rgba(59,130,246,0.35)",
    selectedGlowOpacity: 0.35,
    hoveredOutline: "#78A9D8",
    hiddenOpacity: 0.08,
    nonSelectedOpacity: 0.12,
    sectionPlane: "#06B6D4",
    sectionPlaneOpacity: 0.25,
  },

  status: {
    primary: "#3B82F6",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    information: "#06B6D4",
  },

  ui: {
    panel: "#111827",
    panelSecondary: "#1F2937",
    border: "#374151",
    textPrimary: "#F9FAFB",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    icon: "#CBD5E1",
    disabled: "#64748B",
  },

  lighting: {
    ambient: 0.62,
    directional: 2.2,
  },
} as const;
