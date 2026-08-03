/**
 * Fetches the project issues list (+ session for promote permission).
 * Query key includes issueKind and optional assetId so filtered views stay cached separately.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIssuesForProject, fetchProjectSession } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import type { IssueKind } from "./types";

export function useProjectIssuesData(
  projectId: string,
  issueKindFilter: IssueKind,
  filterAssetId: string | undefined,
) {
  const issuesKey = qk.issuesForProject(projectId, undefined, issueKindFilter, filterAssetId);
  const { data: items = [], isPending } = useQuery({
    queryKey: issuesKey,
    queryFn: () =>
      fetchIssuesForProject(projectId, { issueKind: issueKindFilter, assetId: filterAssetId }),
  });
  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });
  const canPromoteOccupant = Boolean(
    issueKindFilter === "OCCUPANT" && projectSession && !projectSession.isExternal,
  );
  return { issuesKey, items, isPending, canPromoteOccupant };
}
