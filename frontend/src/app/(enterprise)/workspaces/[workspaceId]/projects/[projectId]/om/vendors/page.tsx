import type { Metadata } from "next";
import { OmVendorsClient } from "@/components/enterprise/OmVendorsClient";

export const metadata: Metadata = { title: "Vendors" };

type Props = { params: Promise<{ projectId: string }> };

export default async function WorkspaceOmVendorsPage({ params }: Props) {
  const { projectId } = await params;
  return <OmVendorsClient projectId={projectId} />;
}
