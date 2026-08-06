"use client";

import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

function ToastIcon({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "danger" | "warning";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)] ring-[var(--enterprise-semantic-danger-border)]"
      : tone === "warning"
        ? "bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)] ring-[var(--enterprise-semantic-warning-border)]"
        : "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] ring-[color-mix(in_srgb,var(--enterprise-primary)_28%,var(--enterprise-border))]";

  return (
    <span
      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneClass}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** Global toast host — PlanSync primary blue chrome + clear dismiss. */
export function AppToaster() {
  return (
    <Toaster
      theme="light"
      position="bottom-right"
      closeButton
      expand
      visibleToasts={4}
      gap={10}
      offset={{ bottom: 20, right: 16 }}
      mobileOffset={{ bottom: 16, right: 12, left: 12 }}
      toastOptions={{
        duration: 4800,
        unstyled: false,
        classNames: {
          toast: "group enterprise-toast",
          title: "enterprise-toast-title",
          description: "enterprise-toast-description",
          actionButton: "enterprise-toast-action",
          cancelButton: "enterprise-toast-cancel",
          closeButton: "enterprise-toast-close",
          success: "enterprise-toast--success",
          error: "enterprise-toast--error",
          warning: "enterprise-toast--warning",
          info: "enterprise-toast--info",
          loading: "enterprise-toast--loading",
          icon: "enterprise-toast-icon-slot",
        },
      }}
      icons={{
        success: (
          <ToastIcon>
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
          </ToastIcon>
        ),
        error: (
          <ToastIcon tone="danger">
            <XCircle className="h-4 w-4" strokeWidth={2.25} />
          </ToastIcon>
        ),
        warning: (
          <ToastIcon tone="warning">
            <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
          </ToastIcon>
        ),
        info: (
          <ToastIcon>
            <Info className="h-4 w-4" strokeWidth={2.25} />
          </ToastIcon>
        ),
        loading: (
          <ToastIcon>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          </ToastIcon>
        ),
      }}
    />
  );
}
