import type { Metadata } from "next";
import { OmFmDashboardClient } from "@/components/enterprise/OmFmDashboardClient";

export const metadata: Metadata = { title: "FM dashboard" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmFmDashboardPage({ params }: Props) {
  const { projectId } = await params;
  return <OmFmDashboardClient projectId={projectId} />;
}
