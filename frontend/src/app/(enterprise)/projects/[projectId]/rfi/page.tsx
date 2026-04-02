import type { Metadata } from "next";
import { ProjectRfisClient } from "@/components/enterprise/ProjectRfisClient";

export const metadata: Metadata = { title: "RFIs" };

export default async function ProjectRfiPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectRfisClient projectId={projectId} />;
}
