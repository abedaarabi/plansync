import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectAuditClient } from "@/components/enterprise/ProjectAuditClient";
import { FileExplorerPageSkeleton } from "@/components/file-explorer";

export const metadata: Metadata = { title: "Audit log" };

type Props = { params: Promise<{ projectId: string }> };

const AUDIT_SUBHEAD =
  "Viewer opens, uploads, moves, deletes — summaries here; full detail in Excel/PDF exports.";

export default async function ProjectAuditPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in box-border flex h-[calc(100dvh_-_var(--enterprise-topbar-offset))] min-h-0 flex-col overflow-hidden px-3 py-2 sm:px-4 sm:py-3 lg:px-5">
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<FileExplorerPageSkeleton />}>
          <ProjectAuditClient projectId={projectId} subhead={AUDIT_SUBHEAD} />
        </Suspense>
      </div>
    </div>
  );
}
