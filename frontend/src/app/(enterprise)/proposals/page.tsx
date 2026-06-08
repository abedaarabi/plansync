import type { Metadata } from "next";
import { ProposalsDashboardClient } from "@/components/enterprise/ProposalsDashboardClient";

export const metadata: Metadata = { title: "Proposals Dashboard" };

export default function ProposalsDashboardPage() {
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <ProposalsDashboardClient />
      </div>
    </div>
  );
}
