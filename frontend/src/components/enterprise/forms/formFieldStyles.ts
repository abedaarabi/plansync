import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
} from "@/lib/mobileFormStyles";
import { OM_COMPACT_INPUT, OM_COMPACT_LABEL, OM_COMPACT_SELECT } from "@/lib/omCompactStyles";

export type EnterpriseFormDensity = "mobile" | "compact";

export function fieldClassName(
  density: EnterpriseFormDensity,
  kind: "input" | "textarea" | "select",
) {
  if (density === "compact") {
    return kind === "select" ? OM_COMPACT_SELECT : OM_COMPACT_INPUT;
  }

  if (kind === "select") return MOBILE_FIELD_SELECT;
  if (kind === "textarea") return MOBILE_FIELD_TEXTAREA;
  return MOBILE_FIELD_INPUT;
}

export function labelClassName(density: EnterpriseFormDensity) {
  return density === "compact" ? OM_COMPACT_LABEL : MOBILE_FIELD_LABEL;
}
