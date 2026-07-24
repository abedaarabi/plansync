/**
 * IFC Viewer color system — single source of truth.
 * Do not invent colors outside this palette.
 */

export const BIM_PALETTE = {
  canvas: {
    background: "#0F172A",
  },

  materials: {
    wall: "#D4D4D8",
    floor: "#BFC5CC",
    column: "#C8CDD4",
    ceiling: "#E5E7EB",
    door: "#A8B1BB",
    glass: "#7DD3FC",
    glassOpacity: 0.2,
  },

  mep: {
    hvac: "#60A5FA",
    plumbing: "#22C55E",
    electrical: "#FACC15",
    fire: "#EF4444",
    communication: "#A78BFA",
  },

  viewer: {
    grid: "#334155",
    gridOpacity: 0.18,
    axisX: "#EF4444",
    axisY: "#22C55E",
    axisZ: "#3B82F6",
  },

  interaction: {
    selectedOutline: "#3B82F6",
    selectedGlow: "rgba(59,130,246,0.35)",
    selectedGlowOpacity: 0.35,
    hoveredOutline: "#60A5FA",
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
    ambient: 0.9,
    directional: 1.2,
  },
} as const;
