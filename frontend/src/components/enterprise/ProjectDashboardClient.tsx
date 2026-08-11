"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  fetchProjects,
  fetchProject,
  fetchIssuesForProject,
  fetchProjectRfis,
  fetchProjectPunch,
  fetchProjectDashboard,
} from "@/lib/api-client";
import { parseProjectCoords } from "@/lib/projectGeo";
import { geocodeLocationName } from "@/lib/openMeteoGeocode";
import { DashboardActivityChart } from "@/components/enterprise/DashboardActivityChart";
import { ProjectHomeOverviewCharts } from "@/components/enterprise/ProjectHomeOverviewCharts";
import { ProjectHomeHero } from "@/components/enterprise/project-home/ProjectHomeHero";
import { ProjectHomeKpiStrip } from "@/components/enterprise/project-home/ProjectHomeKpiStrip";
import { ProjectHomeQuickActions } from "@/components/enterprise/project-home/ProjectHomeQuickActions";
import { ProjectHomeSiteSection } from "@/components/enterprise/project-home/ProjectHomeSiteSection";
import { ProjectHomeRecentFiles } from "@/components/enterprise/project-home/ProjectHomeRecentFiles";
import { ProjectHomeRecentPunch } from "@/components/enterprise/project-home/ProjectHomeRecentPunch";
import { ProjectHomeHealthCards } from "@/components/enterprise/project-home/ProjectHomeHealthCards";
import {
  fileRecencySortKey,
  sortedFileVersions,
} from "@/components/enterprise/project-home/projectHomeUtils";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import type { CloudFile } from "@/types/projects";
import { openBimViewer } from "@/lib/bim/openBimViewer";
import { isIfcFile } from "@/lib/isPdfFile";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { ProjectEditSlideOver } from "./ProjectEditSlideOver";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type Props = {
  projectId: string;
};

// fallow-ignore-next-line complexity
export function ProjectDashboardClient({ projectId }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const nowMs = useTickNowMs();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isAdmin = primary?.role === "ADMIN" || primary?.role === "SUPER_ADMIN";
  const isPro = isWorkspaceProClient(primary?.workspace);

  const { data: projects = [], isPending: projPending } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const project = projects.find((p) => p.id === projectId);

  /** Authoritative row for coords (list payload can lag after edits). */
  const { data: projectMeta, isPending: projectMetaPending } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const savedCoords = useMemo(
    () => parseProjectCoords(projectMeta) ?? parseProjectCoords(project),
    [projectMeta, project],
  );

  const locationText = (projectMeta?.location ?? project?.location)?.trim() ?? "";

  const { data: geocoded, isPending: geocodePending } = useQuery({
    queryKey: ["geocodeOpenMeteo", locationText],
    queryFn: () => geocodeLocationName(locationText),
    enabled:
      Boolean(projectId && isPro && locationText.length > 0 && !savedCoords) && !projectMetaPending,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const mapCoords = savedCoords ?? (geocoded ? { lat: geocoded.lat, lng: geocoded.lng } : null);
  const isApproximateLocation = !savedCoords && Boolean(geocoded);

  function openFile(f: CloudFile) {
    const sv = sortedFileVersions(f);
    const v = sv[0];
    const q = new URLSearchParams({ fileId: f.id, name: f.name });
    q.set("projectId", projectId);
    if (v) {
      q.set("version", String(v.version));
      q.set("fileVersionId", v.id);
    }
    if (isIfcFile(f)) {
      openBimViewer(`/bim-viewer?${q.toString()}`);
      return;
    }
    router.push(`/viewer?${q.toString()}`);
  }

  const { data: rfis = [] } = useQuery({
    queryKey: qk.projectRfis(projectId),
    queryFn: () => fetchProjectRfis(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const { data: punchItems = [] } = useQuery({
    queryKey: qk.projectPunch(projectId),
    queryFn: () => fetchProjectPunch(projectId),
    enabled: Boolean(projectId && isPro),
  });
  const { data: issues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const { data: projectDash, isPending: projectDashPending } = useQuery({
    queryKey: qk.projectDashboard(projectId),
    queryFn: () => fetchProjectDashboard(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const loading = ctxLoading || projPending;

  if (loading) {
    return <EnterpriseLoadingState message="Loading project…" label="Loading project overview" />;
  }

  if (!project) {
    return (
      <div className="enterprise-card p-8 text-center text-sm text-[var(--enterprise-text-muted)]">
        Project not found.{" "}
        <Link
          href="/projects"
          className="font-semibold text-[var(--enterprise-primary)] hover:underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  const openRfis = rfis.filter((r) => {
    const s = r.status.toUpperCase();
    return s === "OPEN" || s === "IN_REVIEW";
  }).length;
  const openIssues = issues.filter((i) => i.status !== "closed" && i.status !== "CLOSED").length;
  const highPriorityIssues = issues.filter((i) => i.priority?.toLowerCase() === "high").length;
  const overdueIssues = issues.filter((i) => {
    if (!i.dueDate) return false;
    return new Date(i.dueDate).getTime() < nowMs && i.status.toLowerCase() !== "closed";
  }).length;
  const fileCount = project.files.length;
  const folderCount = project.folders.length;
  const progress = typeof project.progressPercent === "number" ? project.progressPercent : 0;

  const recentFiles = [...project.files]
    .sort((a, b) => fileRecencySortKey(b) - fileRecencySortKey(a))
    .slice(0, 5);

  const continueFile =
    recentFiles[0]?.lastOpenedAt != null && recentFiles[0].lastOpenedAt !== ""
      ? recentFiles[0]
      : null;

  const recentPunch = [...punchItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const activitySeries = projectDash?.activityLast14Days ?? [];
  const last7Total = activitySeries.slice(-7).reduce((a, x) => a + x.count, 0);

  return (
    <div className={`min-w-0 max-w-full ${OM_PAGE_CLASS}`}>
      <ProjectHomeHero
        projectId={projectId}
        name={project.name}
        logoUrl={project.logoUrl}
        projectNumber={project.projectNumber}
        location={project.location}
        stage={project.stage}
        startDate={project.startDate}
        endDate={project.endDate}
        fileCount={fileCount}
        folderCount={folderCount}
        onEdit={() => setEditOpen(true)}
      />

      <ProjectHomeKpiStrip
        projectId={projectId}
        openIssues={openIssues}
        overdueIssues={overdueIssues}
        fileCount={fileCount}
        openRfis={openRfis}
      />

      <ProjectHomeQuickActions projectId={projectId} />

      <ProjectHomeHealthCards
        projectId={projectId}
        progress={progress}
        highPriorityIssues={highPriorityIssues}
        folderCount={folderCount}
        fileCount={fileCount}
      />

      <ProjectHomeSiteSection
        mapCoords={mapCoords}
        isApproximateLocation={isApproximateLocation}
        locationText={locationText}
        savedCoords={savedCoords}
        projectMetaPending={projectMetaPending}
        geocodePending={geocodePending}
        onEdit={() => setEditOpen(true)}
      />

      <ProjectEditSlideOver
        open={editOpen}
        project={project}
        workspaceId={wid}
        canDeleteProject={isAdmin && !primary?.isExternal}
        onProjectDeleted={() => {
          router.push("/projects");
        }}
        onClose={() => setEditOpen(false)}
      />

      <div className="grid min-w-0 gap-3 lg:grid-cols-2 lg:items-stretch">
        <ProjectHomeOverviewCharts
          projectId={projectId}
          issues={issues}
          punchItems={punchItems}
          rfis={rfis}
        />

        <section className="enterprise-card flex min-h-[15rem] min-w-0 flex-col overflow-hidden p-0 sm:min-h-[17rem] lg:h-full lg:min-h-0">
          <div className="flex shrink-0 flex-col gap-1 border-b border-[var(--enterprise-border)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
                Project activity
              </h2>
              <p className="enterprise-type-caption mt-0.5">
                Audit events for this project · last 14 days
              </p>
            </div>
            <p className="text-xs text-[var(--enterprise-text-muted)]">
              Last 7 days{" "}
              <strong className="font-semibold tabular-nums text-[var(--enterprise-text)]">
                {last7Total}
              </strong>
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3.5 sm:p-4">
            {projectDashPending && !projectDash ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 text-sm text-[var(--enterprise-text-muted)]">
                Loading activity…
              </div>
            ) : (
              <DashboardActivityChart
                compact
                fillHeight
                className="min-h-0"
                data={activitySeries}
                ariaLabel="14-day project activity chart"
                caption="Only events recorded for this project (not the whole workspace)."
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <ProjectHomeRecentFiles
          projectId={projectId}
          recentFiles={recentFiles}
          continueFile={continueFile}
          nowMs={nowMs}
          onOpenFile={openFile}
        />
        <ProjectHomeRecentPunch projectId={projectId} items={recentPunch} />
      </div>
    </div>
  );
}
