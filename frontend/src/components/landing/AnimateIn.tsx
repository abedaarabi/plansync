"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export function AnimateIn({
  children,
  className = "",
  delay = 0,
  /** Above-the-fold: no opacity-0 flash (better LCP / no “blank hero”). */
  instant = false,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  instant?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(() => instant || reducedMotion);

  useEffect(() => {
    if (instant || reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [instant, reducedMotion]);

  const style =
    instant || reducedMotion
      ? { opacity: 1, transform: "none" as const }
      : {
          opacity: visible ? 1 : 0,
          transform: visible ? "none" : "translateY(20px)",
          transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        };

  return (
    <div ref={ref} id={id} className={className} style={style}>
      {children}
    </div>
  );
}
