import type { Metadata } from "next";
import { ProjectHubClient } from "@/components/enterprise/ProjectHubClient";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl">
        <ProjectHubClient />
      </div>
    </div>
  );
}
