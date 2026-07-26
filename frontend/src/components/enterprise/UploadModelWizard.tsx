"use client";

import { apiUrl } from "@/lib/api-url";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Compass,
  FileUp,
  GitBranchPlus,
  Layers3,
  Loader2,
  Map as MapIcon,
  SearchCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { carryForwardIssues, previewUploadMatches, type UploadPreviewRow } from "@/lib/api-client";
import {
  fetchBimLoqHints,
  fetchBimStatus,
  pollBimStoreysUntilReady,
  publishBimModel,
  triggerBimConversion,
  uploadIfcFile,
  type BimModelLevelDraft,
  type BimStoreyPreview,
} from "@/lib/api-client/bim-publish";
import { mergeUploadedFileIntoProject } from "@/lib/projectsCache";
import { qk } from "@/lib/queryKeys";
import type { CloudFile, FileVersion } from "@/types/projects";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { ModelLevelSheetMapper, type LevelMapEntry } from "./ModelLevelSheetMapper";

type PreviewState = UploadPreviewRow & {
  overrideMode: "auto" | "link" | "new";
  overrideFileId: string | null;
};

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatElevation(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return "—";
  const sign = m >= 0 ? "+" : "";
  return `${sign}${m.toFixed(3)} m`;
}

function storeysToLevels(storeys: BimStoreyPreview[]): BimModelLevelDraft[] {
  return storeys.map((s, i) => ({
    clientId: s.sourceName,
    sourceName: s.sourceName,
    displayName: s.displayName || s.sourceName,
    elevationMeters: s.elevationMeters,
    sortOrder: s.sortOrder ?? i,
    elementCount: s.elementCount,
  }));
}

// fallow-ignore-next-line complexity
export function UploadModelWizard(props: {
  open: boolean;
  onClose: () => void;
  /** New upload flow */
  initialFile?: File | null;
  /** Retroactive publish — skip upload steps */
  existingFileVersionId?: string | null;
  existingFile?: CloudFile | null;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  existingFiles: CloudFile[];
  folders: import("@/types/projects").Folder[];
  /** Jump straight to mapping (step 5) */
  startAtStep?: WizardStep;
}) {
  const queryClient = useQueryClient();
  const retroactive = Boolean(props.existingFileVersionId);

  const [step, setStep] = useState<WizardStep>(retroactive ? 3 : 1);
  const [stagedFile, setStagedFile] = useState<File | null>(props.initialFile ?? null);
  const [previewRow, setPreviewRow] = useState<PreviewState | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [fileVersionId, setFileVersionId] = useState<string | null>(
    props.existingFileVersionId ?? null,
  );
  const [levels, setLevels] = useState<BimModelLevelDraft[]>([]);
  const [maps, setMaps] = useState<LevelMapEntry[]>([]);
  const [loqPctLevel, setLoqPctLevel] = useState<number | null>(null);
  const [loqHints, setLoqHints] = useState<string[]>([]);
  const [conversionRunning, setConversionRunning] = useState(false);
  const [indexProgress, setIndexProgress] = useState<number | null>(null);
  const [indexPhase, setIndexPhase] = useState<"summary" | "full" | null>(null);
  const [carryIssues, setCarryIssues] = useState(true);

  // fallow-ignore-next-line complexity
  useEffect(() => {
    if (!props.open) return;
    const start = props.startAtStep ?? (retroactive ? 3 : 1);
    setStep(start);
    setStagedFile(props.initialFile ?? null);
    setPreviewRow(null);
    setLoadingPreview(false);
    setUploadPct(0);
    setUploadLabel(null);
    setWorking(false);
    setFileVersionId(props.existingFileVersionId ?? null);
    setLevels([]);
    setMaps([]);
    setLoqPctLevel(null);
    setLoqHints([]);
    setConversionRunning(false);
    setIndexProgress(null);
    setIndexPhase(null);
    setCarryIssues(true);
  }, [props.open, props.initialFile, props.existingFileVersionId, props.startAtStep, retroactive]);

  const existingNameById = useMemo(() => {
    const out = new Map<string, string>();
    for (const f of props.existingFiles) out.set(f.id, f.name);
    return out;
  }, [props.existingFiles]);

  const ifcFiles = useMemo(
    () => props.existingFiles.filter((f) => f.name.toLowerCase().endsWith(".ifc")),
    [props.existingFiles],
  );

  function resetAndClose() {
    if (conversionRunning && fileVersionId) {
      toast.message("Model analysis continues in the background", {
        description: "We'll notify you when the quantity index is ready.",
      });
    }
    props.onClose();
  }

  // fallow-ignore-next-line complexity
  function indexProgressLabel(): string {
    if (indexPhase === "summary") {
      return `Cataloging elements${indexProgress != null ? ` — ${indexProgress}%` : "…"}`;
    }
    if (indexPhase === "full") {
      return `Analyzing quantities${indexProgress != null ? ` — ${indexProgress}%` : "…"}`;
    }
    if (indexProgress != null) return `Building model index — ${indexProgress}%`;
    return "Building model index…";
  }

  // fallow-ignore-next-line complexity
  function resolvedPreview(): { fileName: string; kind: "new_sheet" | "new_version" } {
    if (!previewRow) return { fileName: stagedFile?.name ?? "model.ifc", kind: "new_sheet" };
    if (previewRow.overrideMode === "new")
      return { fileName: previewRow.clientName, kind: "new_sheet" };
    if (previewRow.overrideMode === "link" && previewRow.overrideFileId) {
      const linked = existingNameById.get(previewRow.overrideFileId);
      if (linked) return { fileName: linked, kind: "new_version" };
    }
    if (previewRow.kind === "new_version" && previewRow.matchedFile) {
      return { fileName: previewRow.matchedFile.name, kind: "new_version" };
    }
    return { fileName: previewRow.clientName, kind: "new_sheet" };
  }

  // fallow-ignore-next-line complexity
  async function runPreview() {
    if (!stagedFile) {
      toast.error("Select an IFC file.");
      return;
    }
    setLoadingPreview(true);
    try {
      const data = await previewUploadMatches({
        projectId: props.projectId,
        folderId: props.folderId,
        candidates: [{ clientName: stagedFile.name }],
      });
      const row = data.rows[0];
      if (!row) throw new Error("No preview row returned.");
      setPreviewRow({
        ...row,
        overrideMode: "auto",
        overrideFileId: row.matchedFile?.id ?? null,
      });
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not review upload.");
    } finally {
      setLoadingPreview(false);
    }
  }

  // fallow-ignore-next-line complexity
  async function refreshLoqHints(fvId: string) {
    try {
      const hints = await fetchBimLoqHints(fvId);
      setConversionRunning(!hints.quantityIndexReady && hints.conversionStatus !== "failed");
      setIndexProgress(hints.indexProgress);
      setIndexPhase(hints.indexPhase);
      if (hints.loq) {
        setLoqPctLevel(hints.loq.pctLevel);
        setLoqHints(hints.loq.recommendedExportHints ?? []);
      }
    } catch {
      /* optional refresh */
    }
  }

  // fallow-ignore-next-line complexity
  async function runUploadAndExtract() {
    setWorking(true);
    setUploadLabel("Uploading IFC…");
    try {
      let fvId = fileVersionId;
      if (!retroactive && stagedFile) {
        const resolved = resolvedPreview();
        const result = await uploadIfcFile({
          file: stagedFile,
          workspaceId: props.workspaceId,
          projectId: props.projectId,
          folderId: props.folderId,
          fileName: resolved.fileName,
          onProgress: setUploadPct,
        });
        mergeUploadedFileIntoProject(
          queryClient,
          props.workspaceId,
          props.projectId,
          result.file,
          result.fileVersion,
        );
        fvId = result.fileVersion.id;

        const shouldCarry =
          resolved.kind === "new_version" &&
          previewRow?.fromFileVersionId &&
          previewRow.issueCountOnLatestVersion > 0 &&
          carryIssues;
        if (shouldCarry && previewRow?.fromFileVersionId) {
          setUploadLabel("Carrying BIM issues…");
          await carryForwardIssues(fvId, previewRow.fromFileVersionId);
        }
      }

      if (!fvId) throw new Error("Missing file version.");

      setFileVersionId(fvId);
      setUploadLabel("Extracting building levels…");
      setUploadPct(0);

      let status = await fetchBimStatus(fvId);
      if (status.conversionStatus === "pending" || status.conversionStatus === "failed") {
        await triggerBimConversion(fvId);
      }
      void refreshLoqHints(fvId);
      const progressPoll = window.setInterval(() => void refreshLoqHints(fvId), 2000);

      let storeys: BimStoreyPreview[];
      try {
        storeys = await pollBimStoreysUntilReady(fvId, { timeoutMs: 120_000 });
      } finally {
        window.clearInterval(progressPoll);
      }
      const draftLevels = storeysToLevels(storeys);
      if (draftLevels.length === 0) {
        setLevels([
          {
            clientId: "manual-0",
            sourceName: "Level 01",
            displayName: "Level 01",
            elevationMeters: 0,
            sortOrder: 0,
            elementCount: 0,
          },
        ]);
      } else {
        setLevels(draftLevels.sort((a, b) => a.sortOrder - b.sortOrder));
      }

      void refreshLoqHints(fvId);
      setStep(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload or extraction failed.");
    } finally {
      setWorking(false);
      setUploadLabel(null);
    }
  }

  // fallow-ignore-next-line complexity
  async function retroactiveExtract() {
    if (!fileVersionId) return;
    setWorking(true);
    setUploadLabel("Preparing model levels…");
    try {
      let status = await fetchBimStatus(fileVersionId);
      if (status.conversionStatus === "pending" || status.conversionStatus === "failed") {
        await triggerBimConversion(fileVersionId);
      }
      void refreshLoqHints(fileVersionId);
      const progressPoll = window.setInterval(() => void refreshLoqHints(fileVersionId), 2000);

      let storeys: BimStoreyPreview[];
      try {
        storeys = await pollBimStoreysUntilReady(fileVersionId, { timeoutMs: 120_000 });
      } finally {
        window.clearInterval(progressPoll);
      }
      const draftLevels = storeysToLevels(storeys);
      setLevels(
        draftLevels.length > 0
          ? draftLevels.sort((a, b) => a.sortOrder - b.sortOrder)
          : [
              {
                clientId: "manual-0",
                sourceName: "Level 01",
                displayName: "Level 01",
                elevationMeters: 0,
                sortOrder: 0,
                elementCount: 0,
              },
            ],
      );
      void refreshLoqHints(fileVersionId);
      setStep(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not extract levels.");
    } finally {
      setWorking(false);
      setUploadLabel(null);
    }
  }

  useEffect(() => {
    if (!props.open || !fileVersionId || step < 4) return;
    const t = window.setInterval(() => void refreshLoqHints(fileVersionId), 4000);
    return () => window.clearInterval(t);
  }, [props.open, step, fileVersionId]);

  function moveLevel(index: number, dir: -1 | 1) {
    const next = [...levels].sort((a, b) => a.sortOrder - b.sortOrder);
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index]!.sortOrder;
    next[index]!.sortOrder = next[j]!.sortOrder;
    next[j]!.sortOrder = tmp;
    next.sort((a, b) => a.sortOrder - b.sortOrder);
    setLevels(next);
  }

  function addManualLevel() {
    const n = levels.length;
    setLevels([
      ...levels,
      {
        clientId: `manual-${n}`,
        sourceName: `Level ${String(n + 1).padStart(2, "0")}`,
        displayName: `Level ${String(n + 1).padStart(2, "0")}`,
        elevationMeters: null,
        sortOrder: n,
        elementCount: 0,
      },
    ]);
  }

  // fallow-ignore-next-line complexity
  async function publish(withMaps: boolean) {
    if (!fileVersionId) return;
    setWorking(true);
    try {
      const payloadLevels = levels.map((l, i) => ({
        sourceName: l.sourceName,
        displayName: l.displayName.trim() || l.sourceName,
        elevationMeters: l.elevationMeters,
        sortOrder: i,
        elementCount: l.elementCount ?? 0,
      }));
      const payloadMaps = withMaps
        ? maps.map((m) => ({
            bimModelLevelId: m.bimModelLevelId,
            pdfFileId: m.pdfFileId,
            pdfFileVersionId: m.pdfFileVersionId,
            pageIndex: m.pageIndex,
          }))
        : undefined;

      const result = await publishBimModel(fileVersionId, {
        levels: payloadLevels,
        maps: payloadMaps,
      });

      await queryClient.invalidateQueries({ queryKey: qk.projects(props.workspaceId) });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard(props.workspaceId) });

      if (withMaps && result.mapCount > 0) {
        toast.success(
          `Model published — ${result.levelCount} levels, ${result.mapCount} sheets mapped.`,
        );
      } else {
        toast.success(
          `Model published — ${result.levelCount} levels extracted. Map drawings anytime from the file menu.`,
        );
      }
      resetAndClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setWorking(false);
    }
  }

  // fallow-ignore-next-line complexity
  async function uploadPdfsInline(files: File[]) {
    for (const file of files) {
      const fd = new FormData();
      fd.append("workspaceId", props.workspaceId);
      fd.append("projectId", props.projectId);
      if (props.folderId) fd.append("folderId", props.folderId);
      fd.append("fileName", file.name);
      fd.append("file", file);
      const res = await fetch(apiUrl("/api/v1/files/upload"), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "PDF upload failed.");
      }
      const j = (await res.json()) as { file: CloudFile; fileVersion: FileVersion };
      mergeUploadedFileIntoProject(
        queryClient,
        props.workspaceId,
        props.projectId,
        j.file,
        j.fileVersion,
      );
    }
    await queryClient.invalidateQueries({ queryKey: qk.projects(props.workspaceId) });
  }

  const stepLabels = retroactive
    ? ["Extract", "Levels", "Map", "Align"]
    : ["Stage", "Version", "Upload", "Levels", "Map", "Align"];

  const headerTitle =
    step === 1
      ? "Stage IFC model"
      : step === 2
        ? "Version match"
        : step === 3
          ? "Upload & extract levels"
          : step === 4
            ? "Review levels"
            : step === 5
              ? "Map drawings"
              : "Align coordinates";

  return (
    <EnterpriseSlideOver
      open={props.open}
      onClose={resetAndClose}
      panelMaxWidthClass="max-w-[640px]"
      header={
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Publish model · Step {step} — {headerTitle}
          </p>
          <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
            {props.existingFile?.name ?? stagedFile?.name ?? "IFC model"}
          </h2>
        </div>
      }
      footer={
        step === 1 ? (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={resetAndClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loadingPreview || !stagedFile}
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void runPreview()}
            >
              {loadingPreview ? "Checking…" : "Next →"}
            </button>
          </>
        ) : step === 2 ? (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(1)}
              disabled={working}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setStep(3)}
              disabled={working}
            >
              Next →
            </button>
          </>
        ) : step === 3 ? (
          <>
            {!retroactive ? (
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setStep(2)}
                disabled={working}
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
                onClick={resetAndClose}
                disabled={working}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void (retroactive ? retroactiveExtract() : runUploadAndExtract())}
              disabled={working}
            >
              {working ? "Working…" : retroactive ? "Extract levels →" : "Upload & extract →"}
            </button>
          </>
        ) : step === 4 ? (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(retroactive ? 3 : 3)}
              disabled={working}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => void publish(false)}
              disabled={working || levels.length === 0}
            >
              Publish model
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => setStep(5)}
              disabled={working || levels.length === 0}
            >
              Map drawings →
            </button>
          </>
        ) : step === 5 ? (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(4)}
              disabled={working}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => void publish(false)}
              disabled={working}
            >
              Skip — map later
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(6)}
              disabled={working}
            >
              Align later
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void publish(maps.length > 0)}
              disabled={working}
            >
              {maps.length > 0 ? "Publish with mappings" : "Publish model"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(5)}
              disabled={working}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void publish(maps.length > 0)}
              disabled={working}
            >
              Finish publish
            </button>
          </>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 text-xs">
        {(retroactive ? ([3, 4, 5, 6] as WizardStep[]) : ([1, 2, 3, 4, 5, 6] as WizardStep[])).map(
          // fallow-ignore-next-line complexity
          (s, i) => (
            <div
              key={s}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${step === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              {s === 1 ? <FileUp className="h-3.5 w-3.5" /> : null}
              {s === 2 ? <SearchCheck className="h-3.5 w-3.5" /> : null}
              {s === 3 ? <Upload className="h-3.5 w-3.5" /> : null}
              {s === 4 ? <Layers3 className="h-3.5 w-3.5" /> : null}
              {s === 5 ? <MapIcon className="h-3.5 w-3.5" /> : null}
              {s === 6 ? <Compass className="h-3.5 w-3.5" /> : null}
              {stepLabels[i]}
            </div>
          ),
        )}
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <label className="block rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 hover:border-slate-400">
            <input
              type="file"
              accept=".ifc,model/ifc"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setStagedFile(f);
                e.target.value = "";
              }}
            />
            <Box className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            Drop IFC here or click to browse
          </label>
          {stagedFile ? (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="truncate">{stagedFile.name}</span>
              <span className="shrink-0 text-slate-500">{formatBytes(stagedFile.size)}</span>
              <button
                type="button"
                className="rounded p-1 hover:bg-slate-100"
                onClick={() => setStagedFile(null)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {stagedFile ? (
            <p className="text-xs text-slate-600">
              Uploads go directly to secure cloud storage (no size limit from the app proxy).
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 2 && previewRow ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="font-medium">{previewRow.clientName}</p>
            <p className="mt-1 text-slate-600">
              {resolvedPreview().kind === "new_version" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  New version of {resolvedPreview().fileName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-blue-700">
                  <Sparkles className="h-4 w-4" />
                  New model file
                </span>
              )}
            </p>
            <select
              className="mt-2 w-full rounded-lg border px-2 py-1 text-xs"
              value={previewRow.overrideFileId ?? ""}
              onChange={(e) => {
                const nextId = e.target.value || null;
                setPreviewRow({
                  ...previewRow,
                  overrideMode: nextId ? "link" : "new",
                  overrideFileId: nextId,
                });
              }}
            >
              <option value="">Link to existing IFC…</option>
              {ifcFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {resolvedPreview().kind === "new_version" && previewRow.issueCountOnLatestVersion > 0 ? (
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="checkbox"
                checked={carryIssues}
                onChange={(e) => setCarryIssues(e.target.checked)}
              />
              <span className="inline-flex items-center gap-1.5">
                <GitBranchPlus className="h-4 w-4 text-slate-500" />
                Carry forward {previewRow.issueCountOnLatestVersion} BIM issues
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3 text-sm text-slate-600">
          {retroactive ? (
            <p>
              Extract building storeys from{" "}
              <span className="font-medium text-[var(--enterprise-text)]">
                {props.existingFile?.name}
              </span>
              . Full quantity indexing continues in the background.
            </p>
          ) : (
            <>
              <p>
                Upload <span className="font-medium">{resolvedPreview().fileName}</span> and run
                fast storey extraction (~seconds).
              </p>
              {uploadPct > 0 ? (
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-[var(--enterprise-primary)] transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              ) : null}
            </>
          )}
          {working && uploadLabel ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadLabel}
            </div>
          ) : null}
          {conversionRunning && indexProgress != null ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                {indexProgressLabel()}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${Math.max(4, indexProgress)}%` }}
                />
              </div>
              <p className="text-blue-800/90">
                You can continue mapping levels — we'll notify you when analysis finishes.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          {conversionRunning ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                {indexProgress != null ? indexProgressLabel() : "Full model analysis in progress…"}
              </div>
              {indexProgress != null ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${Math.max(4, indexProgress)}%` }}
                  />
                </div>
              ) : null}
              <p className="text-blue-800/90">
                Charts and LOQ hints update as analysis completes. Close this wizard anytime — we'll
                notify you when it's done.
              </p>
            </div>
          ) : null}
          {loqPctLevel != null && loqPctLevel < 80 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              {Math.round(loqPctLevel)}% of elements have a level assigned — check IFC export
              settings.
              {loqHints.length > 0 ? (
                <ul className="mt-1 list-disc pl-4">
                  {loqHints.slice(0, 3).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : loqPctLevel != null ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900">
              {Math.round(loqPctLevel)}% of elements have level assignment.
            </div>
          ) : null}

          <div className="space-y-2">
            {[...levels]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((level, i) => (
                <div
                  key={level.clientId ?? level.sourceName}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2"
                >
                  <span className="w-8 text-xs text-slate-500">{i + 1}</span>
                  <input
                    className="min-w-[120px] flex-1 rounded-lg border px-2 py-1 text-sm"
                    value={level.displayName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLevels((prev) =>
                        prev.map((l) =>
                          (l.clientId ?? l.sourceName) === (level.clientId ?? level.sourceName)
                            ? { ...l, displayName: v }
                            : l,
                        ),
                      );
                    }}
                  />
                  <span className="text-xs text-slate-500">
                    {formatElevation(level.elevationMeters)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border px-1.5 text-xs"
                      onClick={() => moveLevel(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded border px-1.5 text-xs"
                      onClick={() => moveLevel(i, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
          </div>
          <button
            type="button"
            className="text-xs text-[var(--enterprise-primary)]"
            onClick={addManualLevel}
          >
            + Add level manually
          </button>
        </div>
      ) : null}

      {step === 5 && fileVersionId ? (
        <ModelLevelSheetMapper
          projectId={props.projectId}
          ifcFileVersionId={fileVersionId}
          levels={levels}
          folders={props.folders}
          maps={maps}
          onMapsChange={setMaps}
          onUploadPdfs={uploadPdfsInline}
        />
      ) : null}

      {step === 6 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
          <Compass className="mb-2 h-6 w-6 text-[var(--enterprise-primary)]" />
          <p className="font-medium text-[var(--enterprise-text)]">Align coordinates (optional)</p>
          <p className="mt-1 text-slate-600">
            After publishing, open the BIM viewer to georeference mapped sheets to the model plan —
            place 2–3 control point pairs for synced 2D/3D navigation.
          </p>
          {maps.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {maps.length} sheet{maps.length === 1 ? "" : "s"} ready to align from the viewer or
              file menu.
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-700">Map at least one drawing before aligning.</p>
          )}
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--enterprise-primary)]">
            <ArrowRight className="h-3.5 w-3.5" />
            Use &quot;Align coordinates&quot; on the IFC file or BIM viewer toolbar
          </p>
        </div>
      ) : null}

      {working ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{uploadLabel ?? "Working…"}</span>
        </div>
      ) : null}
    </EnterpriseSlideOver>
  );
}
