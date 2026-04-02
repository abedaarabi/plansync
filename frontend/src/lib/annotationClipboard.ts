import { clamp01 } from "@/lib/coords";
import { measurementDerivedFields } from "@/lib/measureCompute";
import type { Annotation } from "@/store/viewerStore";

/** Deep copy for clipboard (no id / createdAt). */
export function annotationToClipboardPayload(a: Annotation): Omit<Annotation, "id" | "createdAt"> {
  return {
    ...a,
    points: a.points.map((p) => ({ ...p })),
  };
}

export function offsetAnnotationPoints(
  a: Omit<Annotation, "id" | "createdAt">,
  dxn: number,
  dyn: number,
): Omit<Annotation, "id" | "createdAt"> {
  return {
    ...a,
    points: a.points.map((p) => ({
      x: clamp01(p.x + dxn),
      y: clamp01(p.y + dyn),
    })),
  };
}

/** Recompute measurement numeric fields after paste/duplicate (same page calibration). */
export function recomputeMeasurementFields(
  a: Omit<Annotation, "id" | "createdAt">,
  pageW: number,
  pageH: number,
  mmPerPdfUnit: number | undefined,
): Omit<Annotation, "id" | "createdAt"> {
  if (a.type !== "measurement" || mmPerPdfUnit === undefined) return a;
  const kind = a.measurementKind ?? "line";
  const derived = measurementDerivedFields(kind, a.points, pageW, pageH, mmPerPdfUnit);
  return { ...a, ...derived };
}
