import type { Metadata } from "next";
import { MaterialsClient } from "@/components/enterprise/MaterialsClient";

export const metadata: Metadata = { title: "Materials" };

type Props = { params: Promise<{ workspaceId: string }> };

export default async function WorkspaceMaterialsPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <div className="mobile-app-page enterprise-animate-in mobile-viewport-pane w-full max-w-full overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col lg:mx-auto">
        <MaterialsClient workspaceId={workspaceId} />
      </div>
    </div>
  );
}
