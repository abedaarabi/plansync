"use client";

import { GlassDock } from "@/components/viewer-chrome/GlassDock";
import type { ReactNode } from "react";

export function BimGlassDock(props: {
  side: "left" | "right";
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /**
   * When false, outside clicks reach the 3D viewer and do not close the dock
   * (e.g. properties stays open while selecting another element). Default true.
   */
  closeOnOutsideClick?: boolean;
  children: ReactNode;
}) {
  return <GlassDock tone="bim" movable {...props} />;
}
