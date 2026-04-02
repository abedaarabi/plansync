"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { fetchProject } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

type Props = {
  projectId: string;
  currentLabel: string;
};

export function ProjectScopeHeader({ projectId, currentLabel }: Props) {
  const { data: project, isPending } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
  });

  return (
    <nav
      className="mb-8 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--enterprise-text-muted)]"
      aria-label="Breadcrumb"
    >
      <Link
        href="/projects"
        className="enterprise-breadcrumb-pill text-[var(--enterprise-primary)] transition hover:border-[var(--enterprise-primary)]/40 hover:bg-[var(--enterprise-primary-soft)]"
      >
        Projects
      </Link>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]/50"
        aria-hidden
      />
      <span className="enterprise-breadcrumb-pill max-w-[min(100%,280px)] truncate text-[var(--enterprise-text)]">
        {isPending ? "…" : (project?.name ?? "Project")}
      </span>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]/50"
        aria-hidden
      />
      <span className="enterprise-breadcrumb-pill font-medium text-[var(--enterprise-text)]">
        {currentLabel}
      </span>
    </nav>
  );
}
