import type { Metadata } from "next";
import { ProposalsDashboardClient } from "@/components/enterprise/ProposalsDashboardClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Proposals Dashboard" };

export default function ProposalsDashboardPage() {
  return (
    <EnterpriseCompactPageShell maxWidth="7xl">
      <ProposalsDashboardClient />
    </EnterpriseCompactPageShell>
  );
}
