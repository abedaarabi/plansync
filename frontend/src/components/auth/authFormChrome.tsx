"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";

export const AUTH_FIELD_ICON =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400";

export const AUTH_FIELD_INPUT =
  "enterprise-field-input enterprise-field-input--icon pr-3 text-base";

export const AUTH_PASSWORD_INPUT =
  "enterprise-field-input enterprise-field-input--icon pr-11 text-base";

export function AuthFormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function AuthSubmitButton({
  loading,
  loadingLabel,
  label,
}: {
  loading: boolean;
  loadingLabel: string;
  label: string;
}) {
  return (
    <EnterpriseButton type="submit" fullWidth loading={loading} className="gap-2">
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </EnterpriseButton>
  );
}
