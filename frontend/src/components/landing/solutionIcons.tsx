import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  Hammer,
  LayoutDashboard,
  MapPin,
  Monitor,
  Ruler,
  Users,
  Wrench,
} from "lucide-react";

export const SOLUTION_ICONS = {
  viewer: Monitor,
  issues: MapPin,
  rfis: ClipboardList,
  "om-handover": ClipboardCheck,
  "om-assets": Building2,
  "om-maintenance": Wrench,
  "om-work-orders": Hammer,
  "om-inspections": ClipboardCheck,
  "om-tenant-portal": Users,
  "om-fm-dashboard": LayoutDashboard,
  takeoff: Ruler,
} as const;
