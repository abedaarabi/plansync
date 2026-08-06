"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckSquare, ChevronRight, Square, Upload, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  deleteOmInspectionRun,
  fetchProject,
  omInspectionRunReportPdfUrl,
  patchOmInspectionRun,
  postOmInspectionRunComplete,
  postOmInspectionRunWorkOrder,
  type OmInspectionChecklistItem,
  type OmInspectionRunRow,
  type OmInspectionTemplateRow,
  ProRequiredError,
} from "@/lib/api-client";
import { failEvidenceErrors } from "@/lib/omInspectionFailEvidence";
import {
  clearOmInspectionOfflineDraft,
  loadOmInspectionOfflineDraft,
  saveOmInspectionOfflineDraft,
} from "@/lib/omInspectionOfflineDraft";
import { projectScopedHref } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { OmInspectionSignaturePad } from "@/components/enterprise/OmInspectionSignaturePad";

/* ── Types ─────────────────────────────────────────── */

type ItemResult = {
  outcome: "pass" | "fail" | "na" | null;
  note: string;
  photoDataUrl?: string;
  /** Shown on PDF (upload filename or camera label). */
  photoFileName?: string;
  followUpIssueId?: string;
};

/* ── Helpers ────────────────────────────────────────── */

function isLikelyNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (e instanceof TypeError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}

function buildInspectionResultPayload(
  checklist: OmInspectionChecklistItem[],
  map: Record<string, ItemResult>,
) {
  return checklist.map((it) => {
    const r: ItemResult = map[it.id] ?? { outcome: null, note: "" };
    const outcome: "pass" | "fail" | "na" = it.type === "text" ? "na" : (r.outcome ?? "na");
    return {
      itemId: it.id,
      outcome,
      note: r.note.trim() || undefined,
      photoDataUrl: r.photoDataUrl,
      photoFileName: r.photoFileName?.trim() || undefined,
      followUpIssueId: r.followUpIssueId,
    };
  });
}

function parseChecklist(json: unknown): OmInspectionChecklistItem[] {
  if (!Array.isArray(json)) return [];
  const out: OmInspectionChecklistItem[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = o.id;
    if (typeof id !== "string" || !id.trim()) continue;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : id.trim();
    const typeRaw = o.type;
    const type =
      typeRaw === "checkbox" || typeRaw === "passfail" || typeRaw === "text" || typeRaw === "photo"
        ? typeRaw
        : "passfail";
    const level = typeof o.level === "string" ? o.level : undefined;
    out.push({ id: id.trim(), label, type, level });
  }
  return out;
}

function resultsFromRunJson(
  checklist: OmInspectionChecklistItem[],
  resultJson: unknown,
): Record<string, ItemResult> {
  const map: Record<string, ItemResult> = {};
  for (const it of checklist) map[it.id] = { outcome: null, note: "" };
  if (!Array.isArray(resultJson)) return map;
  for (const raw of resultJson) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const itemId = r.itemId;
    if (typeof itemId !== "string" || !map[itemId]) continue;
    let outcome: ItemResult["outcome"] = null;
    if (r.outcome === "pass" || r.outcome === "fail" || r.outcome === "na") outcome = r.outcome;
    else if (r.value === "pass" || r.value === "fail" || r.value === "na") outcome = r.value;
    const note = typeof r.note === "string" ? r.note : typeof r.value === "string" ? r.value : "";
    const photoDataUrl = typeof r.photoDataUrl === "string" ? r.photoDataUrl : undefined;
    const photoFileName = typeof r.photoFileName === "string" ? r.photoFileName : undefined;
    const followUpIssueId =
      typeof r.followUpIssueId === "string" && r.followUpIssueId.trim()
        ? r.followUpIssueId.trim()
        : undefined;
    map[itemId] = { outcome, note: note ?? "", photoDataUrl, photoFileName, followUpIssueId };
  }
  return map;
}

function groupByLevel(items: OmInspectionChecklistItem[]): [string, OmInspectionChecklistItem[]][] {
  const m = new Map<string, OmInspectionChecklistItem[]>();
  for (const it of items) {
    const key = (it.level?.trim() || "General").trim();
    const list = m.get(key) ?? [];
    list.push(it);
    m.set(key, list);
  }
  return [...m.entries()].sort((a, b) => {
    const na = Number.parseInt(a[0], 10);
    const nb = Number.parseInt(b[0], 10);
    const aIsNum = !Number.isNaN(na) && String(na) === a[0].trim();
    const bIsNum = !Number.isNaN(nb) && String(nb) === b[0].trim();
    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a[0].localeCompare(b[0]);
  });
}

/* ── Component ──────────────────────────────────────── */

type Props = {
  projectId: string;
  run: OmInspectionRunRow;
  template: OmInspectionTemplateRow | undefined;
  open: boolean;
  onClose: () => void;
};

// fallow-ignore-next-line complexity
export function OmInspectionRunSlideOver({ projectId, run, template, open, onClose }: Props) {
  const qc = useQueryClient();
  const { primary } = useEnterpriseWorkspace();
  const workspaceId = primary?.workspace.id;
  const checklist = useMemo(
    () => parseChecklist(template?.checklistJson),
    [template?.checklistJson],
  );
  const [results, setResults] = useState<Record<string, ItemResult>>(() =>
    resultsFromRunJson(checklist, run.resultJson),
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showEvidenceErrors, setShowEvidenceErrors] = useState(false);
  const uploadInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const skipNextOfflineSave = useRef(false);

  const { data: project } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    skipNextOfflineSave.current = true;
    setShowEvidenceErrors(false);
    setSignatureDataUrl(
      run.signatureDataUrl?.startsWith("data:image") ? run.signatureDataUrl : null,
    );
    const serverMap = resultsFromRunJson(checklist, run.resultJson);
    const draft = loadOmInspectionOfflineDraft(projectId, run.id);
    if (draft && new Date(draft.savedAt).getTime() > new Date(run.updatedAt).getTime()) {
      setResults(resultsFromRunJson(checklist, draft.resultJson));
    } else {
      setResults(serverMap);
    }
  }, [open, run.id, run.updatedAt, run.resultJson, run.signatureDataUrl, checklist, projectId]);

  const isDraft = run.status === "DRAFT";
  const requireFailEvidence = template?.requireFailEvidence !== false;

  const setField = useCallback((itemId: string, patch: Partial<ItemResult>) => {
    setResults((prev) => ({ ...prev, [itemId]: { ...prev[itemId]!, ...patch } }));
  }, []);

  const buildPayloadRows = useCallback(
    () => buildInspectionResultPayload(checklist, results),
    [checklist, results],
  );

  useEffect(() => {
    if (!open || !isDraft) return;
    if (skipNextOfflineSave.current) {
      skipNextOfflineSave.current = false;
      return;
    }
    saveOmInspectionOfflineDraft(projectId, run.id, buildPayloadRows());
  }, [results, open, isDraft, projectId, run.id, buildPayloadRows]);

  const [cameraItemId, setCameraItemId] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    const v = cameraVideoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useLayoutEffect(() => {
    if (!cameraItemId) {
      stopCameraStream();
      return;
    }

    let cancelled = false;

    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera is not available in this browser. Try Upload file instead.");
        setCameraItemId(null);
        return;
      }
      if (typeof window !== "undefined" && !window.isSecureContext) {
        toast.error("Camera needs HTTPS (or localhost). Open PlanSync over a secure URL.");
        setCameraItemId(null);
        return;
      }
      stopCameraStream();
      let v = cameraVideoRef.current;
      if (!v) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        v = cameraVideoRef.current;
      }
      if (!v) {
        toast.error("Could not start camera preview.");
        setCameraItemId(null);
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: cameraFacing,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        v.srcObject = stream;
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.muted = true;
        await v.play().catch(() => {});
      } catch (e) {
        console.error("[inspection-camera]", e);
        toast.error(
          "Could not open the camera. Allow camera permission in the browser, or use Upload file.",
        );
        setCameraItemId(null);
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraItemId, cameraFacing, stopCameraStream]);

  const captureCameraFrame = useCallback(() => {
    const video = cameraVideoRef.current;
    const itemId = cameraItemId;
    if (!video || !itemId) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      toast.error("Wait for the camera preview to appear, then capture again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    setField(itemId, { photoDataUrl: dataUrl, photoFileName: `Camera ${stamp}.jpg` });
    setCameraItemId(null);
    toast.success("Photo added.");
  }, [cameraItemId, setField]);

  useEffect(() => {
    if (!open) setCameraItemId(null);
  }, [open]);

  const answeredCount = useMemo(
    () =>
      checklist.filter((it) => (it.type === "text" ? true : results[it.id]?.outcome != null))
        .length,
    [checklist, results],
  );

  const allAnswered = useMemo(
    () => checklist.every((it) => (it.type === "text" ? true : results[it.id]?.outcome != null)),
    [checklist, results],
  );

  const evidenceErrorByItem = useMemo(
    () => failEvidenceErrors(requireFailEvidence, checklist, results),
    [requireFailEvidence, checklist, results],
  );
  const hasEvidenceErrors = Object.keys(evidenceErrorByItem).length > 0;

  const woBase = projectScopedHref(projectId, "/om/work-orders", workspaceId);

  /* ── Mutations ── */

  const patchMut = useMutation({
    mutationFn: (resultJson: ReturnType<typeof buildPayloadRows>) =>
      patchOmInspectionRun(projectId, run.id, { resultJson }),
    onSuccess: async () => {
      clearOmInspectionOfflineDraft(projectId, run.id);
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      toast.success("Draft saved.");
    },
    onError: (e: Error) => {
      if (isLikelyNetworkError(e)) {
        saveOmInspectionOfflineDraft(projectId, run.id, buildPayloadRows());
        toast.message("Saved offline — will sync when online");
        return;
      }
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  useEffect(() => {
    if (!open || !isDraft) return;
    const onOnline = () => {
      const draft = loadOmInspectionOfflineDraft(projectId, run.id);
      if (!draft || patchMut.isPending) return;
      patchMut.mutate(draft.resultJson as ReturnType<typeof buildPayloadRows>);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [open, isDraft, projectId, run.id, patchMut]);

  const completeMut = useMutation({
    mutationFn: () =>
      postOmInspectionRunComplete(projectId, run.id, {
        resultJson: buildPayloadRows(),
        createWorkOrdersForFailures: true,
        signatureDataUrl: signatureDataUrl || null,
      }),
    onSuccess: async (data) => {
      clearOmInspectionOfflineDraft(projectId, run.id);
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      await qc.invalidateQueries({ queryKey: qk.issuesForProject(projectId), exact: false });
      const n = data.workOrderIds.length;
      let emailHint = "";
      if (data.buildingOwnerNotify.sent) emailHint = " Report emailed to the building owner.";
      else if (data.buildingOwnerNotify.skippedReason === "no_recipient")
        emailHint = " Set a building owner email under Handover to auto-email PDF reports.";
      const firstWo = data.workOrderIds[0];
      toast.success(
        n > 0
          ? `Inspection completed. ${n} work order(s) created.${emailHint}`
          : `Inspection completed.${emailHint}`,
        firstWo
          ? {
              action: {
                label: "Open work order",
                onClick: () => {
                  window.location.href = `${woBase}?wo=${encodeURIComponent(firstWo)}`;
                },
              },
            }
          : undefined,
      );
      window.open(omInspectionRunReportPdfUrl(projectId, run.id), "_blank", "noopener,noreferrer");
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteRunMut = useMutation({
    mutationFn: () => deleteOmInspectionRun(projectId, run.id),
    onSuccess: async () => {
      clearOmInspectionOfflineDraft(projectId, run.id);
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      toast.success("Inspection deleted.");
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const woMut = useMutation({
    mutationFn: (p: { itemId: string; title: string }) =>
      postOmInspectionRunWorkOrder(projectId, run.id, p),
    onSuccess: async (data, vars) => {
      let payload: ReturnType<typeof buildInspectionResultPayload> | undefined;
      setResults((prev) => {
        const cur = prev[vars.itemId];
        if (!cur) return prev;
        const next = { ...prev, [vars.itemId]: { ...cur, followUpIssueId: data.id } };
        payload = buildInspectionResultPayload(checklist, next);
        return next;
      });
      if (payload) {
        try {
          await patchOmInspectionRun(projectId, run.id, { resultJson: payload });
          clearOmInspectionOfflineDraft(projectId, run.id);
          await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
        } catch (e) {
          if (isLikelyNetworkError(e) && payload) {
            saveOmInspectionOfflineDraft(projectId, run.id, payload);
            toast.message("Saved offline — will sync when online");
          }
        }
      }
      await qc.invalidateQueries({ queryKey: qk.issuesForProject(projectId), exact: false });
      toast.success("Work order created.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const onPickPhoto = useCallback(
    (itemId: string, fileList: FileList | null) => {
      const f = fileList?.[0];
      if (!f || !f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === "string" ? reader.result : undefined;
        if (url) setField(itemId, { photoDataUrl: url, photoFileName: f.name });
      };
      reader.readAsDataURL(f);
    },
    [setField],
  );

  const tryComplete = () => {
    if (hasEvidenceErrors) {
      setShowEvidenceErrors(true);
      toast.error("Add a photo and note for each Fail item before completing.");
      return;
    }
    completeMut.mutate();
  };

  /* ── Derived ── */

  const grouped = useMemo(() => groupByLevel(checklist), [checklist]);
  const total = checklist.length || 1;
  const pct = Math.round((answeredCount / total) * 100);
  const inspectionTitle = `${template?.name ?? run.template.name} Inspection`;
  const buildingName = project?.name ?? "Project";
  const dateLabel = new Date(run.createdAt).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  /* ── Render ── */

  const cameraPortal =
    cameraItemId && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col bg-black/92 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Camera"
          >
            <div className="flex items-center justify-between gap-2 text-white">
              <p className="text-sm font-medium">Take a photo</p>
              <button
                type="button"
                onClick={() => setCameraItemId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Close camera"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">
              <video
                ref={cameraVideoRef}
                className="max-h-full max-w-full object-contain"
                playsInline
                muted
                autoPlay
                aria-label="Camera preview"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCameraFacing((f) => (f === "environment" ? "user" : "environment"))
                }
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Flip camera
              </button>
              <button
                type="button"
                onClick={captureCameraFrame}
                className="rounded-xl bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Capture photo
              </button>
              <button
                type="button"
                onClick={() => setCameraItemId(null)}
                className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-medium text-white"
              >
                Cancel
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/60">
              Allow camera access when prompted. On iPhone, use Safari or your installed PWA over
              HTTPS.
            </p>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <EnterpriseSlideOver
        open={open}
        onClose={onClose}
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),460px)]"
        panelVariant="floating"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        closeOnBackdrop={false}
        closeOnEscape={false}
        ariaLabelledBy="run-slide-title"
        header={
          <div className="min-w-0 pr-2">
            <h2
              id="run-slide-title"
              className="truncate text-lg font-semibold text-[var(--enterprise-text)]"
            >
              {inspectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              {buildingName} · {dateLabel}
              {isDraft ? " · Open" : " · Closed"}
            </p>
          </div>
        }
        bodyClassName="px-5 py-5"
        footerClassName="border-t border-[var(--enterprise-border)] px-5 py-3"
        footer={
          isDraft ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={deleteRunMut.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this inspection? Draft progress will be lost. This cannot be undone.",
                    )
                  )
                    return;
                  deleteRunMut.mutate();
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-[var(--enterprise-semantic-danger-text)] hover:bg-[var(--enterprise-semantic-danger-bg)] disabled:opacity-50"
              >
                Delete inspection
              </button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={patchMut.isPending}
                  onClick={() => patchMut.mutate(buildPayloadRows())}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--enterprise-border)] px-5 text-sm font-medium text-[var(--enterprise-text)] disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={completeMut.isPending || !allAnswered}
                  onClick={tryComplete}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Complete Inspection
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={deleteRunMut.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this completed inspection and its report? This cannot be undone.",
                    )
                  )
                    return;
                  deleteRunMut.mutate();
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-[var(--enterprise-semantic-danger-text)] hover:bg-[var(--enterprise-semantic-danger-bg)] disabled:opacity-50"
              >
                Delete inspection
              </button>
              <a
                href={omInspectionRunReportPdfUrl(projectId, run.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--enterprise-border)] px-5 text-sm font-semibold text-[var(--enterprise-primary)]"
              >
                Open PDF report
              </a>
            </div>
          )
        }
      >
        <div className="space-y-7">
          {checklist.length === 0 ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              This template has no checklist items.
            </p>
          ) : (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--enterprise-text-muted)]">
                  <span>Progress</span>
                  <span>
                    {answeredCount}/{total} items
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--enterprise-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--enterprise-primary)] transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {grouped.map(([levelKey, items]) => (
                <section key={levelKey} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                    {Number.isFinite(Number(levelKey)) &&
                    String(Number(levelKey)) === levelKey.trim()
                      ? `Section ${levelKey}`
                      : levelKey}
                  </h3>

                  <ul className="space-y-3">
                    {items.map(
                      // fallow-ignore-next-line complexity
                      (it) => {
                        const r = results[it.id] ?? { outcome: null, note: "" };
                        const answered = it.type === "text" ? true : r.outcome != null;
                        const evidenceErr =
                          showEvidenceErrors && evidenceErrorByItem[it.id]
                            ? evidenceErrorByItem[it.id]
                            : null;
                        return (
                          <li
                            key={it.id}
                            className={`space-y-3 rounded-xl border bg-[var(--enterprise-bg)] p-3.5 ${
                              evidenceErr
                                ? "border-[var(--enterprise-semantic-danger-border)]"
                                : "border-[var(--enterprise-border)]"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {answered ? (
                                <CheckSquare
                                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                              ) : (
                                <Square
                                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                              )}
                              <span className="text-sm font-medium text-[var(--enterprise-text)]">
                                {it.label}
                              </span>
                            </div>

                            {it.type !== "text" && (
                              <div className="flex flex-wrap gap-1.5">
                                {(
                                  [
                                    {
                                      o: "pass" as const,
                                      label: "Pass",
                                      active:
                                        "border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)]",
                                    },
                                    {
                                      o: "fail" as const,
                                      label: "Fail",
                                      active:
                                        "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]",
                                    },
                                    {
                                      o: "na" as const,
                                      label: "N/A",
                                      active:
                                        "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]",
                                    },
                                  ] as const
                                ).map(({ o, label, active }) => (
                                  <label
                                    key={o}
                                    className={`inline-flex min-h-9 cursor-pointer items-center rounded-lg border px-3 text-xs font-semibold transition ${
                                      r.outcome === o
                                        ? active
                                        : "border-[var(--enterprise-border)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`outcome-${run.id}-${it.id}`}
                                      checked={r.outcome === o}
                                      disabled={!isDraft}
                                      onChange={() => setField(it.id, { outcome: o })}
                                      className="sr-only"
                                    />
                                    {label}
                                  </label>
                                ))}
                              </div>
                            )}

                            <div>
                              {it.type === "text" ? (
                                <textarea
                                  value={r.note}
                                  onChange={(e) => setField(it.id, { note: e.target.value })}
                                  disabled={!isDraft}
                                  rows={3}
                                  placeholder="Notes…"
                                  className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-sm disabled:opacity-60"
                                />
                              ) : r.note || isDraft || r.outcome === "fail" ? (
                                <input
                                  type="text"
                                  value={r.note}
                                  onChange={(e) => setField(it.id, { note: e.target.value })}
                                  disabled={!isDraft}
                                  placeholder={
                                    r.outcome === "fail" && requireFailEvidence
                                      ? "Note (required for Fail)"
                                      : "Note (optional)"
                                  }
                                  className={`w-full rounded-lg border bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-sm disabled:opacity-60 ${
                                    evidenceErr && !r.note.trim()
                                      ? "border-[var(--enterprise-semantic-danger-border)]"
                                      : "border-[var(--enterprise-border)]"
                                  }`}
                                />
                              ) : null}
                            </div>

                            {it.type !== "text" && (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  ref={(el) => {
                                    uploadInputs.current[it.id] = el;
                                  }}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={!isDraft}
                                  onChange={(e) => onPickPhoto(it.id, e.target.files)}
                                />
                                {isDraft ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setCameraItemId(it.id)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-2 text-xs font-semibold text-[var(--enterprise-text)]"
                                    >
                                      <Camera className="h-3.5 w-3.5" />
                                      Camera
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => uploadInputs.current[it.id]?.click()}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-2 text-xs font-semibold text-[var(--enterprise-text)]"
                                    >
                                      <Upload className="h-3.5 w-3.5" />
                                      Upload
                                    </button>
                                  </>
                                ) : null}
                                {r.photoDataUrl ? (
                                  <div className="flex items-center gap-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={r.photoDataUrl}
                                      alt=""
                                      className="h-14 w-14 rounded-lg border border-[var(--enterprise-border)] object-cover"
                                    />
                                    {isDraft ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setField(it.id, {
                                            photoDataUrl: undefined,
                                            photoFileName: undefined,
                                          })
                                        }
                                        className="text-xs font-semibold text-[var(--enterprise-semantic-danger-text)]"
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {evidenceErr ? (
                              <p
                                className="text-xs font-medium text-[var(--enterprise-semantic-danger-text)]"
                                role="alert"
                              >
                                {evidenceErr}
                              </p>
                            ) : null}

                            {r.outcome === "fail" || r.followUpIssueId ? (
                              <div>
                                {r.followUpIssueId ? (
                                  <Link
                                    href={`${woBase}?wo=${encodeURIComponent(r.followUpIssueId)}`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
                                  >
                                    Open work order
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Link>
                                ) : isDraft ? (
                                  <button
                                    type="button"
                                    disabled={woMut.isPending}
                                    onClick={() =>
                                      woMut.mutate({
                                        itemId: it.id,
                                        title: `Work order: ${it.label}`,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)]"
                                  >
                                    Create work order
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        );
                      },
                    )}
                  </ul>
                </section>
              ))}

              {isDraft ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                      Signature
                    </h3>
                    <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                      Optional sign-off before completing.
                    </p>
                    <OmInspectionSignaturePad className="mt-2" onChange={setSignatureDataUrl} />
                  </div>
                  <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                    <p className="font-semibold text-[var(--enterprise-text)]">On complete:</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      <li>PDF report generated</li>
                      <li>Failed items → work orders created</li>
                      <li>Report sent to building owner</li>
                      {requireFailEvidence ? <li>Fail items need a photo and note</li> : null}
                    </ul>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </EnterpriseSlideOver>
      {cameraPortal}
    </>
  );
}
