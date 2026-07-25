"use client";

import { Crosshair } from "lucide-react";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { issuePriorityAccentColor } from "@/lib/bim/bimIssueMarkerUtils";
import { BimIssueSummaryBody } from "./BimIssueSummaryBody";

export function BimIssueDockIssueCard(props: {
  issue: IssueRow;
  selected: boolean;
  photoUrl?: string;
  onOpenIssue: (issue: IssueRow) => void;
  onFocusIssue: (issue: IssueRow) => void;
  onPhotoClick?: () => void;
}) {
  const priorityAccent = issuePriorityAccentColor(props.issue.priority);

  return (
    <li key={props.issue.id} id={`bim-sidebar-issue-${props.issue.id}`}>
      <article
        className={`overflow-hidden rounded-xl border transition-colors duration-150 ${
          props.selected
            ? "border-[var(--bim-accent)] bg-[var(--bim-accent-muted)] shadow-sm"
            : "border-[var(--bim-border)] bg-[var(--bim-panel)] hover:bg-[var(--bim-hover)]"
        }`}
        style={{ borderLeft: `3px solid ${priorityAccent}` }}
      >
        <div className="px-2.5 py-2.5">
          <BimIssueSummaryBody
            issue={props.issue}
            photoUrl={props.photoUrl}
            compact
            bleedPhoto
            onOpen={() => props.onOpenIssue(props.issue)}
            onPhotoClick={props.onPhotoClick}
          />
        </div>

        <div className="flex items-center gap-1 border-t border-[var(--bim-border)] px-2 py-1.5">
          <button
            type="button"
            aria-label="Open issue details"
            onClick={() => props.onOpenIssue(props.issue)}
            className="bim-btn-secondary flex-1 py-1 text-[10px]"
          >
            Open
          </button>
          <button
            type="button"
            aria-label="Fly to issue in model"
            title="Fly to issue in model"
            onClick={() => props.onFocusIssue(props.issue)}
            className="bim-focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--bim-border)] text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)] hover:text-[var(--bim-text)]"
          >
            <Crosshair className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </article>
    </li>
  );
}
