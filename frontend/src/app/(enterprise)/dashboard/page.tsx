import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";
import { ProjectRestoreEntryGate } from "@/components/enterprise/ProjectRestoreEntryGate";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <ProjectRestoreEntryGate loadingMessage="Loading dashboard…">
          <DashboardClient />
        </ProjectRestoreEntryGate>
      </div>
    </div>
  );
}
