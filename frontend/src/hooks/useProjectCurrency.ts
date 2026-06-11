"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjectSession } from "@/lib/api-client";
import { normalizeProjectCurrency, type ProjectCurrencyCode } from "@/lib/projectCurrency";
import { qk } from "@/lib/queryKeys";

/** Project currency from session (available on every project route). */
// fallow-ignore-next-line complexity
export function useProjectCurrency(projectId: string | undefined): {
  currency: ProjectCurrencyCode;
  isPending: boolean;
} {
  const { data: session, isPending } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  return {
    currency: normalizeProjectCurrency(session?.currency),
    isPending: Boolean(projectId && isPending && !session),
  };
}
