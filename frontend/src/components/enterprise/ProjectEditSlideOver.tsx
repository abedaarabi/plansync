"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { patchProject, type PatchProjectBody } from "@/lib/api-client";
import { buildProjectChangeRows } from "@/lib/projectChangeSummary";
import { PROJECT_STAGES, type ProjectStageValue } from "@/lib/projectStage";
import type { ProjectCurrencyCode } from "@/lib/projectCurrency";
import type { ProjectMeasurementSystem } from "@/lib/projectMeasurement";
import { logoUrlFromWebsiteInput } from "@/lib/websiteUrl";
import { qk } from "@/lib/queryKeys";
import type { Project } from "@/types/projects";
import { ConfirmProjectSaveDialog } from "./ConfirmProjectSaveDialog";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { ProjectCurrencyPicker } from "./ProjectCurrencyPicker";
import { ProjectMeasurementSystemPicker } from "./ProjectMeasurementSystemPicker";
import { ProjectProgressBar } from "./ProjectProgressBar";
import { ProjectTypeSelect } from "./ProjectTypeSelect";
import { ProjectLocationMap } from "./ProjectLocationMap";
import { geocodeLocationName } from "@/lib/openMeteoGeocode";
import { parseCoord } from "@/lib/projectGeo";

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
  const [latitudeEd, setLatitudeEd] = useState<number | null>(null);
  const [longitudeEd, setLongitudeEd] = useState<number | null>(null);
  const [websiteEd, setWebsiteEd] = useState("");
  const [stageEd, setStageEd] = useState<ProjectStageValue>("NOT_STARTED");
  const [progressEd, setProgressEd] = useState(0);
  const [currencyEd, setCurrencyEd] = useState<ProjectCurrencyCode>("USD");
  const [measurementSystemEd, setMeasurementSystemEd] =
    useState<ProjectMeasurementSystem>("METRIC");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [geocodingLocation, setGeocodingLocation] = useState(false);

  /** When true, map clicks set the pin; typing location again switches back to address-based pin. */
  const manualPinRef = useRef(false);
  const locationEdRef = useRef(locationEd);
  locationEdRef.current = locationEd;
  const latitudeEdRef = useRef(latitudeEd);
  const longitudeEdRef = useRef(longitudeEd);
  latitudeEdRef.current = latitudeEd;
  longitudeEdRef.current = longitudeEd;
  const projectRef = useRef(project);
  projectRef.current = project;

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
    setLatitudeEd(parseCoord(p.latitude));
    setLongitudeEd(parseCoord(p.longitude));
    setWebsiteEd(p.websiteUrl ?? "");
    setStageEd((p.stage as ProjectStageValue) ?? "NOT_STARTED");
    setProgressEd(typeof p.progressPercent === "number" ? p.progressPercent : 0);
    setCurrencyEd(((p.currency as ProjectCurrencyCode) || "USD") as ProjectCurrencyCode);
    setMeasurementSystemEd(
      ((p.measurementSystem as ProjectMeasurementSystem) || "METRIC") as ProjectMeasurementSystem,
    );
    manualPinRef.current = false;
  }

  useEffect(() => {
    if (!project) return;
    hydrate(project);
  }, [project]);

  /** Debounced geocode from the Location field (English address / city) → map pin. */
  useEffect(() => {
    if (!open) return;
    const q = locationEd.trim();
    if (!q) {
      setLatitudeEd(null);
      setLongitudeEd(null);
      setGeocodingLocation(false);
      return;
    }
    if (manualPinRef.current) return;

    const p = projectRef.current;
    if (p) {
      const pq = (p.location ?? "").trim();
      const slat = parseCoord(p.latitude);
      const slng = parseCoord(p.longitude);
      const curLat = latitudeEdRef.current;
      const curLng = longitudeEdRef.current;
      if (
        q === pq &&
        slat != null &&
        slng != null &&
        curLat != null &&
        curLng != null &&
        Math.abs(curLat - slat) < 1e-5 &&
        Math.abs(curLng - slng) < 1e-5
      ) {
        return;
      }
    }

    const t = window.setTimeout(() => {
      const latest = locationEdRef.current.trim();
      if (!latest || manualPinRef.current) return;
      setGeocodingLocation(true);
      void (async () => {
        try {
          const geo = await geocodeLocationName(latest);
          if (!geo || manualPinRef.current) return;
          if (locationEdRef.current.trim() !== latest) return;
          setLatitudeEd(geo.lat);
          setLongitudeEd(geo.lng);
        } finally {
          setGeocodingLocation(false);
        }
      })();
    }, 600);
    return () => window.clearTimeout(t);
  }, [locationEd, open]);

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
      latitudeEd,
      longitudeEd,
      websiteEd,
      stageEd,
      progressEd,
      currencyEd,
      measurementSystemEd,
    });
  }, [
    project,
    nameEd,
    projectNumberEd,
    localBudgetEd,
    projectSizeEd,
    projectTypeEd,
    locationEd,
    latitudeEd,
    longitudeEd,
    websiteEd,
    stageEd,
    progressEd,
    currencyEd,
    measurementSystemEd,
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
    const currencyCur = (project.currency as ProjectCurrencyCode) || "USD";
    const msCur = (project.measurementSystem as ProjectMeasurementSystem) || "METRIC";
    const curLat = parseCoord(project.latitude);
    const curLng = parseCoord(project.longitude);
    const pinSaved = curLat != null && curLng != null;
    const pinEdit = latitudeEd != null && longitudeEd != null;
    const pinUnchanged =
      (!pinSaved && !pinEdit) ||
      (pinSaved &&
        pinEdit &&
        Math.abs(curLat! - latitudeEd!) < 1e-6 &&
        Math.abs(curLng! - longitudeEd!) < 1e-6);
    const pinChanged = !pinUnchanged;

    return (
      nameEd.trim() !== project.name ||
      projectNumberEd.trim() !== (project.projectNumber ?? "").trim() ||
      budgetEdNorm !== budgetCur ||
      projectSizeEd.trim() !== (project.projectSize ?? "").trim() ||
      projectTypeEd.trim() !== (project.projectType ?? "").trim() ||
      locationEd.trim() !== (project.location ?? "").trim() ||
      pinChanged ||
      websiteEd.trim() !== (project.websiteUrl ?? "").trim() ||
      stageEd !== stageCur ||
      progressEd !== progressCur ||
      currencyEd !== currencyCur ||
      measurementSystemEd !== msCur
    );
  }, [
    project,
    nameEd,
    projectNumberEd,
    localBudgetEd,
    projectSizeEd,
    projectTypeEd,
    locationEd,
    latitudeEd,
    longitudeEd,
    websiteEd,
    stageEd,
    progressEd,
    currencyEd,
    measurementSystemEd,
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
      const curLat0 = parseCoord(project.latitude);
      const curLng0 = parseCoord(project.longitude);

      let latOut = latitudeEd;
      let lngOut = longitudeEd;
      if (!locationEd.trim()) {
        latOut = null;
        lngOut = null;
      } else if (latOut == null || lngOut == null) {
        const geo = await geocodeLocationName(locationEd.trim());
        if (geo) {
          latOut = geo.lat;
          lngOut = geo.lng;
        }
      }

      const pinSaved0 = curLat0 != null && curLng0 != null;
      const pinEdit0 = latOut != null && lngOut != null;
      const pinUnchanged0 =
        (!pinSaved0 && !pinEdit0) ||
        (pinSaved0 &&
          pinEdit0 &&
          curLat0 != null &&
          curLng0 != null &&
          latOut != null &&
          lngOut != null &&
          Math.abs(curLat0 - latOut) < 1e-6 &&
          Math.abs(curLng0 - lngOut) < 1e-6);
      if (!pinUnchanged0) {
        if (latOut == null || lngOut == null) {
          body.latitude = null;
          body.longitude = null;
        } else {
          body.latitude = latOut;
          body.longitude = lngOut;
        }
      }
      if (websiteEd.trim() !== (project.websiteUrl ?? "").trim()) {
        body.websiteUrl = websiteEd.trim() ? websiteEd.trim() : null;
      }
      const stageCur = ((project.stage as ProjectStageValue) ?? "NOT_STARTED") as ProjectStageValue;
      if (stageEd !== stageCur) body.stage = stageEd;
      const progressCur = typeof project.progressPercent === "number" ? project.progressPercent : 0;
      if (progressEd !== progressCur) body.progressPercent = progressEd;
      const currencyCur = (project.currency as ProjectCurrencyCode) || "USD";
      if (currencyEd !== currencyCur) body.currency = currencyEd;
      const msCur = (project.measurementSystem as ProjectMeasurementSystem) || "METRIC";
      if (measurementSystemEd !== msCur) body.measurementSystem = measurementSystemEd;
      return patchProject(project.id, body);
    },
    onSuccess: () => {
      toast.success("Project saved");
      setConfirmSaveOpen(false);
      if (workspaceId) void queryClient.invalidateQueries({ queryKey: qk.projects(workspaceId) });
      if (project) void queryClient.invalidateQueries({ queryKey: qk.project(project.id) });
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

          <div className="rounded-xl border border-[var(--enterprise-border)]/70 bg-[var(--enterprise-bg)]/25 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
              Currency &amp; units
            </p>
            <div className="mt-3 space-y-4">
              <div>
                <label className={labelClass}>Project currency</label>
                <div className="mt-2">
                  <ProjectCurrencyPicker
                    value={currencyEd}
                    onChange={setCurrencyEd}
                    idPrefix="edit-slide-currency"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Measurement system</label>
                <div className="mt-2">
                  <ProjectMeasurementSystemPicker
                    value={measurementSystemEd}
                    onChange={setMeasurementSystemEd}
                  />
                </div>
              </div>
            </div>
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
                Local budget ({currencyEd})
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
                onChange={(e) => {
                  manualPinRef.current = false;
                  setLocationEd(e.target.value);
                }}
                className={inputClass}
                placeholder="City or address in English (e.g. Austin, TX)"
              />
              <p className="mt-1 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                The map pin updates automatically from this text. You can still click the map to
                fine-tune.
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={labelClass}>Map preview (OpenStreetMap)</p>
                  {latitudeEd != null && longitudeEd != null ? (
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-[var(--enterprise-primary)] hover:underline"
                      onClick={() => {
                        manualPinRef.current = false;
                        setLatitudeEd(null);
                        setLongitudeEd(null);
                      }}
                    >
                      Clear pin
                    </button>
                  ) : null}
                </div>
                {geocodingLocation ? (
                  <p className="text-[11px] text-[var(--enterprise-text-muted)]" aria-live="polite">
                    Looking up address…
                  </p>
                ) : (
                  <p className="text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                    Shown on the project overview with live weather.
                  </p>
                )}
                <ProjectLocationMap
                  height={220}
                  latitude={latitudeEd ?? 39.8283}
                  longitude={longitudeEd ?? -98.5795}
                  zoom={latitudeEd != null && longitudeEd != null ? 14 : 4}
                  showMarker={latitudeEd != null && longitudeEd != null}
                  onPick={(lat, lng) => {
                    manualPinRef.current = true;
                    setLatitudeEd(lat);
                    setLongitudeEd(lng);
                  }}
                />
              </div>
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
