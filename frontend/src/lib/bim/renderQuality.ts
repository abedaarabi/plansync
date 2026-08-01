import type { BimQualityPreset } from "@/lib/bim/viewportAppearance";

export type BimEffectiveQuality = Exclude<BimQualityPreset, "auto">;

export type BimGpuProfile = {
  deviceMemoryGb: number | null;
  coarsePointer: boolean;
  maxSamples: number;
  maxTextureSize: number;
  modelCount: number;
};

export type BimQualityState = {
  requested: BimQualityPreset;
  effective: BimEffectiveQuality;
  reason: string;
  interactionReduced: boolean;
};

const QUALITY_ORDER: BimEffectiveQuality[] = ["low", "medium", "high", "ultra"];

function qualityIndex(quality: BimEffectiveQuality): number {
  return QUALITY_ORDER.indexOf(quality);
}

function lowerQuality(quality: BimEffectiveQuality): BimEffectiveQuality {
  return QUALITY_ORDER[Math.max(0, qualityIndex(quality) - 1)]!;
}

export function resolveInitialBimQuality(
  requested: BimQualityPreset,
  profile: BimGpuProfile,
): BimQualityState {
  if (requested !== "auto") {
    return {
      requested,
      effective: requested,
      reason: "Selected preset",
      interactionReduced: false,
    };
  }

  if (
    profile.coarsePointer ||
    (profile.deviceMemoryGb != null && profile.deviceMemoryGb <= 4) ||
    profile.maxTextureSize < 8192
  ) {
    return {
      requested,
      effective: "medium",
      reason: "Balanced for this device",
      interactionReduced: false,
    };
  }

  if (
    profile.maxSamples >= 4 &&
    profile.maxTextureSize >= 16384 &&
    profile.modelCount <= 2 &&
    (profile.deviceMemoryGb == null || profile.deviceMemoryGb >= 8)
  ) {
    return {
      requested,
      effective: "high",
      reason: "High-quality desktop profile",
      interactionReduced: false,
    };
  }

  return {
    requested,
    effective: "medium",
    reason: "Balanced GPU profile",
    interactionReduced: false,
  };
}

/**
 * Small hysteresis controller for the on-demand renderer. It reacts quickly to
 * sustained slow interaction and only restores the preferred tier after rest.
 */
export class BimAdaptiveQualityController {
  private preferred: BimQualityState;
  private state: BimQualityState;
  private slowFrames = 0;

  constructor(requested: BimQualityPreset, profile: BimGpuProfile) {
    this.preferred = resolveInitialBimQuality(requested, profile);
    this.state = { ...this.preferred };
  }

  get current(): BimQualityState {
    return { ...this.state };
  }

  updatePreference(requested: BimQualityPreset, profile: BimGpuProfile): BimQualityState {
    this.preferred = resolveInitialBimQuality(requested, profile);
    this.state = { ...this.preferred };
    this.slowFrames = 0;
    return this.current;
  }

  observeInteractionFrame(frameMs: number): BimQualityState | null {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return null;
    this.slowFrames = frameMs > 24 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    if (this.slowFrames < 8 || this.state.effective === "low") return null;

    this.slowFrames = 0;
    this.state = {
      ...this.state,
      effective: lowerQuality(this.state.effective),
      reason: "Reduced to maintain smooth navigation",
      interactionReduced: true,
    };
    return this.current;
  }

  restoreAfterInteraction(): BimQualityState | null {
    this.slowFrames = 0;
    if (
      this.state.effective === this.preferred.effective &&
      this.state.interactionReduced === false
    ) {
      return null;
    }
    this.state = { ...this.preferred };
    return this.current;
  }
}

export function bimQualityPixelRatio(
  quality: BimEffectiveQuality,
  devicePixelRatio: number,
): number {
  const cap: Record<BimEffectiveQuality, number> = {
    low: 1,
    medium: 1.35,
    high: 1.75,
    ultra: 2,
  };
  return Math.min(Math.max(devicePixelRatio, 1), cap[quality]);
}
