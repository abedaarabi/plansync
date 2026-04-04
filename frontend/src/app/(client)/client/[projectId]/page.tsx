import Link from "next/link";
import { FileStack } from "lucide-react";

type Props = { params: Promise<{ projectId: string }> };

export default async function ClientProjectHomePage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Drawings</h1>
        <p className="mt-1 text-sm text-slate-600">
          View the latest published sheets. Open the full project viewer from Files &amp; Drawings
          in the internal app when your team shares links.
        </p>
      </div>
      <Link
        href={`/projects/${projectId}/files`}
        className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-blue-200 hover:bg-blue-50/50"
      >
        <FileStack className="h-5 w-5 shrink-0 text-blue-600" />
        Open files &amp; drawings
      </Link>
    </div>
  );
}
