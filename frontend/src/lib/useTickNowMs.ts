"use client";

import { useEffect, useState } from "react";

/**
 * Monotonic wall time for comparisons (e.g. overdue) without calling `Date.now()` during render
 * (satisfies react-hooks/purity). Refreshes on an interval so counts stay reasonably current.
 */
export function useTickNowMs(intervalMs = 60_000): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return t;
}
