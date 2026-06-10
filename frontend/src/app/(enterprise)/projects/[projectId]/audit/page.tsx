import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectAuditClient } from "@/components/enterprise/ProjectAuditClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { FileExplorerPageSkeleton } from "@/components/file-explorer";

export const metadata: Metadata = { title: "Audit log" };

type Props = { params: Promise<{ projectId: string }> };

const AUDIT_SUBHEAD =
  "Viewer opens, uploads, moves, deletes — summaries here; full detail in Excel/PDF exports.";

export default async function ProjectAuditPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="1600" fullHeight>
      <Suspense fallback={<FileExplorerPageSkeleton />}>
        <ProjectAuditClient projectId={projectId} subhead={AUDIT_SUBHEAD} />
      </Suspense>
    </EnterpriseCompactPageShell>
  );
}
