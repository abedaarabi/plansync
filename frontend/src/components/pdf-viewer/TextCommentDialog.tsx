"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  onConfirm: (text: string) => void;
  onCancel: () => void;
  initialText?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Preserved for backwards-compatible call sites. */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Preserved for backwards-compatible call sites. */
  anchorNorm?: { x: number; y: number } | null;
};

export function TextCommentDialog({
  open,
  onConfirm,
  onCancel,
  initialText = "",
  title = "Add comment",
  description,
  confirmLabel = "Place",
  anchorRef: _anchorRef,
  anchorNorm: _anchorNorm,
}: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue(initialText);
  }, [open, initialText]);

  const trimmed = value.trim();

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={onCancel}
      ariaLabelledBy="text-comment-title"
      variant="viewer-dark"
      overlayZClass="z-[100]"
      panelClassName="max-w-sm"
      footer={
        <>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_PRIMARY} bg-[var(--viewer-primary)] text-white shadow-sm hover:bg-[var(--viewer-primary-hover)] disabled:opacity-50`}
            title="Save comment text"
            disabled={!trimmed}
            onClick={() => onConfirm(trimmed)}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className={`${MOBILE_DIALOG_BTN_SECONDARY} text-[var(--viewer-text-muted)] hover:bg-white/5 hover:text-[var(--viewer-text)]`}
            title="Discard and close"
            onClick={onCancel}
          >
            Cancel
          </button>
        </>
      }
    >
      <h2
        id="text-comment-title"
        className="text-[13px] font-semibold tracking-tight text-[var(--viewer-text)]"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-[10px] leading-snug text-[var(--viewer-text-muted)]">
          {description}
        </p>
      ) : null}
      <label className="mt-2 block text-[10px] font-medium text-[var(--viewer-text-muted)]">
        Comment
        <textarea
          rows={3}
          className="mt-1 max-h-28 min-h-[4.25rem] w-full resize-y rounded-md border border-[var(--viewer-border-strong)] bg-[var(--viewer-input-bg)] px-2 py-1.5 text-[12px] leading-snug text-[var(--viewer-text)] outline-none transition placeholder:text-slate-600 focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Write a note…"
          title="Comment text shown on the sheet"
          autoFocus
        />
      </label>
    </EnterpriseResponsiveDialog>
  );
}
