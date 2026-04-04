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
  Clock,
  FileText,
  MessageSquareQuote,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
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

export function ProjectHubClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isAdmin = primary?.role === "ADMIN" || primary?.role === "SUPER_ADMIN";
  const isPro = primary?.workspace.subscriptionStatus === "active";
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
        setError("Could not create project.");
        return;
      }
      const p = (await res.json()) as Project;
      setProjectModal(false);
      resetNewProjectForm();
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--enterprise-text-muted)]">
            Workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--enterprise-text)] sm:text-[1.75rem]">
            Your projects
          </h1>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setProjectModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--enterprise-shadow-sm)] ring-1 ring-[color-mix(in_srgb,var(--enterprise-primary)_30%,transparent)] transition hover:bg-[var(--enterprise-primary-deep)] sm:shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New project
          </button>
        )}
      </header>

      {sub === "trialing" && (
        <div className="enterprise-alert-warning flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-[var(--enterprise-semantic-warning-text)]" />
            <span className="text-sm font-medium text-[var(--enterprise-semantic-warning-text)]">
              Trial: 14 days remaining
            </span>
          </div>
          <Link
            href="/organization"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)]"
          >
            Upgrade to Pro
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {error && (
        <div className="enterprise-alert-danger flex items-center gap-2 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="enterprise-card enterprise-card-hover group flex flex-col overflow-hidden rounded-2xl"
          >
            <Link
              href={`/projects/${project.id}`}
              className="flex flex-1 flex-col p-5 transition-colors hover:bg-[var(--enterprise-hover-surface)]/50"
            >
              <div className="flex gap-3">
                <ProjectLogo name={project.name} logoUrl={project.logoUrl} size={48} />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <h3 className="truncate text-base font-semibold leading-snug text-[var(--enterprise-text)]">
                    {project.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {project.projectType?.trim() ? (
                      <ProjectTypeChip type={project.projectType} />
                    ) : null}
                    <ProjectStageBadge stage={project.stage} />
                  </div>
                  {(project.projectNumber?.trim() || project.location?.trim()) && (
                    <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--enterprise-text-muted)]">
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

              <div className="mt-4">
                <ProjectProgressBar
                  value={typeof project.progressPercent === "number" ? project.progressPercent : 0}
                  height={9}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#E2E8F0] pt-4 text-[12px] text-[#64748B]">
                <span className="inline-flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />0 Issues
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquareQuote className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />0 RFIs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText
                    className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {project.files.length} files
                </span>
              </div>
            </Link>

            <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 px-5 py-3">
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-[#94A3B8]">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">Last active {getLatestActivity(project)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditProject(project);
                  setEditOpen(true);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2563EB] transition hover:bg-[#2563EB]/10"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                Edit
              </button>
            </div>
          </div>
        ))}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setProjectModal(true)}
            className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] p-8 text-center transition-all duration-200 hover:border-[#2563EB]/40 hover:bg-[#2563EB]/[0.04]"
            style={{ borderRadius: "12px", minHeight: "220px" }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8FAFC] text-[#94A3B8]">
              <Plus className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#0F172A]">New Project</p>
            <p className="mt-1 text-xs text-[#64748B]">Create a new construction project</p>
          </button>
        )}
      </div>

      {projects.length === 0 && !isAdmin && (
        <div
          className="border border-[#E2E8F0] bg-white p-10 text-center"
          style={{ borderRadius: "12px" }}
        >
          <FileText className="mx-auto h-10 w-10 text-[#2563EB] opacity-70" strokeWidth={1.25} />
          <p className="mt-3 font-semibold text-[#0F172A]">No projects yet</p>
          <p className="mt-1 text-sm text-[#64748B]">Ask your admin to create a project.</p>
        </div>
      )}

      <ProjectEditSlideOver
        open={editOpen}
        project={editProject}
        workspaceId={wid}
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
    </div>
  );
}
