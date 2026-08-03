"use client";

import { GlassDock } from "@/components/viewer-chrome/GlassDock";
import type { ReactNode } from "react";

export function ViewerGlassDock(props: {
  side: "left" | "right";
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeOnOutsideClick?: boolean;
  liftForBottomChrome?: boolean;
  children: ReactNode;
}) {
  return <GlassDock tone="viewer" {...props} />;
}
