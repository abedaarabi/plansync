import type { Metadata } from "next";
import { OmInspectionsClient } from "@/components/enterprise/OmInspectionsClient";

export const metadata: Metadata = { title: "Inspections" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmInspectionsPage({ params }: Props) {
  const { projectId } = await params;
  return <OmInspectionsClient projectId={projectId} />;
}
