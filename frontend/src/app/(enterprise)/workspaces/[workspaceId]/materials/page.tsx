import type { Metadata } from "next";
import { MaterialsClient } from "@/components/enterprise/MaterialsClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Materials" };

type Props = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceMaterialsPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <EnterpriseCompactPageShell fullHeight>
      <MaterialsClient workspaceId={workspaceId} />
    </EnterpriseCompactPageShell>
  );
}
