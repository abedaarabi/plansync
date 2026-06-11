"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { clearSkipProjectRestore, setLastProjectContext } from "@/lib/lastProject";
import { extractProjectIdFromPath } from "@/lib/projectScopedPath";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

/** Persists project id + path while browsing `/projects/:id/*`. */
export function ProjectContextSync() {
  const pathname = usePathname();
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;

  useEffect(() => {
    if (!wid) return;
    const projectId = extractProjectIdFromPath(pathname);
    if (!projectId) return;
    clearSkipProjectRestore();
    setLastProjectContext(wid, projectId, pathname);
  }, [wid, pathname]);

  return null;
}
