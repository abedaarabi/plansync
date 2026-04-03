import type { Metadata } from "next";
import { ProposalPortalClient } from "@/components/enterprise/ProposalPortalClient";

export const metadata: Metadata = { title: "Proposal" };

type Props = { params: Promise<{ token: string }> };

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="min-h-screen font-[family-name:var(--font-inter)] antialiased">
      <ProposalPortalClient token={token} />
    </div>
  );
}
