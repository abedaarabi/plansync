"use client";

import { useEffect, useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** All enterprise slide-overs use this width for a consistent layout. */
export const ENTERPRISE_SLIDE_OVER_PANEL_CLASS =
  "w-full max-w-[520px] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

const TRANSITION_MS = 300;

export type EnterpriseSlideOverProps = {
  open: boolean;
  onClose: () => void;
  /** Left side of the header row (title, subtitle, icons). */
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  /** When set, the sliding panel root is a `<form>` (e.g. submit in footer). */
  form?: FormHTMLAttributes<HTMLFormElement>;
  overlayZClass?: string;
  /** For `role="dialog"` + `aria-labelledby` on the panel. */
  ariaLabelledBy?: string;
};

/**
 * Right-edge slide-over with backdrop, body scroll lock, and Escape to close.
 * Portals to `document.body` for correct stacking above app chrome.
 * Enter/exit: backdrop fades; panel slides from the right with a smooth easing curve.
 */
export function EnterpriseSlideOver({
  open,
  onClose,
  header,
  children,
  footer,
  form,
  overlayZClass = "z-[100]",
  ariaLabelledBy,
}: EnterpriseSlideOverProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [panelActive, setPanelActive] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setShouldRender(true);
      setPanelActive(false);
      enterRafRef.current = requestAnimationFrame(() => {
        enterRafRef.current = requestAnimationFrame(() => {
          enterRafRef.current = null;
          setPanelActive(true);
        });
      });
      return () => {
        if (enterRafRef.current != null) {
          cancelAnimationFrame(enterRafRef.current);
          enterRafRef.current = null;
        }
      };
    }

    setPanelActive(false);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setShouldRender(false);
    }, TRANSITION_MS);
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shouldRender, onClose]);

  if (!shouldRender || typeof document === "undefined") return null;

  const backdropClass =
    "absolute inset-0 bg-[var(--enterprise-text)]/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out " +
    (panelActive ? "opacity-100" : "pointer-events-none opacity-0");

  const panelMotion =
    ENTERPRISE_SLIDE_OVER_PANEL_CLASS +
    " fixed inset-y-0 right-0 z-[101] flex h-dvh max-h-dvh flex-col border-l border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)] " +
    (panelActive ? "translate-x-0" : "translate-x-full");

  const shell = (
    <div className={`fixed inset-0 ${overlayZClass}`} role="presentation">
      <button type="button" className={backdropClass} aria-label="Close panel" onClick={onClose} />
      {form ? (
        <FormPanel form={form} panelClassName={panelMotion} ariaLabelledBy={ariaLabelledBy}>
          <HeaderRow header={header} onClose={onClose} />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        </FormPanel>
      ) : (
        <div
          className={panelMotion}
          role="dialog"
          aria-modal="true"
          {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
        >
          <HeaderRow header={header} onClose={onClose} />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(shell, document.body);
}

function FormPanel({
  form,
  panelClassName,
  children,
  ariaLabelledBy,
}: {
  form: FormHTMLAttributes<HTMLFormElement>;
  panelClassName: string;
  children: ReactNode;
  ariaLabelledBy?: string;
}) {
  const { className: formClassName, ...formRest } = form;
  return (
    <form
      {...formRest}
      role="dialog"
      aria-modal="true"
      {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
      className={[panelClassName, formClassName].filter(Boolean).join(" ")}
    >
      {children}
    </form>
  );
}

function HeaderRow({ header, onClose }: { header: ReactNode; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-5 py-4">
      <div className="min-w-0 flex-1">{header}</div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-2 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
        aria-label="Close"
      >
        <X className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
