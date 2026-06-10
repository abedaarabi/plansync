import type { Metadata } from "next";
import { OmPartsInventoryClient } from "@/components/enterprise/OmPartsInventoryClient";

export const metadata: Metadata = { title: "Parts inventory" };

type Props = { params: Promise<{ projectId: string }> };

export default async function WorkspaceOmPartsInventoryPage({ params }: Props) {
  const { projectId } = await params;
  return <OmPartsInventoryClient projectId={projectId} />;
}
