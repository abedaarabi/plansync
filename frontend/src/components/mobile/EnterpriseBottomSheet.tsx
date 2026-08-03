"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock, useEscapeToClose } from "@/hooks/useOverlayLock";
import {
  bottomSheetChrome,
  type EnterpriseBottomSheetVariant,
} from "./enterpriseBottomSheetChrome";

const TRANSITION_MS = 320;
const SHEET_TRANSITION = "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

export type { EnterpriseBottomSheetVariant };

export type EnterpriseBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional title for screen readers when no visible heading */
  ariaLabel?: string;
  /** id of element that labels the dialog */
  ariaLabelledBy?: string;
  overlayZClass?: string;
  /** Max height as Tailwind class (default ~92dvh) */
  maxHeightClass?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showDragHandle?: boolean;
  /** Light enterprise chrome vs dark BIM/viewer chrome */
  variant?: EnterpriseBottomSheetVariant;
  /** Extra classes on the sheet panel */
  panelClassName?: string;
  /** Extra classes on scroll body */
  bodyClassName?: string;
  /**
   * When false, the sheet body does not scroll — children own scrolling
   * (needed for nested docks like clash on iPad).
   */
  bodyScroll?: boolean;
  footer?: ReactNode;
  footerClassName?: string;
};

/**
 * Native-style bottom sheet for mobile confirmations and short forms.
 * Uses CSS translate-y — no Framer Motion required.
 */
export function EnterpriseBottomSheet({
  open,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  overlayZClass = "z-[110]",
  maxHeightClass = "max-h-[min(92dvh,920px)]",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showDragHandle = true,
  variant = "enterprise",
  panelClassName = "",
  bodyClassName = "",
  bodyScroll = true,
  footer,
  footerClassName = "",
}: EnterpriseBottomSheetProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [sheetActive, setSheetActive] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterRafRef = useRef<number | null>(null);
  const chrome = bottomSheetChrome(variant, footerClassName);

  useEffect(() => {
    if (open) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setShouldRender(true);
      setSheetActive(false);
      enterRafRef.current = requestAnimationFrame(() => {
        enterRafRef.current = requestAnimationFrame(() => {
          enterRafRef.current = null;
          setSheetActive(true);
        });
      });
      return () => {
        if (enterRafRef.current != null) {
          cancelAnimationFrame(enterRafRef.current);
          enterRafRef.current = null;
        }
      };
    }

    setSheetActive(false);
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

  const backdropClass = chrome.backdropBase + (sheetActive ? "opacity-100" : "opacity-0");
  const panelClass = [
    "fixed inset-x-0 bottom-0 z-[111] flex w-full flex-col overflow-hidden rounded-t-2xl border border-b-0",
    chrome.panelTheme,
    maxHeightClass,
    SHEET_TRANSITION,
    sheetActive ? "translate-y-0" : "translate-y-full",
    panelClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyClass = bodyScroll
    ? `mobile-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 ${bodyClassName}`
    : `flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain ${bodyClassName}`;

  return createPortal(
    <div className={`fixed inset-0 overflow-hidden ${overlayZClass}`} role="presentation">
      <button
        type="button"
        className={backdropClass}
        aria-label={closeOnBackdrop ? "Close" : "Background"}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
        {...(ariaLabel && !ariaLabelledBy ? { "aria-label": ariaLabel } : {})}
        className={panelClass}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {showDragHandle ? (
          <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden>
            <div className={chrome.handle} />
          </div>
        ) : null}
        <div className={bodyClass}>{children}</div>
        {footer ? <div className={chrome.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
