import type { ReactNode } from "react";

/**
 * Standard full-bleed mobile page wrapper — use on route-level client pages
 * that are not already inside a constrained layout.
 */
export function MobileAppPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mobile-app-page enterprise-animate-in w-full min-w-0 max-w-full flex-1 p-4 sm:p-6 lg:p-8 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
