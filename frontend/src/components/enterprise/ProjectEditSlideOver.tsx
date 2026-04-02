"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { patchProject, type PatchProjectBody } from "@/lib/api-client";
import { buildProjectChangeRows } from "@/lib/projectChangeSummary";
import { PROJECT_STAGES, type ProjectStageValue } from "@/lib/projectStage";
import { logoUrlFromWebsiteInput } from "@/lib/websiteUrl";
import { qk } from "@/lib/queryKeys";
import type { Project } from "@/types/projects";
import { ConfirmProjectSaveDialog } from "./ConfirmProjectSaveDialog";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { ProjectProgressBar } from "./ProjectProgressBar";
import { ProjectTypeSelect } from "./ProjectTypeSelect";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] placeholder:text-[var(--enterprise-text-muted)]/75 transition focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20";

const labelClass = "block text-[13px] font-medium text-[var(--enterprise-text-muted)]";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  workspaceId: string | undefined;
};

export function ProjectEditSlideOver({ open, onClose, project, workspaceId }: Props) {
  const queryClient = useQueryClient();

  const [nameEd, setNameEd] = useState("");
  const [projectNumberEd, setProjectNumberEd] = useState("");
  const [localBudgetEd, setLocalBudgetEd] = useState("");
  const [projectSizeEd, setProjectSizeEd] = useState("");
  const [projectTypeEd, setProjectTypeEd] = useState("");
  const [locationEd, setLocationEd] = useState("");
  const [websiteEd, setWebsiteEd] = useState("");
  const [stageEd, setStageEd] = useState<ProjectStageValue>("NOT_STARTED");
  const [progressEd, setProgressEd] = useState(0);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  function handleClose() {
    setConfirmSaveOpen(false);
    onClose();
  }

  function hydrate(p: Project) {
    setNameEd(p.name);
    setProjectNumberEd(p.projectNumber ?? "");
    setLocalBudgetEd(p.localBudget != null && p.localBudget !== "" ? String(p.localBudget) : "");
    setProjectSizeEd(p.projectSize ?? "");
    setProjectTypeEd(p.projectType ?? "");
    setLocationEd(p.location ?? "");
    setWebsiteEd(p.websiteUrl ?? "");
    setStageEd((p.stage as ProjectStageValue) ?? "NOT_STARTED");
    setProgressEd(typeof p.progressPercent === "number" ? p.progressPercent : 0);
  }

  useEffect(() => {
    if (!project) return;
    hydrate(project);
  }, [project]);

  const websiteLogoPreview = useMemo(() => logoUrlFromWebsiteInput(websiteEd), [websiteEd]);

  const changeRows = useMemo(() => {
    if (!project) return [];
    return buildProjectChangeRows(project, {
      nameEd,
      projectNumberEd,
      localBudgetEd,
      projectSizeEd,
      projectTypeEd,
      locationEd,
      websiteEd,
      stageEd,
      progressEd,
    });
  }, [
    project,
    nameEd,
    projectNumberEd,
    localBudgetEd,
    projectSizeEd,
    projectTypeEd,
    locationEd,
    websiteEd,
    stageEd,
    progressEd,
  ]);

  const formDirty = useMemo(() => {
    if (!project) return false;
    const stageCur = ((project.stage as ProjectStageValue) ?? "NOT_STARTED") as ProjectStageValue;
    const progressCur = typeof project.progressPercent === "number" ? project.progressPercent : 0;
    const budgetCur =
      project.localBudget != null && project.localBudget !== ""
        ? String(project.localBudget).replace(/,/g, "")
        : "";
    const budgetEdNorm = localBudgetEd.trim().replace(/,/g, "");
    return (
      nameEd.trim() !== project.name ||
      projectNumberEd.trim() !== (project.projectNumber ?? "").trim() ||
      budgetEdNorm !== budgetCur ||
      projectSizeEd.trim() !== (project.projectSize ?? "").trim() ||
      projectTypeEd.trim() !== (project.projectType ?? "").trim() ||
      locationEd.trim() !== (project.location ?? "").trim() ||
      websiteEd.trim() !== (project.websiteUrl ?? "").trim() ||
      stageEd !== stageCur ||
      progressEd !== progressCur
    );
  }, [
    project,
    nameEd,
    projectNumberEd,
    localBudgetEd,
    projectSizeEd,
    projectTypeEd,
    locationEd,
    websiteEd,
    stageEd,
    progressEd,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project");
      const body: PatchProjectBody = {};
      if (nameEd.trim() !== project.name) body.name = nameEd.trim();
      if (projectNumberEd.trim() !== (project.projectNumber ?? "").trim()) {
        body.projectNumber = projectNumberEd.trim() || null;
      }
      const budgetCur =
        project.localBudget != null && project.localBudget !== ""
          ? String(project.localBudget).replace(/,/g, "")
          : "";
      const budgetEdNorm = localBudgetEd.trim().replace(/,/g, "");
      if (budgetEdNorm !== budgetCur) {
        body.localBudget = budgetEdNorm === "" ? null : budgetEdNorm;
      }
      if (projectSizeEd.trim() !== (project.projectSize ?? "").trim()) {
        body.projectSize = projectSizeEd.trim() || null;
      }
      if (projectTypeEd.trim() !== (project.projectType ?? "").trim()) {
        body.projectType = projectTypeEd.trim() || null;
      }
      if (locationEd.trim() !== (project.location ?? "").trim()) {
        body.location = locationEd.trim() || null;
      }
      if (websiteEd.trim() !== (project.websiteUrl ?? "").trim()) {
        body.websiteUrl = websiteEd.trim() ? websiteEd.trim() : null;
      }
      const stageCur = ((project.stage as ProjectStageValue) ?? "NOT_STARTED") as ProjectStageValue;
      if (stageEd !== stageCur) body.stage = stageEd;
      const progressCur = typeof project.progressPercent === "number" ? project.progressPercent : 0;
      if (progressEd !== progressCur) body.progressPercent = progressEd;
      return patchProject(project.id, body);
    },
    onSuccess: () => {
      toast.success("Project saved");
      setConfirmSaveOpen(false);
      if (workspaceId) void queryClient.invalidateQueries({ queryKey: qk.projects(workspaceId) });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <EnterpriseSlideOver
        open={open && !!project}
        onClose={handleClose}
        form={{
          onSubmit: (e) => {
            e.preventDefault();
            if (!nameEd.trim()) {
              toast.error("Project name is required");
              return;
            }
            if (!formDirty) return;
            setConfirmSaveOpen(true);
          },
        }}
        ariaLabelledBy="edit-project-slide-title"
        header={
          <div>
            <h2
              id="edit-project-slide-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Edit project
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Update details, website (logo), stage, and progress.
            </p>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formDirty || !nameEd.trim() || saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save changes
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="edit-slide-name" className={labelClass}>
              Project name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-slide-name"
              value={nameEd}
              onChange={(e) => setNameEd(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-slide-number" className={labelClass}>
                Project number
              </label>
              <input
                id="edit-slide-number"
                value={projectNumberEd}
                onChange={(e) => setProjectNumberEd(e.target.value)}
                className={inputClass}
                placeholder="e.g. 2025-0142"
              />
            </div>
            <div>
              <label htmlFor="edit-slide-budget" className={labelClass}>
                Local budget
              </label>
              <input
                id="edit-slide-budget"
                value={localBudgetEd}
                onChange={(e) => setLocalBudgetEd(e.target.value)}
                inputMode="decimal"
                className={inputClass}
                placeholder="e.g. 1250000"
              />
            </div>
            <div>
              <label htmlFor="edit-slide-size" className={labelClass}>
                Size
              </label>
              <input
                id="edit-slide-size"
                value={projectSizeEd}
                onChange={(e) => setProjectSizeEd(e.target.value)}
                className={inputClass}
                placeholder="e.g. 45,000 sq ft"
              />
            </div>
            <div>
              <label htmlFor="edit-slide-type" className={labelClass}>
                Project type
              </label>
              <ProjectTypeSelect
                id="edit-slide-type"
                value={projectTypeEd}
                onChange={setProjectTypeEd}
                triggerClassName={inputClass}
              />
              <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">
                Presets show icons and colors on project cards; use custom for anything else.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-slide-location" className={labelClass}>
                Location
              </label>
              <input
                id="edit-slide-location"
                value={locationEd}
                onChange={(e) => setLocationEd(e.target.value)}
                className={inputClass}
                placeholder="Site or city"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-slide-website" className={labelClass}>
                Website
              </label>
              <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  id="edit-slide-website"
                  value={websiteEd}
                  onChange={(e) => setWebsiteEd(e.target.value)}
                  className={`${inputClass} min-w-0 flex-1`}
                  placeholder="https://client.com"
                  inputMode="url"
                />
                {websiteLogoPreview ? (
                  <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3 py-2">
                    <span className="text-[11px] font-medium text-[var(--enterprise-text-muted)]">
                      Logo
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={websiteLogoPreview}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-md border border-[var(--enterprise-border)]/60 bg-white object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--enterprise-border)] pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
              Stage &amp; progress
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-slide-stage" className={labelClass}>
                  Stage
                </label>
                <select
                  id="edit-slide-stage"
                  value={stageEd}
                  onChange={(e) => setStageEd(e.target.value as ProjectStageValue)}
                  className={inputClass}
                >
                  {PROJECT_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="edit-slide-progress" className={labelClass}>
                    Overall progress
                  </label>
                  <span className="text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                    {progressEd}%
                  </span>
                </div>
                <input
                  id="edit-slide-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={progressEd}
                  onChange={(e) => setProgressEd(Number(e.target.value))}
                  className="mt-2 h-2 w-full cursor-pointer accent-[var(--enterprise-primary)]"
                />
                <ProjectProgressBar
                  value={progressEd}
                  height={8}
                  showLabel={false}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        </div>
      </EnterpriseSlideOver>
      <ConfirmProjectSaveDialog
        open={confirmSaveOpen && !!project}
        projectTitle={project ? nameEd.trim() || project.name : ""}
        changes={changeRows}
        saving={saveMutation.isPending}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={() => saveMutation.mutate()}
      />
    </>
  );
}
