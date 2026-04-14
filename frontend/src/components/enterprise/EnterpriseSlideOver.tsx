"use client";

import { useEffect, useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const SLIDE_OVER_PANEL_TRANSITION =
  "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

/** Default width; use `panelMaxWidthClass` on `EnterpriseSlideOver` to override. */
export const ENTERPRISE_SLIDE_OVER_DEFAULT_MAX_W = "max-w-[520px]";

/** All enterprise slide-overs use this width for a consistent layout. */
export const ENTERPRISE_SLIDE_OVER_PANEL_CLASS = `w-full ${ENTERPRISE_SLIDE_OVER_DEFAULT_MAX_W} ${SLIDE_OVER_PANEL_TRANSITION}`;

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
  /** Tailwind max-width classes for the panel (default: `max-w-[520px]`). */
  panelMaxWidthClass?: string;
  /** Replace default panel border / background / shadow (Tailwind classes). */
  panelChromeClassName?: string;
  /** Extra classes for the scrollable body (padding, max-width wrapper). */
  bodyClassName?: string;
  /** Extra classes for the footer bar (padding, alignment). */
  footerClassName?: string;
  /** Extra classes for the header row (padding). */
  headerClassName?: string;
  /** Backdrop click closes (default: true). */
  closeOnBackdrop?: boolean;
  /** Escape key closes (default: true). */
  closeOnEscape?: boolean;
  /** Header X button (default: true). */
  showHeaderCloseButton?: boolean;
};

/**
 * Right-edge slide-over with backdrop and body scroll lock.
 * By default: backdrop click, Escape, and header X call `onClose` — disable via props.
 * Portals to `document.body` for correct stacking above app chrome.
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
  panelMaxWidthClass = ENTERPRISE_SLIDE_OVER_DEFAULT_MAX_W,
  panelChromeClassName = "border-l border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]",
  bodyClassName,
  footerClassName,
  headerClassName,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showHeaderCloseButton = true,
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
    const prevOverflowX = document.body.style.overflowX;
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overflowX = prevOverflowX;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shouldRender, closeOnEscape, onClose]);

  if (!shouldRender || typeof document === "undefined") return null;

  // Keep pointer-events on while mounted so clicks cannot fall through to the page during
  // open/close transitions (otherwise a backdrop "close" can immediately trigger UI underneath).
  const backdropClass =
    "pointer-events-auto absolute inset-0 bg-[var(--enterprise-text)]/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out " +
    (panelActive ? "opacity-100" : "opacity-0");

  const panelMotion =
    `w-full min-w-0 max-w-full ${panelMaxWidthClass} ${SLIDE_OVER_PANEL_TRANSITION} ` +
    `fixed inset-y-0 right-0 z-[101] flex h-dvh max-h-dvh flex-col overflow-x-hidden ${panelChromeClassName} ` +
    (panelActive ? "translate-x-0" : "translate-x-full");

  const shell = (
    <div
      className={`fixed inset-0 overflow-x-hidden overscroll-x-none ${overlayZClass}`}
      role="presentation"
    >
      <button
        type="button"
        className={backdropClass}
        aria-label={closeOnBackdrop ? "Close panel" : "Background"}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      {form ? (
        <FormPanel form={form} panelClassName={panelMotion} ariaLabelledBy={ariaLabelledBy}>
          <HeaderRow
            header={header}
            onClose={onClose}
            showCloseButton={showHeaderCloseButton}
            className={headerClassName}
          />
          <div
            className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain overscroll-x-none ${bodyClassName ?? "px-5 py-5"}`}
          >
            {children}
          </div>
          <div
            className={`flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 py-4 sm:flex-row sm:justify-end ${footerClassName ?? "px-5"}`}
          >
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
          <HeaderRow
            header={header}
            onClose={onClose}
            showCloseButton={showHeaderCloseButton}
            className={headerClassName}
          />
          <div
            className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain overscroll-x-none ${bodyClassName ?? "px-5 py-5"}`}
          >
            {children}
          </div>
          <div
            className={`flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 py-4 sm:flex-row sm:justify-end ${footerClassName ?? "px-5"}`}
          >
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

function HeaderRow({
  header,
  onClose,
  showCloseButton,
  className,
}: {
  header: ReactNode;
  onClose: () => void;
  showCloseButton: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-start justify-between gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 py-4 ${className ?? "px-5"}`}
    >
      <div className="min-w-0 flex-1">{header}</div>
      {showCloseButton ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}
