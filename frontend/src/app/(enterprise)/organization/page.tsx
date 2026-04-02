import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { OrganizationClient } from "@/components/enterprise/OrganizationClient";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

export const metadata: Metadata = { title: "Organization" };

export default function OrganizationPage() {
  return (
    <div className="enterprise-animate-in p-6 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <div className="flex items-start gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)]"
              aria-hidden
            >
              <Building2 className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
                Organization
              </h1>
              <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
                Branding, people, roles, and email invites for your workspace.
              </p>
            </div>
          </div>
        </header>
        <Suspense
          fallback={
            <EnterpriseLoadingState message="Loading organization…" label="Loading organization" />
          }
        >
          <OrganizationClient />
        </Suspense>
      </div>
    </div>
  );
}
