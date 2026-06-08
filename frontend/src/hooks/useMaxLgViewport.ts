"use client";

import { useLayoutEffect, useState } from "react";

const QUERY = "(max-width: 1023px)";

/** True when viewport is below the `lg` breakpoint (mobile / tablet portrait shell). */
export function useMaxLgViewport(): boolean {
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return matches;
}
