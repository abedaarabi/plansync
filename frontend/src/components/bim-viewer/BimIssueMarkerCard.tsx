"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Crosshair, FileText, MessageSquarePlus } from "lucide-react";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { presignReadIssueReferencePhoto } from "@/lib/api-client";
import { issuePriorityAccentColor, type CardPlacement } from "@/lib/bim/bimIssueMarkerUtils";
import { BimIssuePhotoLightbox } from "./BimIssuePhotoLightbox";
import { BimIssueSummaryBody } from "./BimIssueSummaryBody";

export function BimIssueMarkerCard(props: {
  issue: IssueRow;
  placement: CardPlacement;
  visible: boolean;
  onOpenDetails: () => void;
  onLocateAsset: () => void;
  onOpenDocuments: () => void;
  onAddComment: () => void;
  onResolveIssue: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const { issue } = props;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const priorityAccent = issuePriorityAccentColor(issue.priority);

  useEffect(() => {
    let cancelled = false;
    const photo = issue.referencePhotos?.[0];
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    void presignReadIssueReferencePhoto(issue.id, photo.id)
      .then((url) => {
        if (!cancelled) setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [issue.id, issue.referencePhotos]);

  return (
    <>
      <article
        role="dialog"
        aria-label={`Issue ${issue.title}`}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
        className="bim-issue-marker-card pointer-events-auto absolute w-[360px] max-w-[calc(100vw-24px)]"
        style={{
          left: props.placement.left,
          top: props.placement.top,
          opacity: props.visible ? 1 : 0,
        }}
      >
        <div
          className="bim-issue-marker-card__surface overflow-hidden rounded-2xl"
          style={{ borderLeft: `3px solid ${priorityAccent}` }}
        >
          <div className="px-3 pb-2 pt-3">
            <BimIssueSummaryBody
              issue={issue}
              photoUrl={photoUrl}
              bleedPhoto
              onPhotoClick={() => setPhotoOpen(true)}
            />
          </div>

          <footer className="flex items-center gap-1.5 border-t border-white/8 px-2 py-1.5">
            <button
              type="button"
              onClick={props.onOpenDetails}
              className="bim-btn-secondary min-w-0 flex-1 truncate py-1.5 text-[10px]"
            >
              Open details
            </button>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Locate asset"
                title="Locate asset"
                onClick={props.onLocateAsset}
                className="bim-issue-marker-card__action bim-focus-ring"
              >
                <Crosshair className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Open documents"
                title="Open documents"
                onClick={props.onOpenDocuments}
                className="bim-issue-marker-card__action bim-focus-ring"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Add comment"
                title="Add comment"
                onClick={props.onAddComment}
                className="bim-issue-marker-card__action bim-focus-ring"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Resolve issue"
                title="Resolve issue"
                onClick={props.onResolveIssue}
                className="bim-issue-marker-card__action bim-focus-ring text-[var(--bim-success)]"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </footer>
        </div>
      </article>

      <BimIssuePhotoLightbox
        open={photoOpen}
        photoUrl={photoUrl}
        title={issue.title}
        onClose={() => setPhotoOpen(false)}
      />
    </>
  );
}
