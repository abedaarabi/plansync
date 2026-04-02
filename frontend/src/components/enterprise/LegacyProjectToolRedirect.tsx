"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import type { ProjectToolSegment } from "./useProjectNavHref";
import { useProjectNavHref } from "./useProjectNavHref";

export function LegacyProjectToolRedirect({ segment }: { segment: ProjectToolSegment }) {
  const router = useRouter();
  const { hrefFor, projectId } = useProjectNavHref();

  useEffect(() => {
    if (projectId) router.replace(hrefFor(segment));
    else router.replace("/projects");
  }, [projectId, router, hrefFor, segment]);

  const openingLabel =
    segment === "rfi" ? "RFIs" : segment === "punch" ? "punch list" : "field reports";

  return (
    <EnterpriseLoadingState
      message={`Opening ${openingLabel}…`}
      label={`Opening ${openingLabel}`}
    />
  );
}
