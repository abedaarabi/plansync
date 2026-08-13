"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MENU_OPEN_EVENT = "landing-nav-dropdown-open";

/**
 * Shared open/close for marketing nav dropdowns:
 * toggle on trigger, close on outside / Escape / route change,
 * and close siblings when another menu opens.
 */
export function useLandingNavDropdown() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: menuId }));
        });
      }
      return next;
    });
  }, [menuId]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onSiblingOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== menuId) setOpen(false);
    };
    window.addEventListener(MENU_OPEN_EVENT, onSiblingOpen);
    return () => window.removeEventListener(MENU_OPEN_EVENT, onSiblingOpen);
  }, [menuId]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, toggle, close, rootRef, menuId };
}
