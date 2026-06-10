import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectFilesClient } from "@/components/enterprise/ProjectFilesClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { FileExplorerPageSkeleton } from "@/components/file-explorer";

export const metadata: Metadata = { title: "Files & Drawings" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectFilesPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="1600" fullHeight>
      <Suspense fallback={<FileExplorerPageSkeleton />}>
        <ProjectFilesClient projectId={projectId} />
      </Suspense>
    </EnterpriseCompactPageShell>
  );
}
