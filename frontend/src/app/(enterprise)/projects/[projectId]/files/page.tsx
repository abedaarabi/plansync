import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectFilesClient } from "@/components/enterprise/ProjectFilesClient";
import { FileExplorerPageSkeleton } from "@/components/file-explorer";

export const metadata: Metadata = { title: "Files & Drawings" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectFilesPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="mobile-app-page enterprise-animate-in mobile-viewport-pane box-border flex min-h-0 w-full max-w-full flex-col p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:mx-auto">
        <Suspense fallback={<FileExplorerPageSkeleton />}>
          <ProjectFilesClient projectId={projectId} />
        </Suspense>
      </div>
    </div>
  );
}
