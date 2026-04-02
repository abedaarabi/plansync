import { Suspense } from "react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { ResetPasswordClient } from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--enterprise-auth-bg)] p-6">
          <EnterpriseLoadingState message="Loading…" label="Password reset" />
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
