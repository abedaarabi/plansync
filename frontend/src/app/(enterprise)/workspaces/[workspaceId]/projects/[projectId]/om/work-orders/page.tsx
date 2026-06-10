import type { Metadata } from "next";
import { WorkOrdersClient } from "@/components/enterprise/WorkOrdersClient";

export const metadata: Metadata = { title: "Work orders" };

type Props = { params: Promise<{ projectId: string }> };

export default async function WorkspaceOmWorkOrdersPage({ params }: Props) {
  const { projectId } = await params;
  return <WorkOrdersClient projectId={projectId} />;
}
