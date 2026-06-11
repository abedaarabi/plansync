"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { fetchProjects } from "@/lib/api-client";
import {
  initialRestorePhase,
  resolveRestoreOnEntry,
  storedProjectMissing,
  type RestorePhase,
} from "@/lib/projectRestoreLogic";
import { isProjectRestoreEntryPath } from "@/lib/lastProject";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import type { Project } from "@/types/projects";

// fallow-ignore-next-line complexity
function syncRestoreAfterProjectsLoad(
  phase: RestorePhase,
  projectsPending: boolean,
  wid: string | undefined,
  projects: Project[],
  setPhase: (phase: RestorePhase) => void,
) {
  if (phase !== "redirecting" || projectsPending || !wid) return;
  if (storedProjectMissing(wid, projects)) setPhase("show");
}

/** Blocks hub/dashboard until last-project restore completes or is skipped. */
// fallow-ignore-next-line complexity
export function useProjectRestoreEntry() {
  const pathname = usePathname();
  const router = useRouter();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);
  const isEntry = isProjectRestoreEntryPath(pathname);

  const [phase, setPhase] = useState<RestorePhase>(initialRestorePhase);

  const { data: projects = [], isPending: projectsPending } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro && isEntry && phase === "redirecting"),
  });

  useLayoutEffect(() => {
    const result = resolveRestoreOnEntry(isEntry, ctxLoading, wid, pathname);
    if (!result) return;
    setPhase(result.phase);
    if (result.target) router.replace(result.target);
  }, [isEntry, pathname, ctxLoading, wid, router]);

  useEffect(() => {
    syncRestoreAfterProjectsLoad(phase, projectsPending, wid, projects, setPhase);
  }, [phase, projectsPending, projects, wid]);

  return { blocking: isEntry && phase !== "show" };
}
