"use client";

import { useEffect, useState } from "react";

const QUERY = "(min-width: 1024px)";

/** Desktop-only PDF viewer collaboration (matches plan `lg` breakpoint). */
export function useViewerCollabDesktop(): boolean {
  const [ok, setOk] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    let debounceTimer: number | null = null;
    const apply = () => setOk(mq.matches);
    apply();
    const onChange = () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        setOk(mq.matches);
      }, 160);
    };
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
    };
  }, []);

  return ok;
}
