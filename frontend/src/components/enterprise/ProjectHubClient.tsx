"use client";

import { apiUrl } from "@/lib/api-url";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  LayoutGrid,
  List,
  MessageSquareQuote,
  Pencil,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { EnterpriseAddPulseWrap } from "@/components/enterprise/EnterpriseAddPulseWrap";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { EnterpriseFab } from "@/components/mobile/EnterpriseFab";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import {
  applyFolderStructure,
  fetchFolderStructureTemplates,
  fetchProjects,
  ProRequiredError,
} from "@/lib/api-client";
import type { ProjectStageValue } from "@/lib/projectStage";
import type { ProjectCurrencyCode } from "@/lib/projectCurrency";
import type { ProjectMeasurementSystem } from "@/lib/projectMeasurement";
import { qk } from "@/lib/queryKeys";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import {
  NewProjectDialog,
  type InitialFolderStructureOption,
  type NewProjectDialogValues,
} from "./NewProjectDialog";
import { ProjectEditSlideOver } from "./ProjectEditSlideOver";
import { ProjectLogo } from "./ProjectLogo";
import { ProjectProgressBar } from "./ProjectProgressBar";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { ProjectTypeChip } from "./ProjectTypeChip";
import type { Project } from "@/types/projects";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getLatestActivity(project: Project): string {
  const dates = project.files
    .map((f) => f.updatedAt)
    .filter(Boolean)
    .map((d) => new Date(d!).getTime());
  if (dates.length === 0) return "Just created";
  return relativeTime(new Date(Math.max(...dates)).toISOString());
}

function projectListSubtitle(project: Project): string {
  return (
    [
      project.projectType?.trim(),
      project.projectNumber?.trim() ? `#${project.projectNumber.trim()}` : null,
      project.location?.trim(),
    ]
      .filter(Boolean)
      .join(" · ") || "No details"
  );
}

function ProjectListMobileRow({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const progress = typeof project.progressPercent === "number" ? project.progressPercent : 0;

  return (
    <li className="border-b border-[var(--enterprise-border)] last:border-b-0">
      <div className="flex items-stretch gap-0.5 px-3 py-2.5">
        <Link
          href={`/projects/${project.id}`}
          className="mobile-tappable-row flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5 transition active:scale-[0.99] active:bg-[var(--enterprise-hover-surface)]"
        >
          <ProjectLogo name={project.name} logoUrl={project.logoUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
              {project.name}
            </p>
            <p className="truncate text-[11px] text-[var(--enterprise-text-muted)]">
              {projectListSubtitle(project)}
            </p>
          </div>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
            strokeWidth={2}
            aria-hidden
          />
        </Link>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${project.name}`}
          className="mobile-touch-target inline-flex shrink-0 items-center justify-center rounded-lg text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)] active:scale-[0.97]"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="space-y-2 px-3 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {project.projectType?.trim() ? <ProjectTypeChip type={project.projectType} /> : null}
          <ProjectStageBadge stage={project.stage} />
        </div>
        <ProjectProgressBar value={progress} height={7} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
            {project.files.length} files
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            {getLatestActivity(project)}
          </span>
        </div>
      </div>
    </li>
  );
}

// fallow-ignore-next-line complexity
export function ProjectHubClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isAdmin = primary?.role === "ADMIN" || primary?.role === "SUPER_ADMIN";
  const isPro = isWorkspaceProClient(primary?.workspace);
  const sub = primary?.workspace.subscriptionStatus;

  const { data: projects = [], isPending: projectsPending } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const { data: folderStructureTemplates = [] } = useQuery({
    queryKey: qk.folderStructureTemplates(wid ?? ""),
    queryFn: () => fetchFolderStructureTemplates(wid!),
    enabled: Boolean(wid && isPro),
  });

  const [projectModal, setProjectModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [currency, setCurrency] = useState<ProjectCurrencyCode>("USD");
  const [measurementSystem, setMeasurementSystem] = useState<ProjectMeasurementSystem>("METRIC");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [localBudget, setLocalBudget] = useState("");
  const [projectSize, setProjectSize] = useState("");
  const [projectType, setProjectType] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [projectStage, setProjectStage] = useState<ProjectStageValue>("NOT_STARTED");
  const [progressPercent, setProgressPercent] = useState(0);
  const [initialFolderStructure, setInitialFolderStructure] =
    useState<InitialFolderStructureOption>("none");
  const [folderTemplateId, setFolderTemplateId] = useState("");
  const [copyFromProjectId, setCopyFromProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  const resetNewProjectForm = useCallback(() => {
    setProjectName("");
    setStartDate("");
    setEndDate("");
    setProjectNumber("");
    setLocalBudget("");
    setProjectSize("");
    setProjectType("");
    setLocation("");
    setWebsiteUrl("");
    setProjectStage("NOT_STARTED");
    setProgressPercent(0);
    setCurrency("USD");
    setMeasurementSystem("METRIC");
    setInitialFolderStructure("none");
    setFolderTemplateId("");
    setCopyFromProjectId("");
  }, []);

  useEffect(() => {
    if (folderStructureTemplates[0]?.id && !folderTemplateId) {
      setFolderTemplateId(folderStructureTemplates[0].id);
    }
  }, [folderStructureTemplates, folderTemplateId]);

  useEffect(() => {
    if (projects[0]?.id && !copyFromProjectId) {
      setCopyFromProjectId(projects[0].id);
    }
  }, [projects, copyFromProjectId]);

  const onNewProjectFieldChange = useCallback(
    (field: keyof NewProjectDialogValues, value: string | number) => {
      if (field === "progressPercent") {
        setProgressPercent(typeof value === "number" ? value : Number(value));
        return;
      }
      if (field === "projectStage") {
        setProjectStage(value as ProjectStageValue);
        return;
      }
      if (field === "currency") {
        setCurrency(value as ProjectCurrencyCode);
        return;
      }
      if (field === "measurementSystem") {
        setMeasurementSystem(value as ProjectMeasurementSystem);
        return;
      }
      if (field === "initialFolderStructure") {
        setInitialFolderStructure(value as InitialFolderStructureOption);
        return;
      }
      if (field === "folderTemplateId") {
        setFolderTemplateId(String(value));
        return;
      }
      if (field === "copyFromProjectId") {
        setCopyFromProjectId(String(value));
        return;
      }
      const v = String(value);
      switch (field) {
        case "projectName":
          setProjectName(v);
          break;
        case "startDate":
          setStartDate(v);
          break;
        case "endDate":
          setEndDate(v);
          break;
        case "projectNumber":
          setProjectNumber(v);
          break;
        case "localBudget":
          setLocalBudget(v);
          break;
        case "projectSize":
          setProjectSize(v);
          break;
        case "projectType":
          setProjectType(v);
          break;
        case "location":
          setLocation(v);
          break;
        case "websiteUrl":
          setWebsiteUrl(v);
          break;
        default:
          break;
      }
    },
    [],
  );

  const loading = ctxLoading || (Boolean(wid && isPro) && projectsPending);

  // fallow-ignore-next-line complexity
  async function onCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!wid || !projectName.trim() || !startDate || !endDate || !isAdmin) return;
    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    const ifs = initialFolderStructure;
    const tplId = folderTemplateId;
    const copyId = copyFromProjectId;
    try {
      const res = await fetch(apiUrl(`/api/v1/workspaces/${wid}/projects`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          startDate,
          endDate,
          currency,
          measurementSystem,
          projectNumber: projectNumber.trim() || undefined,
          localBudget: localBudget.trim() || undefined,
          projectSize: projectSize.trim() || undefined,
          projectType: projectType.trim() || undefined,
          location: location.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          stage: projectStage,
          progressPercent,
        }),
      });
      if (res.status === 402) {
        setError("Pro subscription required to create projects.");
        return;
      }
      if (!res.ok) {
        let msg = "Could not create project.";
        try {
          const j = (await res.json()) as { error?: unknown };
          if (typeof j.error === "string") msg = j.error;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const p = (await res.json()) as Project;
      setProjectModal(false);
      resetNewProjectForm();
      queryClient.setQueryData<Project[]>(qk.projects(wid), (old) => {
        const created: Project = { ...p, folders: p.folders ?? [], files: p.files ?? [] };
        const rest = (old ?? []).filter((row) => row.id !== p.id);
        return [...rest, created];
      });
      await queryClient.invalidateQueries({ queryKey: qk.projects(wid) });

      if (ifs === "template" && tplId) {
        try {
          await applyFolderStructure(p.id, {
            targetParentId: null,
            source: { kind: "template", templateId: tplId },
          });
        } catch (err) {
          if (err instanceof ProRequiredError) {
            toast.error("Pro subscription required to apply folder template.");
          } else {
            toast.error(
              err instanceof Error ? err.message : "Folder template could not be applied.",
            );
          }
        }
      } else if (ifs === "copy" && copyId) {
        try {
          await applyFolderStructure(p.id, {
            targetParentId: null,
            source: { kind: "project", sourceProjectId: copyId },
          });
        } catch (err) {
          if (err instanceof ProRequiredError) {
            toast.error("Pro subscription required to copy folder structure.");
          } else {
            toast.error(
              err instanceof Error ? err.message : "Folder structure could not be copied.",
            );
          }
        }
      }

      router.push(`/projects/${p.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <EnterpriseLoadingState message="Loading projects…" label="Loading workspace projects" />
    );
  }

  if (!primary || !wid) {
    return (
      <div className="enterprise-card p-8 text-center text-sm text-[var(--enterprise-text-muted)]">
        Sign in and join a workspace to manage projects.
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="enterprise-alert-warning p-6 text-sm">
        Cloud projects require an <strong className="font-semibold">active Pro</strong>{" "}
        subscription.
      </div>
    );
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleProjects = normalizedSearch
    ? projects.filter((project) => {
        const haystack = [
          project.name,
          project.projectNumber,
          project.location,
          project.projectType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : projects;

  return (
    <div className={`w-full min-w-0 max-w-full ${OM_PAGE_CLASS}`}>
      <OmSubPageHeader
        icon={FolderKanban}
        title={`${visibleProjects.length} Project${visibleProjects.length === 1 ? "" : "s"}`}
        description="Open a project to work drawings, issues, and field items."
        action={
          isAdmin ? (
            <EnterpriseAddPulseWrap>
              <button
                type="button"
                onClick={() => setProjectModal(true)}
                className="hidden min-h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)] lg:inline-flex"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                New project
              </button>
            </EnterpriseAddPulseWrap>
          ) : undefined
        }
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:max-w-xs lg:max-w-sm" htmlFor="project-search">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
              aria-hidden
            />
            <input
              id="project-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, type, or location"
              className="enterprise-field-input enterprise-field-input--icon-sm min-h-9 w-full bg-[var(--enterprise-bg)] pr-2.5 text-sm focus:bg-[var(--enterprise-surface)]"
            />
          </label>
          <div
            className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-0.5"
            role="tablist"
            aria-label="Project view mode"
          >
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition ${
                viewMode === "card"
                  ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]"
                  : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-bg)]"
              }`}
              aria-pressed={viewMode === "card"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Card
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition ${
                viewMode === "list"
                  ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]"
                  : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-bg)]"
              }`}
              aria-pressed={viewMode === "list"}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>
      </OmSubPageHeader>

      {sub === "trialing" && (
        <div className="enterprise-alert-warning flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--enterprise-semantic-warning-text)]" />
            <span className="text-xs font-medium text-[var(--enterprise-semantic-warning-text)]">
              Trial: 14 days remaining
            </span>
          </div>
          <Link
            href="/organization"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)]"
          >
            Upgrade to Pro
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {error && (
        <div className="enterprise-alert-danger flex items-center gap-2 px-3 py-2 text-sm">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {viewMode === "card" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {
            // fallow-ignore-next-line complexity
            visibleProjects.map((project) => (
              <div
                key={project.id}
                className="enterprise-card enterprise-card-hover group flex flex-col overflow-hidden"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="flex flex-1 flex-col p-3 transition-colors hover:bg-[var(--enterprise-hover-surface)]/50 sm:p-3.5"
                >
                  <div className="flex gap-2.5">
                    <ProjectLogo name={project.name} logoUrl={project.logoUrl} size={36} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h3 className="truncate text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
                        {project.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {project.projectType?.trim() ? (
                          <ProjectTypeChip type={project.projectType} />
                        ) : null}
                        <ProjectStageBadge stage={project.stage} />
                      </div>
                      {(project.projectNumber?.trim() || project.location?.trim()) && (
                        <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
                          {[
                            project.projectNumber?.trim() && `#${project.projectNumber.trim()}`,
                            project.location?.trim(),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <ProjectProgressBar
                      value={
                        typeof project.progressPercent === "number" ? project.progressPercent : 0
                      }
                      height={7}
                    />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--enterprise-border)] pt-2.5 text-[11px] text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0 opacity-70" />0 Issues
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquareQuote className="h-3 w-3 shrink-0 opacity-70" />0 RFIs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText
                        className="h-3 w-3 shrink-0 opacity-70"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      {project.files.length} files
                    </span>
                  </div>
                </Link>

                <div className="flex items-center justify-between gap-2 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--enterprise-text-muted)]">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">Last active {getLatestActivity(project)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditProject(project);
                      setEditOpen(true);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)]"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2} />
                    Edit
                  </button>
                </div>
              </div>
            ))
          }

          {isAdmin && (
            <button
              type="button"
              onClick={() => setProjectModal(true)}
              className="enterprise-card flex min-h-[140px] flex-col items-center justify-center border-2 border-dashed border-[var(--enterprise-border)] p-5 text-center transition hover:border-[var(--enterprise-primary)]/40 hover:bg-[var(--enterprise-primary-soft)]/30"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
                <Plus className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--enterprise-text)]">
                New Project
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                Create a new construction project
              </p>
            </button>
          )}
        </div>
      ) : (
        <section className="enterprise-card overflow-hidden">
          <ul className="md:hidden">
            {visibleProjects.map((project) => (
              <ProjectListMobileRow
                key={project.id}
                project={project}
                onEdit={() => {
                  setEditProject(project);
                  setEditOpen(true);
                }}
              />
            ))}
          </ul>

          <div className="hidden md:block">
            <div className="grid grid-cols-[minmax(240px,2.2fr)_110px_130px_120px_120px_80px] gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
              <span>Project</span>
              <span>Stage</span>
              <span>Progress</span>
              <span>Files</span>
              <span>Last active</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-[var(--enterprise-border)]">
              {visibleProjects.map((project) => (
                <div
                  key={project.id}
                  className="group grid grid-cols-[minmax(240px,2.2fr)_110px_130px_120px_120px_80px] items-center gap-2 px-3 py-2"
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="min-w-0 rounded-md px-0.5 transition hover:bg-[var(--enterprise-hover-surface)]/50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ProjectLogo name={project.name} logoUrl={project.logoUrl} size={30} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                          {project.name}
                        </p>
                        <p className="truncate text-[11px] text-[var(--enterprise-text-muted)]">
                          {projectListSubtitle(project)}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <div className="px-0.5">
                    <ProjectStageBadge stage={project.stage} />
                  </div>

                  <div className="px-0.5">
                    <ProjectProgressBar
                      value={
                        typeof project.progressPercent === "number" ? project.progressPercent : 0
                      }
                      height={6}
                    />
                  </div>

                  <p className="text-[11px] text-[var(--enterprise-text-muted)] px-0.5">
                    {project.files.length} files
                  </p>

                  <p className="text-[11px] text-[var(--enterprise-text-muted)] px-0.5">
                    {getLatestActivity(project)}
                  </p>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEditProject(project);
                        setEditOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)]"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2} />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setProjectModal(true)}
              className="mobile-tappable-row flex w-full items-center justify-center gap-1.5 border-t border-dashed border-[var(--enterprise-border)] px-3 py-3 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-primary-soft)]/30 active:scale-[0.99] md:py-2"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" />
              New Project
            </button>
          )}
        </section>
      )}

      {projects.length === 0 && !isAdmin && (
        <div className="enterprise-card px-4 py-8 text-center">
          <FileText
            className="mx-auto h-5 w-5 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
          />
          <p className="mt-2 text-sm font-semibold text-[var(--enterprise-text)]">
            No projects yet
          </p>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
            Ask a workspace admin to create a project.
          </p>
        </div>
      )}

      {projects.length > 0 && visibleProjects.length === 0 ? (
        <div className="enterprise-card border border-dashed border-[var(--enterprise-border)] px-4 py-8 text-center">
          <Search
            className="mx-auto h-5 w-5 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
          />
          <p className="mt-2 text-sm font-semibold text-[var(--enterprise-text)]">
            No matching projects
          </p>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
            Try a different keyword or clear your search.
          </p>
        </div>
      ) : null}

      <ProjectEditSlideOver
        open={editOpen}
        project={editProject}
        workspaceId={wid}
        canDeleteProject={isAdmin && !primary?.isExternal}
        onProjectDeleted={() => {
          setEditOpen(false);
          setEditProject(null);
        }}
        onClose={() => {
          setEditOpen(false);
          setEditProject(null);
        }}
      />

      <NewProjectDialog
        open={projectModal}
        saving={saving}
        values={{
          projectName,
          currency,
          measurementSystem,
          startDate,
          endDate,
          projectNumber,
          localBudget,
          projectSize,
          projectType,
          location,
          websiteUrl,
          projectStage,
          progressPercent,
          initialFolderStructure,
          folderTemplateId,
          copyFromProjectId,
        }}
        templates={folderStructureTemplates}
        copySourceProjects={projects}
        onChange={onNewProjectFieldChange}
        onSubmit={onCreateProject}
        onCancel={() => {
          setProjectModal(false);
          resetNewProjectForm();
        }}
        submitLabel="Create project"
      />
      {isAdmin ? (
        <EnterpriseFab
          label="New project"
          icon={<Plus className="h-7 w-7" strokeWidth={2} aria-hidden />}
          onClick={() => setProjectModal(true)}
        />
      ) : null}
    </div>
  );
}
