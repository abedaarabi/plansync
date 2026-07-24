import type { BimAnnotation } from "@/store/bimMarkupStore";
import type { Annotation } from "@/store/viewerStore";

/** Map BIM markup records to PDF annotation shape for shared SVG rendering. */
export function bimAnnotationToSheetAnnotation(a: BimAnnotation): Annotation {
  return {
    id: a.id,
    pageIndex: 0,
    type: a.type,
    color: a.color,
    strokeWidth: a.strokeWidth,
    points: a.points,
    text: a.text,
    arrowHead: a.arrowHead,
    createdAt: a.createdAt,
    author: a.author,
    linkedIssueId: a.linkedIssueId,
    linkedIssueAttachment: a.linkedIssueAttachment,
    linkedIssueTitle: a.linkedIssueTitle,
    issueStatus: a.issueStatus,
  };
}
