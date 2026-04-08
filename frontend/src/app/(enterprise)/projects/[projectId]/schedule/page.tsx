import type { Metadata } from "next";
import { ProjectScheduleClient } from "@/components/enterprise/ProjectScheduleClient";

export const metadata: Metadata = { title: "Schedule" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectSchedulePage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        <ProjectScheduleClient projectId={projectId} />
      </div>
    </div>
  );
}
