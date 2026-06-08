"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

type PullToRefreshProps = {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
};

const PULL_THRESHOLD = 64;

/**
 * Pull-to-refresh wrapper for mobile list views.
 * Attach to a scroll container's parent; listens on the outer wrapper.
 */
export function PullToRefresh({
  children,
  onRefresh,
  disabled,
  className = "",
}: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const tracking = useRef(false);
  const scrollEl = useRef<HTMLDivElement>(null);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [onRefresh]);

  return (
    <div className={`relative min-h-0 flex-1 flex flex-col ${className}`}>
      {(pull > 0 || refreshing) && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]"
          aria-hidden
        >
          <div
            className={`flex h-9 items-center gap-2 rounded-full bg-[var(--enterprise-surface)] px-3 text-sm font-medium text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-sm)] transition-opacity ${refreshing ? "opacity-100" : "opacity-90"}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full border-2 border-[var(--enterprise-primary)] border-t-transparent ${refreshing ? "animate-spin" : ""}`}
              style={{
                transform: refreshing ? undefined : `rotate(${(pull / PULL_THRESHOLD) * 360}deg)`,
              }}
            />
            {refreshing
              ? "Refreshing…"
              : pull >= PULL_THRESHOLD
                ? "Release to refresh"
                : "Pull to refresh"}
          </div>
        </div>
      )}
      <div
        ref={scrollEl}
        className="mobile-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        style={{
          transform: pull > 0 ? `translateY(${Math.min(pull, PULL_THRESHOLD + 24)}px)` : undefined,
          transition: tracking.current ? "none" : "transform 200ms ease-out",
        }}
        onTouchStart={(e) => {
          if (disabled || refreshing) return;
          const el = scrollEl.current;
          if (!el || el.scrollTop > 0) return;
          startY.current = e.touches[0].clientY;
          tracking.current = true;
        }}
        onTouchMove={(e) => {
          if (!tracking.current || disabled || refreshing) return;
          const el = scrollEl.current;
          if (!el || el.scrollTop > 0) {
            tracking.current = false;
            setPull(0);
            return;
          }
          const dy = e.touches[0].clientY - startY.current;
          if (dy > 0) setPull(Math.min(dy * 0.55, PULL_THRESHOLD + 32));
          else setPull(0);
        }}
        onTouchEnd={() => {
          if (!tracking.current) return;
          tracking.current = false;
          if (pull >= PULL_THRESHOLD && !refreshing) void runRefresh();
          else setPull(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
