import type { Metadata } from "next";
import { ProjectTakeoffClient } from "@/components/enterprise/ProjectTakeoffClient";

export const metadata: Metadata = { title: "Quantity Takeoff" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectTakeoffPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <ProjectTakeoffClient projectId={projectId} />
      </div>
    </div>
  );
}
