import type { Annotation } from "@/store/viewerStore";

/** Sheet pins for Pro issues — not deletable via generic markup flows. */
export function annotationIsIssuePin(a: Pick<Annotation, "linkedIssueId" | "issueDraft">): boolean {
  return Boolean(a.linkedIssueId || a.issueDraft);
}

/** O&M asset location pin on the sheet. */
export function annotationIsAssetPin(
  a: Pick<Annotation, "linkedOmAssetId" | "omAssetDraft">,
): boolean {
  return Boolean(a.linkedOmAssetId || a.omAssetDraft);
}

/** Issue or asset pin — treat like protected markup for delete/filter. */
export function annotationIsProtectedSheetPin(a: Annotation): boolean {
  return annotationIsIssuePin(a) || annotationIsAssetPin(a);
}

export function filterAnnotationIdsExcludingIssuePins(
  annotations: Annotation[],
  ids: string[],
): string[] {
  return ids.filter((id) => {
    const a = annotations.find((x) => x.id === id);
    return a && !annotationIsProtectedSheetPin(a);
  });
}
