import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectSettingsClient } from "@/components/enterprise/ProjectSettingsClient";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

type Props = { params: Promise<{ projectId: string }> };

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <Suspense
      fallback={<EnterpriseLoadingState message="Loading…" label="Loading project settings" />}
    >
      <ProjectSettingsClient projectId={projectId} />
    </Suspense>
  );
}
