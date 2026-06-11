import type { Metadata } from "next";
import { ProjectHubClient } from "@/components/enterprise/ProjectHubClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { ProjectRestoreEntryGate } from "@/components/enterprise/ProjectRestoreEntryGate";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <EnterpriseCompactPageShell maxWidth="6xl">
      <ProjectRestoreEntryGate loadingMessage="Loading projects…">
        <ProjectHubClient />
      </ProjectRestoreEntryGate>
    </EnterpriseCompactPageShell>
  );
}
