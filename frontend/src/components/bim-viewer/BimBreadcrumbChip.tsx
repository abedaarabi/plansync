"use client";

import { ArrowLeft } from "lucide-react";

/** Compact back control — model name lives in the tooltip / document title. */
export function BimBreadcrumbChip(props: {
  onBack: () => void;
  fileName: string;
  federatedLabel?: string | null;
}) {
  const title = props.federatedLabel
    ? `${props.fileName} · ${props.federatedLabel}`
    : props.fileName;

  return (
    <nav aria-label="Model navigation" className="bim-breadcrumb-chip">
      <button
        type="button"
        onClick={props.onBack}
        aria-label={`Back to files — ${title}`}
        title={title}
        className="bim-breadcrumb-chip__back bim-glass-surface bim-focus-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
