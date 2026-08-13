"use client";

import type { ReactNode } from "react";

type LandingScreenDepthProps = {
  children: ReactNode;
  className?: string;
  /** Stronger tilt for hero; flatter for dense dashboards */
  intensity?: "hero" | "panel";
};

/**
 * Perspective depth stack behind product UI screens —
 * layered ghost frames + ambient glow (CSS only, reduced-motion safe).
 */
export function LandingScreenDepth({
  children,
  className = "",
  intensity = "panel",
}: LandingScreenDepthProps) {
  const isHero = intensity === "hero";

  return (
    <div
      className={`landing-screen-depth relative ${isHero ? "landing-screen-depth-hero" : ""} ${className}`.trim()}
    >
      <div className="landing-screen-depth-scene" aria-hidden>
        <span className="landing-screen-depth-glow" />
        <span className="landing-screen-depth-layer landing-screen-depth-layer-3" />
        <span className="landing-screen-depth-layer landing-screen-depth-layer-2" />
        <span className="landing-screen-depth-layer landing-screen-depth-layer-1" />
        <span className="landing-screen-depth-grid" />
      </div>
      <div className="landing-screen-depth-front relative z-10">{children}</div>
    </div>
  );
}
