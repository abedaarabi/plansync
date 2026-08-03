import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Crosshair,
  EyeOff,
  HelpCircle,
  Link2,
  MessageSquare,
  MousePointerClick,
  Move3d,
  Navigation,
  Redo2,
  Ruler,
  ScanSearch,
  Undo2,
  X,
  Zap,
} from "lucide-react";

export type BimShortcutRow = {
  action: string;
  icon: LucideIcon;
  keys: string[];
  keyJoin?: "combo" | "or";
};

export type BimShortcutSection = {
  title: string;
  icon: LucideIcon;
  rows: BimShortcutRow[];
};

/** Single source of truth for 3D viewer shortcut help (panel + overlay). */
export const BIM_SHORTCUT_SECTIONS: BimShortcutSection[] = [
  {
    title: "Selection",
    icon: MousePointerClick,
    rows: [
      { keys: ["H"], action: "Hide selected object", icon: EyeOff },
      { keys: ["Space"], action: "Zoom to selected object", icon: ScanSearch },
      {
        keys: ["Ctrl", "L"],
        keyJoin: "combo",
        action: "Copy link to current view",
        icon: Link2,
      },
    ],
  },
  {
    title: "Walk mode",
    icon: Navigation,
    rows: [
      { keys: ["W", "S"], keyJoin: "or", action: "Move forward / backward", icon: Move3d },
      { keys: ["A", "D"], keyJoin: "or", action: "Move left / right", icon: ArrowLeftRight },
      {
        keys: ["E", "Q"],
        keyJoin: "or",
        action: "Move up / down (also R / F)",
        icon: ArrowUpDown,
      },
      { keys: ["Shift"], action: "Sprint (hold)", icon: Zap },
      {
        keys: ["Click"],
        action: "Lock mouse look · Esc to release",
        icon: MousePointerClick,
      },
      {
        keys: ["Drag"],
        action: "Look around (when mouse unlocked)",
        icon: Navigation,
      },
    ],
  },
  {
    title: "Measurements",
    icon: Ruler,
    rows: [
      {
        keys: ["P", "Enter"],
        keyJoin: "or",
        action: "Place / confirm measurement point",
        icon: Redo2,
      },
      {
        keys: ["Ctrl", "Z"],
        keyJoin: "combo",
        action: "Cancel or undo last measurement",
        icon: Undo2,
      },
      { keys: ["Esc"], action: "Cancel measurement / clear selection", icon: X },
      { keys: ["Delete"], action: "Delete active measurement", icon: Ruler },
    ],
  },
  {
    title: "Clash review",
    icon: Crosshair,
    rows: [
      {
        keys: ["→", "J", "←", "K"],
        keyJoin: "or",
        action: "Next / previous clash",
        icon: ArrowUpDown,
      },
      {
        keys: ["1", "2", "3", "4"],
        keyJoin: "or",
        action: "Set status New / Active / Resolved / Ignored",
        icon: Crosshair,
      },
      { keys: ["C"], action: "Focus clash comment field", icon: MessageSquare },
      { keys: ["Esc"], action: "Exit clash focus mode", icon: X },
    ],
  },
  {
    title: "Help",
    icon: HelpCircle,
    rows: [{ keys: ["?"], action: "Show keyboard shortcuts", icon: HelpCircle }],
  },
];
