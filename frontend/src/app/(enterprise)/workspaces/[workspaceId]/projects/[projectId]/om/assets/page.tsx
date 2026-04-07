import type { Metadata } from "next";
import { OmAssetsClient } from "@/components/enterprise/OmAssetsClient";

export const metadata: Metadata = { title: "Assets" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmAssetsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <OmAssetsClient projectId={projectId} />
      </div>
    </div>
  );
}
