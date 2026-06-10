import type { Metadata } from "next";
import { OmFmDashboardClient } from "@/components/enterprise/OmFmDashboardClient";

export const metadata: Metadata = { title: "FM dashboard" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmFmDashboardPage({ params }: Props) {
  const { projectId } = await params;
  return <OmFmDashboardClient projectId={projectId} />;
}
