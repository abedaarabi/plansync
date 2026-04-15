"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { workspaceIdFromNextIfMember } from "@/lib/workspacePreference";

export function WorkspacesHubClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawNext = sp.get("next") ?? "/projects";
  const nextPath = rawNext.startsWith("/") ? rawNext : `/${rawNext}`;
  const { me, loading, setActiveWorkspaceId } = useEnterpriseWorkspace();
  const [autoDone, setAutoDone] = useState(false);

  const pinnedId = useMemo(
    () => (me ? workspaceIdFromNextIfMember(nextPath, me) : null),
    [me, nextPath],
  );

  useLayoutEffect(() => {
    if (loading || !me || autoDone) return;
    const n = me.workspaces?.length ?? 0;
    if (n === 0) {
      setAutoDone(true);
      router.replace("/dashboard");
      return;
    }
    if (pinnedId) {
      setAutoDone(true);
      setActiveWorkspaceId(pinnedId);
      router.replace(nextPath);
      return;
    }
    if (n === 1) {
      setAutoDone(true);
      setActiveWorkspaceId(me.workspaces[0]!.workspace.id);
      router.replace(nextPath);
    }
  }, [autoDone, loading, me, nextPath, pinnedId, router, setActiveWorkspaceId]);

  if (loading || !me) {
    return <EnterpriseLoadingState message="Loading workspaces…" label="Loading workspaces" />;
  }

  const n = me.workspaces.length;
  if (n === 0 || n === 1 || pinnedId || autoDone) {
    return <EnterpriseLoadingState message="Opening PlanSync…" label="Continuing to the app" />;
  }

  return (
    <div className="enterprise-animate-in flex min-h-[min(560px,70vh)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 shadow-[var(--enterprise-shadow-md)] sm:p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
          <Building2 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
          Choose a workspace
        </h1>
        <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
          Your account is in more than one organization. Pick one to continue, or switch anytime
          from the top bar.
        </p>
        <ul className="mt-6 space-y-2">
          {me.workspaces.map((mw) => (
            <li key={mw.workspace.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveWorkspaceId(mw.workspace.id);
                  router.replace(nextPath);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--enterprise-text)] transition hover:border-[var(--enterprise-primary)]/40 hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{mw.workspace.name}</span>
                  {mw.workspace.slug ? (
                    <span className="truncate text-xs font-normal text-[var(--enterprise-text-muted)]">
                      {mw.workspace.slug}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
