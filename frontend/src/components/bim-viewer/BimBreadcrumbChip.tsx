"use client";

import { ArrowLeft } from "lucide-react";

export function BimBreadcrumbChip(props: {
  backHref: string;
  onBack: () => void;
  fileName: string;
  projectLabel?: string | null;
  federatedLabel?: string | null;
}) {
  return (
    <nav aria-label="Model navigation" className="bim-breadcrumb-chip bim-glass-surface">
      <button
        type="button"
        onClick={props.onBack}
        aria-label="Back to files"
        className="bim-breadcrumb-chip__back bim-focus-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </button>
      {props.federatedLabel ? (
        <>
          <span className="bim-breadcrumb-chip__text hidden min-w-0 truncate sm:inline">
            {props.federatedLabel}
          </span>
          <span className="bim-breadcrumb-chip__sep hidden sm:inline" aria-hidden>
            ·
          </span>
        </>
      ) : props.projectLabel ? (
        <>
          <span className="bim-breadcrumb-chip__text hidden min-w-0 truncate sm:inline">
            {props.projectLabel}
          </span>
          <span className="bim-breadcrumb-chip__sep hidden sm:inline" aria-hidden>
            ·
          </span>
        </>
      ) : null}
      <span className="bim-breadcrumb-chip__text min-w-0 truncate" title={props.fileName}>
        {props.fileName}
      </span>
    </nav>
  );
}
