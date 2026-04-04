import { ClientPortalShell } from "./ClientPortalShell";

type Props = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function ClientProjectLayout({ children, params }: Props) {
  const { projectId } = await params;
  return <ClientPortalShell projectId={projectId}>{children}</ClientPortalShell>;
}
