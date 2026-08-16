"use client";

import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";

export function BimIssuePhotoLightbox(props: {
  open: boolean;
  photoUrl: string | null;
  title?: string;
  onClose: () => void;
}) {
  return (
    <EnterpriseResponsiveDialog
      open={props.open}
      onClose={props.onClose}
      variant="viewer"
      ariaLabelledBy="bim-issue-photo-lightbox-title"
      panelClassName="max-w-3xl overflow-hidden p-0"
      bodyClassName="p-0"
    >
      <div className="border-b border-[var(--bim-border)] px-4 py-3">
        <h2
          id="bim-issue-photo-lightbox-title"
          className="truncate text-sm font-semibold text-[var(--bim-text)]"
        >
          {props.title ?? "Reference photo"}
        </h2>
      </div>
      {props.photoUrl ? (
        <div className="bg-black/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.photoUrl}
            alt=""
            className="mx-auto max-h-[70dvh] w-full object-contain"
          />
        </div>
      ) : null}
    </EnterpriseResponsiveDialog>
  );
}
