import Link from "next/link";

type Props = { params: Promise<{ projectId: string }> };

export default async function ClientProposalsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Proposals</h1>
      <p className="text-sm text-slate-600">
        View and respond to proposals your team sends to you.
      </p>
      <Link
        href={`/projects/${projectId}/proposals`}
        className="inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Open proposals
      </Link>
    </div>
  );
}
