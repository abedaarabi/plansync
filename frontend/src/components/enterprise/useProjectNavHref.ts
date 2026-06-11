"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProjects } from "@/lib/api-client";
import {
  getLastProjectContext,
  getLastProjectId,
  LAST_PROJECT_CHANGED_EVENT,
  LAST_PROJECT_CONTEXT_KEY,
  LAST_PROJECT_STORAGE_KEY,
} from "@/lib/lastProject";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import type { Project } from "@/types/projects";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

export type ProjectToolSegment = "rfi" | "punch" | "reports";

function storedProjectId(wid: string | undefined): string | null {
  return getLastProjectContext(wid)?.projectId ?? getLastProjectId(wid);
}

function resolveActiveProject(projects: Project[], wid: string | undefined): Project | null {
  const fallback = projects[0] ?? null;
  const stored = storedProjectId(wid);
  if (!stored) return fallback;
  return projects.find((p) => p.id === stored) ?? fallback;
}

function isLastProjectStorageKey(key: string | null) {
  return key === LAST_PROJECT_STORAGE_KEY || key === LAST_PROJECT_CONTEXT_KEY;
}

// fallow-ignore-next-line complexity
export function useProjectNavHref() {
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (isLastProjectStorageKey(e.key)) bump();
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
    return resolveActiveProject(projects, wid);
  }, [projects, tick, wid]);

  const effectiveProjectId = activeProject?.id ?? null;

  const hrefFor = useCallback(
    (segment: ProjectToolSegment) =>
      effectiveProjectId ? `/projects/${effectiveProjectId}/${segment}` : "/projects",
    [effectiveProjectId],
  );

  return { projectId: effectiveProjectId, activeProject, hrefFor, projects };
}
