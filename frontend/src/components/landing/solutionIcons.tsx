import {
  AlertTriangle,
  BarChart3,
  Box,
  Calculator,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  Database,
  FileSearch,
  GitBranch,
  Handshake,
  MessageSquare,
  PackageCheck,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { SolutionSlug } from "@/lib/landingContent";

/** Single icon library (lucide) — simple line icons only. */
export const SOLUTION_ICONS = {
  viewer: FileSearch,
  "bim-viewer": Box,
  issues: AlertTriangle,
  rfis: MessageSquare,
  takeoff: Calculator,
  audit: ShieldCheck,
  proposal: Handshake,
  "cloud-storage": Cloud,
  "pdf-version-control": GitBranch,
  schedule: CalendarDays,
  "om-handover": PackageCheck,
  "om-assets": Database,
  "om-maintenance": CalendarClock,
  "om-work-orders": ClipboardList,
  "om-inspections": ClipboardCheck,
  "om-tenant-portal": UserCheck,
  "om-fm-dashboard": BarChart3,
} as const;

export type SolutionIconColor = {
  /** Icon container bg — restrained slate, not rainbow feature art */
  bg: string;
  /** Icon color */
  text: string;
  /** Ring/border accent */
  ring: string;
  /** Solid fill — soft brand blue only (no per-feature rainbow) */
  solidBg: string;
};

/**
 * Shared restrained palette for all solutions.
 * Icons support content; they are not the visual identity.
 * Fully-spelled Tailwind class strings so the tree-shaker keeps them.
 */
const RESTRAINED_ICON: SolutionIconColor = {
  bg: "bg-slate-50",
  text: "text-slate-600",
  ring: "ring-slate-200",
  /** Brand blue only — never a rainbow of per-feature fills */
  solidBg: "bg-blue-600",
};

export const SOLUTION_ICON_COLORS: Record<SolutionSlug, SolutionIconColor> = {
  viewer: RESTRAINED_ICON,
  "bim-viewer": RESTRAINED_ICON,
  issues: RESTRAINED_ICON,
  rfis: RESTRAINED_ICON,
  takeoff: RESTRAINED_ICON,
  audit: RESTRAINED_ICON,
  proposal: RESTRAINED_ICON,
  "cloud-storage": RESTRAINED_ICON,
  "pdf-version-control": RESTRAINED_ICON,
  schedule: RESTRAINED_ICON,
  "om-handover": RESTRAINED_ICON,
  "om-assets": RESTRAINED_ICON,
  "om-maintenance": RESTRAINED_ICON,
  "om-work-orders": RESTRAINED_ICON,
  "om-inspections": RESTRAINED_ICON,
  "om-tenant-portal": RESTRAINED_ICON,
  "om-fm-dashboard": RESTRAINED_ICON,
};
