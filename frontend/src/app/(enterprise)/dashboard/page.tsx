import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";
import { ProjectRestoreEntryGate } from "@/components/enterprise/ProjectRestoreEntryGate";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mobile-app-page enterprise-animate-in w-full max-w-full p-4 sm:p-5 lg:p-8">
      <div className="mx-auto w-full max-w-full lg:max-w-6xl">
        <ProjectRestoreEntryGate loadingMessage="Loading dashboard…">
          <DashboardClient />
        </ProjectRestoreEntryGate>
      </div>
    </div>
  );
}
