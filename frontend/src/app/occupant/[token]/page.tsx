import type { Metadata } from "next";
import { OccupantPortalPublicClient } from "@/components/enterprise/OccupantPortalPublicClient";
import { QueryProvider } from "@/providers/QueryProvider";

export const metadata: Metadata = { title: "Report an issue" };

type Props = { params: Promise<{ token: string }> };

export default async function OccupantPortalPage({ params }: Props) {
  const { token } = await params;
  return (
    <QueryProvider>
      <div className="min-h-dvh bg-slate-50 text-slate-900">
        <OccupantPortalPublicClient token={token} />
      </div>
    </QueryProvider>
  );
}
