import type { Metadata } from "next";
import { Suspense } from "react";
import { OrganizationClient } from "@/components/enterprise/OrganizationClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

export const metadata: Metadata = { title: "Organization" };

export default function OrganizationPage() {
  return (
    <EnterpriseCompactPageShell maxWidth="3xl">
      <Suspense
        fallback={
          <EnterpriseLoadingState message="Loading organization…" label="Loading organization" />
        }
      >
        <OrganizationClient />
      </Suspense>
    </EnterpriseCompactPageShell>
  );
}
