import type { Metadata } from "next";
import { OmInspectionsClient } from "@/components/enterprise/OmInspectionsClient";

export const metadata: Metadata = { title: "Inspections" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmInspectionsPage({ params }: Props) {
  const { projectId } = await params;
  return <OmInspectionsClient projectId={projectId} />;
}
