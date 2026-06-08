"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent,
} from "react";

const SWIPE_THRESHOLD = 72;
const ACTION_WIDTH = 88;

export type SwipeAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Tailwind bg/text classes for the action button */
  className?: string;
  onAction: () => void;
};

type SwipeableListRowProps = {
  children: ReactNode;
  actions: SwipeAction[];
  className?: string;
  onTap?: () => void;
};

/**
 * Lightweight swipe-to-reveal row (touch only). No Framer Motion dependency.
 * Uses `touch-action: pan-y` so vertical scroll still works.
 */
export function SwipeableListRow({
  children,
  actions,
  className = "",
  onTap,
}: SwipeableListRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const horizontal = useRef<boolean | null>(null);

  const maxReveal = Math.min(actions.length * ACTION_WIDTH, ACTION_WIDTH * 2);

  const reset = useCallback(() => {
    setOffsetX(0);
    setOpen(false);
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    if (actions.length === 0) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    tracking.current = true;
    horizontal.current = null;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!tracking.current || actions.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (horizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        horizontal.current = Math.abs(dx) > Math.abs(dy);
      }
    }
    if (!horizontal.current) return;

    const base = open ? -maxReveal : 0;
    let next = base + dx;
    if (next > 0) next = 0;
    if (next < -maxReveal) next = -maxReveal;
    setOffsetX(next);
  };

  const onTouchEnd = () => {
    if (!tracking.current) return;
    tracking.current = false;
    if (horizontal.current) {
      const shouldOpen =
        offsetX < -(SWIPE_THRESHOLD / 2) || (open && offsetX < -SWIPE_THRESHOLD / 3);
      if (shouldOpen) {
        setOffsetX(-maxReveal);
        setOpen(true);
      } else {
        reset();
      }
    }
    horizontal.current = null;
  };

  const rowStyle: CSSProperties = {
    transform: `translateX(${offsetX}px)`,
    transition: tracking.current ? "none" : "transform 200ms ease-out",
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ touchAction: "pan-y" }}>
      <div className="absolute inset-y-0 right-0 flex" aria-hidden style={{ width: maxReveal }}>
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              action.onAction();
              reset();
            }}
            className={`flex min-h-[3.5rem] w-[88px] flex-col items-center justify-center gap-1 px-2 text-center text-xs font-semibold transition-all duration-150 active:scale-[0.97] ${action.className ?? "bg-[var(--enterprise-error)] text-white"}`}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <div
        role={onTap ? "button" : undefined}
        tabIndex={onTap ? 0 : undefined}
        onKeyDown={
          onTap
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTap();
                }
              }
            : undefined
        }
        onClick={() => {
          if (open) {
            reset();
            return;
          }
          onTap?.();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="relative bg-[var(--enterprise-surface)] transition-colors duration-150 active:bg-[var(--enterprise-hover-surface)]/60"
        style={rowStyle}
      >
        {children}
      </div>
    </div>
  );
}
