import type { Metadata } from "next";
import { RfiDetailClient } from "@/components/enterprise/RfiDetailClient";

export const metadata: Metadata = { title: "RFI Detail" };

type Props = { params: Promise<{ projectId: string; rfiId: string }> };

export default async function RfiDetailPage({ params }: Props) {
  const { projectId, rfiId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <RfiDetailClient projectId={projectId} rfiId={rfiId} />
      </div>
    </div>
  );
}
