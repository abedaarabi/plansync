import type { Metadata } from "next";
import { OmHandoverClient } from "@/components/enterprise/OmHandoverClient";

export const metadata: Metadata = { title: "Handover & FM" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmHandoverPage({ params }: Props) {
  const { projectId } = await params;
  return <OmHandoverClient projectId={projectId} />;
}
