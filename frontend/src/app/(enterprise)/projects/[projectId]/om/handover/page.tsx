import type { Metadata } from "next";
import { OmHandoverClient } from "@/components/enterprise/OmHandoverClient";

export const metadata: Metadata = { title: "Handover & FM" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmHandoverPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in min-w-0 px-4 pb-8 pt-3 sm:px-6 sm:pb-10 sm:pt-5 lg:px-8 lg:pb-12">
      <div className="mx-auto w-full max-w-6xl pb-[env(safe-area-inset-bottom,0px)]">
        <OmHandoverClient projectId={projectId} />
      </div>
    </div>
  );
}
