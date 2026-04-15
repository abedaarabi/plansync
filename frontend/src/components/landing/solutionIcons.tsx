import {
  AlertTriangle,
  BarChart3,
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

export const SOLUTION_ICONS = {
  viewer: FileSearch,
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
  /** Icon container bg — use on white/light backgrounds */
  bg: string;
  /** Icon color */
  text: string;
  /** Ring/border accent */
  ring: string;
  /** Solid fill — use when placed on a dark/gradient card */
  solidBg: string;
};

/**
 * Fully-spelled Tailwind class strings so Tailwind's tree-shaker
 * always includes them in the bundle.
 */
export const SOLUTION_ICON_COLORS: Record<SolutionSlug, SolutionIconColor> = {
  viewer: {
    bg: "bg-sky-50",
    text: "text-sky-600",
    ring: "ring-sky-200",
    solidBg: "bg-sky-500",
  },
  issues: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    ring: "ring-amber-200",
    solidBg: "bg-amber-500",
  },
  rfis: {
    bg: "bg-violet-50",
    text: "text-violet-600",
    ring: "ring-violet-200",
    solidBg: "bg-violet-500",
  },
  takeoff: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    ring: "ring-emerald-200",
    solidBg: "bg-emerald-500",
  },
  audit: {
    bg: "bg-lime-50",
    text: "text-lime-700",
    ring: "ring-lime-200",
    solidBg: "bg-lime-600",
  },
  proposal: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    ring: "ring-purple-200",
    solidBg: "bg-purple-600",
  },
  "cloud-storage": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-200",
    solidBg: "bg-blue-600",
  },
  "pdf-version-control": {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    ring: "ring-indigo-200",
    solidBg: "bg-indigo-600",
  },
  schedule: {
    bg: "bg-pink-50",
    text: "text-pink-700",
    ring: "ring-pink-200",
    solidBg: "bg-pink-600",
  },
  "om-handover": {
    bg: "bg-teal-50",
    text: "text-teal-600",
    ring: "ring-teal-200",
    solidBg: "bg-teal-500",
  },
  "om-assets": {
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    ring: "ring-indigo-200",
    solidBg: "bg-indigo-500",
  },
  "om-maintenance": {
    bg: "bg-orange-50",
    text: "text-orange-600",
    ring: "ring-orange-200",
    solidBg: "bg-orange-500",
  },
  "om-work-orders": {
    bg: "bg-rose-50",
    text: "text-rose-600",
    ring: "ring-rose-200",
    solidBg: "bg-rose-500",
  },
  "om-inspections": {
    bg: "bg-yellow-50",
    text: "text-yellow-600",
    ring: "ring-yellow-200",
    solidBg: "bg-yellow-500",
  },
  "om-tenant-portal": {
    bg: "bg-blue-50",
    text: "text-blue-600",
    ring: "ring-blue-200",
    solidBg: "bg-blue-500",
  },
  "om-fm-dashboard": {
    bg: "bg-cyan-50",
    text: "text-cyan-600",
    ring: "ring-cyan-200",
    solidBg: "bg-cyan-500",
  },
};
