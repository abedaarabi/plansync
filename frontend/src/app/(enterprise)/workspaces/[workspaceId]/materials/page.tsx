import type { Metadata } from "next";
import { MaterialsClient } from "@/components/enterprise/MaterialsClient";

export const metadata: Metadata = { title: "Materials" };

type Props = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceMaterialsPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <div className="enterprise-animate-in h-[calc(100dvh_-_var(--enterprise-topbar-offset))] overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col">
        <MaterialsClient workspaceId={workspaceId} />
      </div>
    </div>
  );
}
