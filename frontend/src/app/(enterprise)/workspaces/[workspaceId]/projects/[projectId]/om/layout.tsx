import { OmCmmsHubLayout } from "@/components/enterprise/OmCmmsHubLayout";

type Props = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function WorkspaceOmLayout({ children, params }: Props) {
  const { projectId } = await params;
  return <OmCmmsHubLayout projectId={projectId}>{children}</OmCmmsHubLayout>;
}
