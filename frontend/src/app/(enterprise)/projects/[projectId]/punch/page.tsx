import type { Metadata } from "next";
import { ProjectPunchClient } from "@/components/enterprise/ProjectPunchClient";

export const metadata: Metadata = { title: "Punch List" };

export default async function ProjectPunchPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectPunchClient projectId={projectId} />;
}
