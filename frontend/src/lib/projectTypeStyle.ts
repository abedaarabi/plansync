import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Factory,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  LayoutGrid,
  Route,
} from "lucide-react";

export type ProjectTypeVisual = {
  Icon: LucideIcon;
  chipClass: string;
};

/** Preset values for the type picker (stored as `projectType`; keyword-matched for icons). */
export const PROJECT_TYPE_PRESETS: readonly string[] = [
  "Commercial",
  "Residential",
  "Industrial",
  "Healthcare",
  "Education",
  "Infrastructure",
  "Mixed-use",
  "Government",
];

/**
 * Map free-text `projectType` to icon + badge colors (keyword match; fallback generic).
 */
export function getProjectTypeVisual(type: string | null | undefined): ProjectTypeVisual | null {
  const raw = (type ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (/(commercial|office|retail|shopping)/i.test(lower)) {
    return {
      Icon: Building2,
      chipClass: "bg-blue-50 text-blue-900 ring-blue-200/80",
    };
  }
  if (/(residential|housing|multi[\s-]?family|condo|apartment)/i.test(lower)) {
    return {
      Icon: Home,
      chipClass: "bg-emerald-50 text-emerald-900 ring-emerald-200/80",
    };
  }
  if (/(industrial|warehouse|factory|manufacturing)/i.test(lower)) {
    return {
      Icon: Factory,
      chipClass: "bg-amber-50 text-amber-950 ring-amber-200/80",
    };
  }
  if (/(health|hospital|medical|clinic)/i.test(lower)) {
    return {
      Icon: Heart,
      chipClass: "bg-rose-50 text-rose-900 ring-rose-200/80",
    };
  }
  if (/(edu|school|university|campus)/i.test(lower)) {
    return {
      Icon: GraduationCap,
      chipClass: "bg-violet-50 text-violet-900 ring-violet-200/80",
    };
  }
  if (/(infra|infrastructure|road|bridge|highway|transit|rail)/i.test(lower)) {
    return {
      Icon: Route,
      chipClass: "bg-slate-100 text-slate-800 ring-slate-300/80",
    };
  }
  if (/(mixed[\s-]?use|mixed)/i.test(lower)) {
    return {
      Icon: LayoutGrid,
      chipClass: "bg-cyan-50 text-cyan-900 ring-cyan-200/80",
    };
  }
  if (/(gov|public|municipal|civic)/i.test(lower)) {
    return {
      Icon: Landmark,
      chipClass: "bg-indigo-50 text-indigo-900 ring-indigo-200/80",
    };
  }

  return {
    Icon: Building2,
    chipClass: "bg-slate-100 text-slate-800 ring-slate-200/80",
  };
}
