import type { Annotation } from "@/store/viewerStore";

/** Sheet pins for Pro issues — not deletable via markup flows (keyboard, context menu, bulk markup delete). */
export function annotationIsIssuePin(a: Pick<Annotation, "linkedIssueId" | "issueDraft">): boolean {
  return Boolean(a.linkedIssueId || a.issueDraft);
}

export function filterAnnotationIdsExcludingIssuePins(
  annotations: Annotation[],
  ids: string[],
): string[] {
  return ids.filter((id) => {
    const a = annotations.find((x) => x.id === id);
    return a && !annotationIsIssuePin(a);
  });
}
