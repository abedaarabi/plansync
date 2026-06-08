"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EnterpriseBottomSheet } from "./EnterpriseBottomSheet";
import { useMaxLgViewport } from "@/hooks/useMaxLgViewport";

export type EnterpriseResponsiveDialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  role?: "dialog" | "alertdialog";
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  overlayZClass?: string;
  /** Light enterprise chrome vs dark viewer chrome */
  variant?: "enterprise" | "viewer-dark";
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showDragHandle?: boolean;
};

const VARIANT_PANEL: Record<NonNullable<EnterpriseResponsiveDialogProps["variant"]>, string> = {
  enterprise:
    "rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-2xl shadow-black/20",
  "viewer-dark":
    "rounded-xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-white/5",
};

const VARIANT_BACKDROP: Record<NonNullable<EnterpriseResponsiveDialogProps["variant"]>, string> = {
  enterprise: "bg-black/60 backdrop-blur-[2px]",
  "viewer-dark": "bg-slate-950/70 backdrop-blur-sm",
};

/**
 * Centered modal on desktop; bottom sheet on mobile (< lg).
 * Use for confirmations, alerts, and short dialogs app-wide.
 */
export function EnterpriseResponsiveDialog({
  open,
  onClose,
  children,
  footer,
  role = "dialog",
  ariaLabelledBy,
  ariaDescribedBy,
  overlayZClass = "z-[200]",
  variant = "enterprise",
  panelClassName = "",
  bodyClassName = "",
  footerClassName = "",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showDragHandle = true,
}: EnterpriseResponsiveDialogProps) {
  const isMobile = useMaxLgViewport();
  const panelRef = useRef<HTMLDivElement>(null);
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
    }, 300);
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shouldRender, closeOnEscape, onClose]);

  if (!open && !shouldRender) return null;

  if (isMobile) {
    return (
      <EnterpriseBottomSheet
        open={open}
        onClose={onClose}
        ariaLabelledBy={ariaLabelledBy}
        overlayZClass={overlayZClass}
        closeOnBackdrop={closeOnBackdrop}
        closeOnEscape={closeOnEscape}
        showDragHandle={showDragHandle}
        bodyClassName={bodyClassName}
        footerClassName={footerClassName}
        footer={footer}
        panelClassName={
          variant === "viewer-dark" ? "border-white/10 bg-slate-900 text-slate-100" : undefined
        }
      >
        {children}
      </EnterpriseBottomSheet>
    );
  }

  if (!shouldRender || typeof document === "undefined") return null;

  const backdropClass =
    `pointer-events-auto absolute inset-0 transition-opacity duration-300 ${VARIANT_BACKDROP[variant]} ` +
    (panelActive ? "opacity-100" : "opacity-0");

  const panelClass = [
    "relative w-full max-w-md p-5 transition-all duration-300",
    VARIANT_PANEL[variant],
    panelClassName,
    panelActive ? "scale-100 opacity-100" : "scale-[0.98] opacity-0",
  ]
    .filter(Boolean)
    .join(" ");

  const footerEl = footer ? (
    <div
      className={`mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${footerClassName}`}
    >
      {footer}
    </div>
  ) : null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 print:hidden ${overlayZClass}`}
      role="presentation"
    >
      <button
        type="button"
        className={backdropClass}
        aria-label={closeOnBackdrop ? "Close" : "Background"}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        className={panelClass}
        role={role}
        aria-modal="true"
        {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
        {...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={bodyClassName}>{children}</div>
        {footerEl}
      </div>
    </div>,
    document.body,
  );
}

/** Stacked mobile-first dialog footer buttons (primary first on mobile). */
export function MobileDialogFooter({
  primary,
  secondary,
  className = "",
}: {
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col-reverse gap-2 lg:flex-row lg:justify-end lg:gap-3 ${className}`}>
      {secondary}
      {primary}
    </div>
  );
}

export const MOBILE_DIALOG_BTN_PRIMARY =
  "inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-5 text-base font-bold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-11 lg:w-auto lg:text-sm lg:font-semibold";

export const MOBILE_DIALOG_BTN_SECONDARY =
  "inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-5 text-base font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 lg:min-h-11 lg:w-auto lg:text-sm";
