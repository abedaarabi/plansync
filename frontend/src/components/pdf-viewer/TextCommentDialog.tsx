"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onConfirm: (text: string) => void;
  onCancel: () => void;
  initialText?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** PDF overlay — with {@link anchorNorm} positions the panel near the click */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Normalized point on the page (0–1) where the comment attaches */
  anchorNorm?: { x: number; y: number } | null;
};

const POP_MIN_W = 260;
const POP_MAX_W = 300;
const POP_H_EST = 228;
const GAP = 10;
const PAD = 10;

function useCommentPanelStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null> | undefined,
  anchorNorm: { x: number; y: number } | null | undefined,
) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const update = useCallback(() => {
    if (!open || typeof window === "undefined") {
      setStyle(null);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(POP_MAX_W, Math.max(POP_MIN_W, vw - PAD * 2));

    const el = anchorRef?.current;
    if (el && anchorNorm != null) {
      const r = el.getBoundingClientRect();
      const ax = r.left + anchorNorm.x * r.width;
      const ay = r.top + anchorNorm.y * r.height;

      let top = ay + GAP;
      if (top + POP_H_EST > vh - PAD) {
        top = ay - GAP - POP_H_EST;
      }
      top = Math.min(Math.max(top, PAD), vh - PAD - POP_H_EST);

      let left = ax - w / 2;
      left = Math.min(Math.max(left, PAD), vw - PAD - w);

      setStyle({
        position: "fixed",
        top,
        left,
        width: w,
        zIndex: 100,
      });
      return;
    }

    setStyle({
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: w,
      maxWidth: `min(${POP_MAX_W}px, calc(100vw - ${PAD * 2}px))`,
      zIndex: 100,
    });
  }, [open, anchorRef, anchorNorm]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return open ? style : null;
}

export function TextCommentDialog({
  open,
  onConfirm,
  onCancel,
  initialText = "",
  title = "Add comment",
  description,
  confirmLabel = "Place",
  anchorRef,
  anchorNorm,
}: Props) {
  const [value, setValue] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setValue(initialText);
  }, [open, initialText]);

  const panelStyle = useCommentPanelStyle(open, anchorRef, anchorNorm);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !mounted || typeof document === "undefined" || !panelStyle) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Dismiss"
        className="fixed inset-0 z-[90] cursor-default bg-slate-950/30 print:hidden"
        onClick={onCancel}
      />
      <div
        style={panelStyle}
        className="rounded-xl border border-[var(--viewer-border-strong)] bg-[var(--viewer-panel)] p-3 text-[var(--viewer-text)] shadow-2xl ring-1 ring-[var(--viewer-primary)]/20 print:hidden"
        role="dialog"
        aria-labelledby="text-comment-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
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
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[var(--viewer-text-muted)] transition hover:bg-white/5 hover:text-[var(--viewer-text)]"
            title="Discard and close"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[var(--viewer-primary)] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[var(--viewer-primary-hover)]"
            title="Save comment text"
            onClick={() => {
              const t = value.trim();
              if (!t) return;
              onConfirm(t);
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
