import type { BimNavigationSpeed } from "@/lib/bim/viewportAppearance";

export type BimCameraNavigationProfile = {
  smoothTime: number;
  draggingSmoothTime: number;
  azimuthRotateSpeed: number;
  polarRotateSpeed: number;
  dollySpeed: number;
  truckSpeed: number;
  walkDollySpeed: number;
  walkTruckSpeed: number;
  walkSpeed: number;
  viewCubeRotateSensitivity: number;
  flyToSmoothTime: number;
};

/** That Open defaults: smoothTime 0.2, rotate/dolly 1.0, truck 2.0. Normal stays calm. */
export const BIM_CAMERA_NAVIGATION_PROFILES: Record<
  BimNavigationSpeed,
  BimCameraNavigationProfile
> = {
  slow: {
    smoothTime: 0.45,
    draggingSmoothTime: 0.3,
    azimuthRotateSpeed: 0.48,
    polarRotateSpeed: 0.48,
    dollySpeed: 0.55,
    truckSpeed: 0.85,
    walkDollySpeed: 0.8,
    walkTruckSpeed: 30,
    walkSpeed: 1.5,
    viewCubeRotateSensitivity: 0.0045,
    flyToSmoothTime: 0.65,
  },
  normal: {
    smoothTime: 0.38,
    draggingSmoothTime: 0.24,
    azimuthRotateSpeed: 0.58,
    polarRotateSpeed: 0.58,
    dollySpeed: 0.65,
    truckSpeed: 1.0,
    walkDollySpeed: 0.9,
    walkTruckSpeed: 40,
    walkSpeed: 1.85,
    viewCubeRotateSensitivity: 0.0055,
    flyToSmoothTime: 0.55,
  },
  fast: {
    smoothTime: 0.22,
    draggingSmoothTime: 0.14,
    azimuthRotateSpeed: 0.9,
    polarRotateSpeed: 0.9,
    dollySpeed: 1.05,
    truckSpeed: 1.8,
    walkDollySpeed: 1.2,
    walkTruckSpeed: 60,
    walkSpeed: 2.8,
    viewCubeRotateSensitivity: 0.008,
    flyToSmoothTime: 0.32,
  },
};

export function getBimCameraNavigationProfile(
  speed: BimNavigationSpeed = "normal",
): BimCameraNavigationProfile {
  return BIM_CAMERA_NAVIGATION_PROFILES[speed] ?? BIM_CAMERA_NAVIGATION_PROFILES.normal;
}
