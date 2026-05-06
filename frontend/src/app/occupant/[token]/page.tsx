import type { Metadata } from "next";
import { OccupantPortalPublicClient } from "@/components/enterprise/OccupantPortalPublicClient";
import { QueryProvider } from "@/providers/QueryProvider";

export const metadata: Metadata = { title: "Report an issue" };

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string }>;
};

export default async function OccupantPortalPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { a } = await searchParams;
  const initialAssetSecret = typeof a === "string" && a.trim() ? a.trim() : undefined;
  return (
    <QueryProvider>
      <div className="min-h-dvh overflow-x-hidden bg-[var(--enterprise-bg)] text-[var(--enterprise-text)] antialiased">
        <OccupantPortalPublicClient token={token} initialAssetSecret={initialAssetSecret} />
      </div>
    </QueryProvider>
  );
}
