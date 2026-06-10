"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { hapticTap } from "@/lib/haptic";

type EnterpriseFabProps = {
  /** Accessible label (required for icon-only FAB) */
  label: string;
  icon: ReactNode;
  /** Offset above bottom nav + safe area */
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * Fixed bottom-right FAB — sits above the mobile tab bar and home indicator.
 */
export const EnterpriseFab = forwardRef<HTMLButtonElement, EnterpriseFabProps>(
  function EnterpriseFab(
    { label, icon, className = "", onClick, disabled, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={(e) => {
          if (!disabled) hapticTap();
          onClick?.(e);
        }}
        className={`fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--enterprise-primary)] text-white shadow-[0_8px_24px_-4px_rgba(37,99,235,0.55),0_4px_12px_-2px_rgba(15,23,42,0.18)] transition-all duration-150 hover:bg-[var(--enterprise-primary-deep)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden ${className}`.trim()}
        style={{
          right: "max(1rem, env(safe-area-inset-right, 0px))",
          bottom: "calc(var(--enterprise-bottomnav-offset, 4.5rem) + 0.75rem)",
        }}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
