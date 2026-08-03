"use client";

import { IconRail, type ChromeRailItem } from "@/components/viewer-chrome/IconRail";
import type { ReactNode } from "react";

export type ViewerRailItem = ChromeRailItem;

export function ViewerIconRail(props: {
  side: "left" | "right";
  header?: ReactNode;
  sections: ViewerRailItem[][];
  activeId: string | null;
  modeId?: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
  liftForBottomChrome?: boolean;
}) {
  return <IconRail tone="viewer" showTooltips {...props} />;
}
