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
/** Max movement still treated as a tap (opens row). */
const TAP_SLOP = 12;

type SwipeAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Tailwind bg/text classes for the action button */
  className?: string;
  onAction: () => void;
};

function isDestructiveAction(action: SwipeAction): boolean {
  const token = `${action.id} ${action.label}`.toLowerCase();
  return token.includes("delete") || token.includes("remove");
}

type SwipeableListRowProps = {
  children: ReactNode;
  actions: SwipeAction[];
  className?: string;
  onTap?: () => void;
};

/**
 * Lightweight swipe-to-reveal row (touch only). No Framer Motion dependency.
 * Uses `touch-action: pan-y` so vertical scroll still works.
 * Tap is handled on touchend so iOS still opens rows when click is suppressed after slight move.
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
  const suppressClick = useRef(false);

  const maxReveal = Math.min(actions.length * ACTION_WIDTH, ACTION_WIDTH * 2);

  const reset = useCallback(() => {
    setOffsetX(0);
    setOpen(false);
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    tracking.current = true;
    horizontal.current = null;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!tracking.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (horizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        horizontal.current = Math.abs(dx) > Math.abs(dy);
      }
    }
    if (!horizontal.current || actions.length === 0) return;

    const base = open ? -maxReveal : 0;
    let next = base + dx;
    if (next > 0) next = 0;
    if (next < -maxReveal) next = -maxReveal;
    setOffsetX(next);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!tracking.current) return;
    tracking.current = false;
    const t = e.changedTouches[0];
    const dx = t ? t.clientX - startX.current : 0;
    const dy = t ? t.clientY - startY.current : 0;
    const wasTap = Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP;

    if (horizontal.current && actions.length > 0) {
      const shouldOpen =
        offsetX < -(SWIPE_THRESHOLD / 2) || (open && offsetX < -SWIPE_THRESHOLD / 3);
      if (shouldOpen) {
        setOffsetX(-maxReveal);
        setOpen(true);
      } else {
        reset();
      }
      horizontal.current = null;
      return;
    }

    horizontal.current = null;

    if (!wasTap) return;

    if (open) {
      reset();
      suppressClick.current = true;
      return;
    }

    if (onTap) {
      suppressClick.current = true;
      onTap();
    }
  };

  const rowStyle: CSSProperties = {
    transform: `translateX(${offsetX}px)`,
    transition: tracking.current ? "none" : "transform 200ms ease-out",
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ touchAction: "pan-y" }}>
      {actions.length > 0 ? (
        <div
          className="absolute inset-y-0 right-0 flex bg-slate-100/80"
          aria-hidden
          style={{ width: maxReveal }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                action.onAction();
                reset();
              }}
              className={`flex min-h-[3.5rem] w-[88px] flex-col items-center justify-center gap-1 border-l border-slate-200/80 px-2 text-center text-xs font-normal transition-all duration-150 active:scale-[0.97] ${
                action.className ??
                (isDestructiveAction(action)
                  ? "bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-error)]"
                  : "bg-white text-[var(--enterprise-text)]")
              }`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
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
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (open) {
            reset();
            return;
          }
          onTap?.();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          tracking.current = false;
          horizontal.current = null;
        }}
        className="relative bg-[var(--enterprise-surface)] transition-colors duration-150 active:bg-[var(--enterprise-hover-surface)]/60"
        style={rowStyle}
      >
        {children}
      </div>
    </div>
  );
}
