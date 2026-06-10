import type { Metadata } from "next";
import { OmAssetsClient } from "@/components/enterprise/OmAssetsClient";

export const metadata: Metadata = { title: "Assets" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmAssetsPage({ params }: Props) {
  const { projectId } = await params;
  return <OmAssetsClient projectId={projectId} />;
}
