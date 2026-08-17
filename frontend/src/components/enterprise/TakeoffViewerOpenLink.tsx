"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  takeoffLineHasViewerLink,
  viewerHrefForTakeoffLine,
  type TakeoffLineRow,
} from "@/lib/api-client";
import { openBimViewer } from "@/lib/bim/openBimViewer";

function isBimTakeoffHref(href: string): boolean {
  return href.startsWith("/bim-viewer");
}

function takeoffOpenLabel(row: TakeoffLineRow, short: boolean): string {
  if (short) return "Open";
  return isBimTakeoffHref(viewerHrefForTakeoffLine(row)) ? "Open in model" : "Open on sheet";
}

/** Opens the PDF or BIM viewer focused on the takeoff source (zone or IFC guids). */
export function TakeoffViewerOpenLink({
  row,
  shortLabel = false,
  className,
  manualClassName,
}: {
  row: TakeoffLineRow;
  shortLabel?: boolean;
  className: string;
  manualClassName: string;
}) {
  if (!takeoffLineHasViewerLink(row)) {
    return (
      <span
        className={manualClassName}
        title="Added from the takeoff page catalog — not linked to a sheet shape or BIM element"
      >
        Added manually
      </span>
    );
  }

  const href = viewerHrefForTakeoffLine(row);
  const label = takeoffOpenLabel(row, shortLabel);
  if (isBimTakeoffHref(href)) {
    return (
      <button
        type="button"
        onClick={() => openBimViewer(href)}
        className={className}
        title="Open model and zoom to these elements"
      >
        {label}
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    );
  }

  return (
    <Link href={href} className={className} title="Open sheet and zoom to takeoff shape">
      {label}
      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
    </Link>
  );
}
