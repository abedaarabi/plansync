"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjectSession } from "@/lib/api-client";
import {
  normalizeProjectMeasurementSystem,
  type ProjectMeasurementSystem,
} from "@/lib/projectMeasurement";
import { qk } from "@/lib/queryKeys";

/** Project measurement system from session (available on every project route). */
export function useProjectMeasurementSystem(projectId: string | undefined): {
  measurementSystem: ProjectMeasurementSystem;
  isPending: boolean;
} {
  const { data: session, isPending } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  return {
    measurementSystem: normalizeProjectMeasurementSystem(session?.measurementSystem),
    isPending: Boolean(projectId && isPending && !session),
  };
}
