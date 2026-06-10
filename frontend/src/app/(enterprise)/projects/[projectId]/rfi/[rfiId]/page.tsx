import type { Metadata } from "next";
import { RfiDetailClient } from "@/components/enterprise/RfiDetailClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "RFI Detail" };

type Props = { params: Promise<{ projectId: string; rfiId: string }> };

export default async function RfiDetailPage({ params }: Props) {
  const { projectId, rfiId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <RfiDetailClient projectId={projectId} rfiId={rfiId} />
    </EnterpriseCompactPageShell>
  );
}
