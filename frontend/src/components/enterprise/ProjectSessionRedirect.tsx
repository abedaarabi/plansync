"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProjectSession } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

/** Sends client-role users to the client portal shell (not the internal app). */
export function ProjectSessionRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1];

  const { data } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(
      projectId &&
      projectId !== "new" &&
      pathname.startsWith("/projects/") &&
      !pathname.startsWith("/client"),
    ),
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!data || !projectId) return;
    if (data.uiMode === "client") {
      router.replace(`/client/${projectId}`);
    }
  }, [data, projectId, router]);

  return null;
}
