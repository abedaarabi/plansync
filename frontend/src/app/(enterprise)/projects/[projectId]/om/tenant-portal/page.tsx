import type { Metadata } from "next";
import { OmTenantPortalClient } from "@/components/enterprise/OmTenantPortalClient";

export const metadata: Metadata = { title: "Tenant portal" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmTenantPortalPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <OmTenantPortalClient projectId={projectId} />
      </div>
    </div>
  );
}
