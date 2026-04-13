import type { Annotation } from "@/store/viewerStore";

/** Sheet pins for Pro issues — not deletable via generic markup flows. */
export function annotationIsIssuePin(
  a: Pick<Annotation, "linkedIssueId" | "issueDraft" | "linkedIssueAttachment">,
): boolean {
  if (a.issueDraft) return true;
  return Boolean(a.linkedIssueId && !a.linkedIssueAttachment);
}

/** Markup linked to an issue for context (not the location pin). */
export function annotationIsIssueLinkedMarkup(
  a: Pick<Annotation, "linkedIssueId" | "linkedIssueAttachment">,
): boolean {
  return Boolean(a.linkedIssueId && a.linkedIssueAttachment);
}

/** Renders as Fieldwire-style sheet pin card (issue location, draft, or asset), not plain markup. */
export function annotationShowsSheetLinkPinCard(
  a: Pick<
    Annotation,
    "linkedIssueId" | "linkedIssueAttachment" | "issueDraft" | "linkedOmAssetId" | "omAssetDraft"
  >,
): boolean {
  if (a.linkedOmAssetId || a.omAssetDraft) return true;
  if (a.issueDraft) return true;
  return Boolean(a.linkedIssueId && !a.linkedIssueAttachment);
}

/** O&M asset location pin on the sheet. */
export function annotationIsAssetPin(
  a: Pick<Annotation, "linkedOmAssetId" | "omAssetDraft">,
): boolean {
  return Boolean(a.linkedOmAssetId || a.omAssetDraft);
}

/** Issue or asset pin — treat like protected markup for delete/filter. */
export function annotationIsProtectedSheetPin(a: Annotation): boolean {
  return annotationIsIssuePin(a) || annotationIsAssetPin(a) || annotationIsIssueLinkedMarkup(a);
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
