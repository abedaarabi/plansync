"use client";

import { useEffect, useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { useBodyScrollLock, useEscapeToClose } from "@/hooks/useOverlayLock";

const SLIDE_OVER_PANEL_TRANSITION =
  "transition-transform duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]";

/** Default width; use `panelMaxWidthClass` on `EnterpriseSlideOver` to override. */
const ENTERPRISE_SLIDE_OVER_DEFAULT_MAX_W = "max-w-[min(100%,560px)]";

const TRANSITION_MS = 250;

/** Solid edge panel — border-first, no soft glass. */
const DEFAULT_PANEL_CHROME =
  "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-none lg:border-l lg:shadow-[-6px_0_24px_-14px_rgba(12,18,34,0.14)]";

const FOOTER_CLASS =
  "flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/40 py-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:py-3 lg:flex-row lg:items-center lg:justify-end lg:gap-2";

const BODY_CLASS =
  "enterprise-scrollbar mobile-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain overscroll-x-none bg-[var(--enterprise-surface)]";

const HEADER_CLASS =
  "flex shrink-0 items-start justify-between gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-3.5";

function MobileSheetHandle() {
  return (
    <div className="flex shrink-0 justify-center pt-2 pb-0.5 lg:hidden" aria-hidden>
      <div className="h-1 w-9 rounded-full bg-[var(--enterprise-border)]" />
    </div>
  );
}

function panelMotionClass(
  panelActive: boolean,
  panelMaxWidthClass: string,
  panelChromeClassName: string,
  panelZClass: string,
  panelVariant: "edge" | "floating",
) {
  const motion = panelActive
    ? "max-lg:translate-y-0 lg:translate-x-0"
    : "max-lg:translate-y-full lg:translate-x-full";
  const desktopDock =
    panelVariant === "floating"
      ? "lg:inset-y-2 lg:right-2 lg:left-auto lg:h-auto lg:max-h-[calc(100dvh-1rem)] lg:rounded-lg lg:border"
      : "lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-dvh lg:rounded-none lg:border-y-0 lg:border-r-0";
  return [
    "w-full min-w-0",
    panelMaxWidthClass,
    SLIDE_OVER_PANEL_TRANSITION,
    `fixed ${panelZClass} flex flex-col overflow-x-hidden`,
    panelChromeClassName,
    "max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:max-h-[min(92dvh,920px)] max-lg:rounded-t-lg max-lg:border max-lg:border-b-0",
    desktopDock,
    motion,
  ].join(" ");
}

export type EnterpriseSlideOverProps = {
  open: boolean;
  onClose: () => void;
  /** Left side of the header row (title, subtitle, icons). Prefer `SlideOverHeader`. */
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  /** When set, the sliding panel root is a `<form>` (e.g. submit in footer). */
  form?: FormHTMLAttributes<HTMLFormElement>;
  /** Backdrop stacking (default `z-[100]`). Panel renders at `panelZClass` (default `z-[101]`). */
  overlayZClass?: string;
  /** Panel stacking above backdrop (default `z-[101]`). */
  panelZClass?: string;
  /** For `role="dialog"` + `aria-labelledby` on the panel. */
  ariaLabelledBy?: string;
  /** Tailwind max-width classes for the panel (default: `max-w-[min(100%,560px)]`). */
  panelMaxWidthClass?: string;
  /**
   * Desktop layout: `edge` docks full-height to the right (default);
   * `floating` is a compact inset card so the page stays visible.
   */
  panelVariant?: "edge" | "floating";
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
 * Compact title block for enterprise slide-overs (AEC console density).
 * Use inside `header` for consistent typography and optional status/meta.
 */
export function SlideOverHeader({
  title,
  description,
  titleId,
  icon: Icon,
  meta,
  badge,
}: {
  title: ReactNode;
  description?: ReactNode;
  titleId?: string;
  icon?: LucideIcon;
  /** Secondary line under title (id, status chips, etc.) */
  meta?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 pr-1">
      {Icon ? (
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
          aria-hidden
        >
          <Icon className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2
            id={titleId}
            className="truncate text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
          >
            {title}
          </h2>
          {badge}
        </div>
        {meta ? (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">{meta}</div>
        ) : null}
        {description ? <p className="enterprise-type-subtitle mt-1">{description}</p> : null}
      </div>
    </div>
  );
}

/** Secondary footer action (Cancel). */
export const SLIDE_OVER_BTN_SECONDARY =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:cursor-not-allowed disabled:opacity-55";

/** Primary footer action (Save / Create). */
export const SLIDE_OVER_BTN_PRIMARY =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-transparent bg-[var(--enterprise-primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)] disabled:cursor-not-allowed disabled:opacity-55";

/**
 * Right-edge slide-over with backdrop and body scroll lock.
 * Solid enterprise chrome — dense header/footer, hairline borders, no glass.
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
  panelZClass = "z-[101]",
  ariaLabelledBy,
  panelMaxWidthClass = ENTERPRISE_SLIDE_OVER_DEFAULT_MAX_W,
  panelVariant = "edge",
  panelChromeClassName = DEFAULT_PANEL_CHROME,
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

  useBodyScrollLock(shouldRender);
  useEscapeToClose(shouldRender && closeOnEscape, onClose);

  if (!shouldRender || typeof document === "undefined") return null;

  // Keep pointer-events on while mounted so clicks cannot fall through during transitions.
  const backdropClass =
    "pointer-events-auto absolute inset-0 bg-[#0b1220]/40 transition-opacity duration-250 ease-out " +
    (panelActive ? "opacity-100" : "opacity-0");

  const panelMotion = panelMotionClass(
    panelActive,
    panelMaxWidthClass,
    panelChromeClassName,
    panelZClass,
    panelVariant,
  );

  const panelInner = (
    <>
      <MobileSheetHandle />
      <HeaderRow
        header={header}
        onClose={onClose}
        showCloseButton={showHeaderCloseButton}
        className={headerClassName}
      />
      <div className={`${BODY_CLASS} ${bodyClassName ?? "px-5 py-4"}`}>{children}</div>
      <div className={`${FOOTER_CLASS} ${footerClassName ?? "px-5"}`}>{footer}</div>
    </>
  );

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
          {panelInner}
        </FormPanel>
      ) : (
        <div
          className={panelMotion}
          role="dialog"
          aria-modal="true"
          {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
        >
          {panelInner}
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
    <div className={`${HEADER_CLASS} ${className ?? "px-5"}`}>
      <div className="min-w-0 flex-1">{header}</div>
      {showCloseButton ? (
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition-colors hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}
