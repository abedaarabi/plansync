"use client";

import { Toaster } from "sonner";

/** Global toast host — aligned with enterprise shell tokens. */
export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      expand={false}
      gap={10}
      toastOptions={{
        duration: 5600,
        className:
          "!rounded-xl !border !border-[var(--enterprise-border)] !bg-[var(--enterprise-surface)] !text-[var(--enterprise-text)] !shadow-[var(--enterprise-shadow-floating)]",
        descriptionClassName: "!text-[13px] !text-[var(--enterprise-text-muted)] !leading-snug",
        classNames: {
          closeButton:
            "!border-[var(--enterprise-border)] !bg-[var(--enterprise-surface)] !text-[var(--enterprise-text-muted)]",
        },
      }}
    />
  );
}
