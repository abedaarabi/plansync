"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIssue } from "@/lib/api-client";
import { useViewerStore } from "@/store/viewerStore";
import { IssueFormSlider } from "./IssueFormSlider";

/**
 * Renders the docked issue create/edit panel inside the right flyout.
 */
export function IssuePanelHost() {
  const rightFlyout = useViewerStore((s) => s.rightFlyout);
  const issueCreateDraft = useViewerStore((s) => s.issueCreateDraft);
  const issueEditId = useViewerStore((s) => s.issueEditId);
  const closeIssueFlyout = useViewerStore((s) => s.closeIssueFlyout);

  const { data: editIssue, isPending: editPending } = useQuery({
    queryKey: ["issue", issueEditId],
    queryFn: () => fetchIssue(issueEditId!),
    enabled: Boolean(issueEditId && rightFlyout === "issue"),
    staleTime: 15_000,
  });

  if (rightFlyout !== "issue") return null;

  if (issueCreateDraft) {
    return (
      <IssueFormSlider
        variant="create"
        layout="docked"
        open
        annotationId={issueCreateDraft.annotationId}
        createIntent={issueCreateDraft.createIntent ?? "issue"}
        onClose={closeIssueFlyout}
      />
    );
  }

  if (issueEditId) {
    if (editPending || !editIssue) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-[12px] text-slate-500">
          Loading issue…
        </div>
      );
    }
    return (
      <IssueFormSlider
        variant="edit"
        layout="docked"
        open
        issue={editIssue}
        onClose={closeIssueFlyout}
      />
    );
  }

  return null;
}
