import type { Metadata } from "next";
import { OmInspectionsClient } from "@/components/enterprise/OmInspectionsClient";

export const metadata: Metadata = { title: "Inspections" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmInspectionsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <OmInspectionsClient projectId={projectId} />
      </div>
    </div>
  );
}
