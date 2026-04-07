"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProjects } from "@/lib/api-client";
import {
  getLastProjectId,
  LAST_PROJECT_CHANGED_EVENT,
  LAST_PROJECT_STORAGE_KEY,
} from "@/lib/lastProject";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

export type ProjectToolSegment = "rfi" | "punch" | "reports";

export function useProjectNavHref() {
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace.subscriptionStatus);
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_PROJECT_STORAGE_KEY) bump();
    };
    window.addEventListener(LAST_PROJECT_CHANGED_EVENT, bump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LAST_PROJECT_CHANGED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const activeProject = useMemo(() => {
    void tick;
    const stored = getLastProjectId();
    if (stored) {
      const found = projects.find((p) => p.id === stored);
      if (found) return found;
    }
    return projects[0] ?? null;
  }, [projects, tick]);

  const effectiveProjectId = activeProject?.id ?? null;

  const hrefFor = useCallback(
    (segment: ProjectToolSegment) =>
      effectiveProjectId ? `/projects/${effectiveProjectId}/${segment}` : "/projects",
    [effectiveProjectId],
  );

  return { projectId: effectiveProjectId, activeProject, hrefFor, projects };
}
