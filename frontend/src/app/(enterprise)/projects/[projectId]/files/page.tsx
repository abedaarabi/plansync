import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectFilesClient } from "@/components/enterprise/ProjectFilesClient";
import { FileExplorerPageSkeleton } from "@/components/file-explorer";

export const metadata: Metadata = { title: "Files & Drawings" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectFilesPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in box-border flex h-[calc(100dvh_-_var(--enterprise-topbar-offset))] min-h-0 flex-col p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col">
        <Suspense fallback={<FileExplorerPageSkeleton />}>
          <ProjectFilesClient projectId={projectId} />
        </Suspense>
      </div>
    </div>
  );
}
