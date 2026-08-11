import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { ProjectRestoreEntryGate } from "@/components/enterprise/ProjectRestoreEntryGate";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <EnterpriseCompactPageShell maxWidth="6xl">
      <ProjectRestoreEntryGate loadingMessage="Loading dashboard…">
        <DashboardClient />
      </ProjectRestoreEntryGate>
    </EnterpriseCompactPageShell>
  );
}
