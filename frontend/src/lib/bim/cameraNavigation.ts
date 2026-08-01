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

/** That Open defaults: smoothTime 0.2, rotate/dolly 1.0. Normal is calmer than stock. */
export const BIM_CAMERA_NAVIGATION_PROFILES: Record<
  BimNavigationSpeed,
  BimCameraNavigationProfile
> = {
  slow: {
    smoothTime: 0.42,
    draggingSmoothTime: 0.28,
    azimuthRotateSpeed: 0.55,
    polarRotateSpeed: 0.55,
    dollySpeed: 0.65,
    truckSpeed: 1.2,
    walkDollySpeed: 0.85,
    walkTruckSpeed: 34,
    walkSpeed: 1.6,
    viewCubeRotateSensitivity: 0.005,
    flyToSmoothTime: 0.65,
  },
  normal: {
    smoothTime: 0.32,
    draggingSmoothTime: 0.2,
    azimuthRotateSpeed: 0.78,
    polarRotateSpeed: 0.78,
    dollySpeed: 0.85,
    truckSpeed: 1.6,
    walkDollySpeed: 1.0,
    walkTruckSpeed: 50,
    walkSpeed: 2.2,
    viewCubeRotateSensitivity: 0.007,
    flyToSmoothTime: 0.48,
  },
  fast: {
    smoothTime: 0.2,
    draggingSmoothTime: 0.125,
    azimuthRotateSpeed: 1.0,
    polarRotateSpeed: 1.0,
    dollySpeed: 1.15,
    truckSpeed: 2.4,
    walkDollySpeed: 1.25,
    walkTruckSpeed: 66,
    walkSpeed: 3.0,
    viewCubeRotateSensitivity: 0.009,
    flyToSmoothTime: 0.3,
  },
};

export function getBimCameraNavigationProfile(
  speed: BimNavigationSpeed = "normal",
): BimCameraNavigationProfile {
  return BIM_CAMERA_NAVIGATION_PROFILES[speed] ?? BIM_CAMERA_NAVIGATION_PROFILES.normal;
}
