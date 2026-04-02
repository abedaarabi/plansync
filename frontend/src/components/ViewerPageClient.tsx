"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ViewerSourceBootstrap } from "@/components/ViewerSourceBootstrap";
import { fetchMe } from "@/lib/api-client";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { QueryProvider } from "@/providers/QueryProvider";
import { useViewerStore } from "@/store/viewerStore";

const ViewerShell = dynamic(
  () => import("@/components/ViewerShell").then((m) => ({ default: m.ViewerShell })),
  {
    ssr: false,
    loading: () => (
      <div className="viewer-shell-bg flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
        Loading PlanSync…
      </div>
    ),
  },
);

/** Pro users must open PDFs from Projects (cloud), not local blob files. */
function ViewerProLocalGuard() {
  const router = useRouter();
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const resetSession = useViewerStore((s) => s.resetSession);
  const { data: me, isPending } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isPending) return;
    if (!meHasProWorkspace(me ?? null)) return;
    if (!pdfUrl) return;
    if (cloudFileVersionId) return;
    if (!pdfUrl.startsWith("blob:")) return;
    resetSession();
    router.replace("/projects");
  }, [isPending, me, pdfUrl, cloudFileVersionId, resetSession, router]);

  return null;
}

export function ViewerPageClient() {
  return (
    <QueryProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--viewer-shell)] text-zinc-100">
        <ViewerSourceBootstrap />
        <ViewerProLocalGuard />
        <ViewerShell />
      </div>
    </QueryProvider>
  );
}
