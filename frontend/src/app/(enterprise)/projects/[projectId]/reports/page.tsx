import type { Metadata } from "next";
import { ProjectReportsClient } from "@/components/enterprise/ProjectReportsClient";

export const metadata: Metadata = { title: "Field Reports" };

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectReportsClient projectId={projectId} />;
}
