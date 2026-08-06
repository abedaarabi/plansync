"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Clock,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { ProposalLetterPreviewDialog } from "@/components/enterprise/ProposalLetterPreviewDialog";
import { ProposalPdfLightbox } from "@/components/enterprise/ProposalPdfLightbox";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { ProposalCoverEditor } from "@/components/enterprise/proposals/editor/ProposalCoverEditor";
import { ProposalEditorStepBar } from "@/components/enterprise/proposals/editor/ProposalEditorStepBar";
import { ProposalCommentsPanel } from "@/components/enterprise/proposals/editor/ProposalCommentsPanel";
import { ProposalReviewStep } from "@/components/enterprise/proposals/editor/ProposalReviewStep";
import { ProposalSaveStatusBadge } from "@/components/enterprise/proposals/editor/ProposalSaveStatusBadge";
import { ProposalVersionHistoryPanel } from "@/components/enterprise/proposals/editor/ProposalVersionHistoryPanel";
import {
  coverHasMeaningfulContent,
  fmtMoney,
  type ActiveSection,
  type SaveStatus,
} from "@/components/enterprise/proposals/editor/proposalEditorShared";
import {
  createProposal,
  fetchProposalDetail,
  fetchProposalPdfBlob,
  fetchProposalTakeoffFileVersions,
  fetchProposalTemplates,
  fetchProjects,
  fetchWorkspaceProposalRateHints,
  patchProposal,
  previewProposalHtml,
  proposalAiDraft,
  saveProposalDocumentVersion,
  sendProposalToClient,
  syncProposalFromTakeoff,
  type ProposalDocumentVersionRow,
  type ProposalItemRow,
} from "@/lib/api-client";
import { proposalCoverTextToHtml } from "@/lib/proposalCoverHtml";
import { qk } from "@/lib/queryKeys";
import { PlanUpgradeCallout } from "@/components/enterprise/PlanUpgradeCallout";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";
import { useProjectCurrency } from "@/hooks/useProjectCurrency";

type AttachmentPick = { fileVersionId: string; label: string; checked: boolean };
type RightPanel = "details" | "history" | "comments";

// fallow-ignore-next-line complexity
export function ProposalEditorWorkspace({
  projectId,
  workspaceId: wsFromPath,
  existingProposalId,
}: {
  projectId: string;
  workspaceId?: string;
  existingProposalId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { primary, me, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProPlusClient(primary?.workspace);
  const currentUserId = me?.user.id;
  const { currency: projectCurrency, isPending: projectCurrencyPending } =
    useProjectCurrency(projectId);

  const basePath = wsFromPath
    ? `/workspaces/${wsFromPath}/projects/${projectId}/proposals`
    : `/projects/${projectId}/proposals`;

  // ---- Form state ----
  const [proposalId, setProposalId] = useState<string | null>(existingProposalId ?? null);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [taxPercent, setTaxPercent] = useState("0");
  const [workPricePercent, setWorkPricePercent] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [templateId, setTemplateId] = useState<string>("");
  const [coverHtml, setCoverHtml] = useState("");
  const [coverJson, setCoverJson] = useState<Record<string, unknown>>({});
  /** Bumped when template/AI replaces cover so TipTap force-syncs. */
  const [coverContentRevision, setCoverContentRevision] = useState(0);
  const [pendingTemplateId, setPendingTemplateId] = useState<string>("");
  const [attachments, setAttachments] = useState<AttachmentPick[]>([]);
  const [selectedFvIds, setSelectedFvIds] = useState<string[]>([]);

  // ---- UI state ----
  const [activeSection, setActiveSection] = useState<ActiveSection>("client");
  const [rightPanel, setRightPanel] = useState<RightPanel>("details");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [editHydrating, setEditHydrating] = useState(Boolean(existingProposalId));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<{
    letterMarkdown: string;
    letterHtml: string | null;
    takeoffTableHtml: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<{
    letterMarkdown: string;
    letterHtml: string | null;
    takeoffTableHtml: string;
  } | null>(null);
  const [reviewPreviewLoading, setReviewPreviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [rateHintQ, setRateHintQ] = useState("");
  const [debouncedRateHintQ, setDebouncedRateHintQ] = useState("");
  const [versionSummary, setVersionSummary] = useState("");
  const [showVersionSummaryInput, setShowVersionSummaryInput] = useState(false);

  const sendLockRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newDraftCurrencySyncedFor = useRef<string | null>(null);

  // ---- Queries ----
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });
  const project = projects.find((p) => p.id === projectId);

  const { data: fvData } = useQuery({
    queryKey: qk.proposalTakeoffVersions(projectId),
    queryFn: () => fetchProposalTakeoffFileVersions(projectId),
    enabled: Boolean(wid && isPro),
  });

  const { data: detail, isPending: detailLoading } = useQuery({
    queryKey: qk.projectProposal(projectId, proposalId ?? ""),
    queryFn: () => fetchProposalDetail(projectId, proposalId!),
    enabled: Boolean(wid && isPro && proposalId),
  });

  const { data: tmplData } = useQuery({
    queryKey: qk.proposalTemplates(wid ?? ""),
    queryFn: () => fetchProposalTemplates(wid!),
    enabled: Boolean(wid && isPro),
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRateHintQ(rateHintQ.trim()), 400);
    return () => clearTimeout(t);
  }, [rateHintQ]);

  const { data: rateHints } = useQuery({
    queryKey: qk.proposalRateHints(wid ?? "", debouncedRateHintQ),
    queryFn: () => fetchWorkspaceProposalRateHints(wid!, debouncedRateHintQ),
    enabled: Boolean(wid && isPro && debouncedRateHintQ.length >= 2),
  });

  // ---- Hydrate from existing proposal ----
  useEffect(() => {
    if (!existingProposalId || !wid || !isPro || !project) {
      if (!existingProposalId) setEditHydrating(false);
      return;
    }
    let cancelled = false;
    setEditHydrating(true);
    void fetchProposalDetail(projectId, existingProposalId)
      .then((d) => {
        if (cancelled) return;
        setProposalId(d.id);
        setTitle(d.title);
        setClientName(d.clientName);
        setClientEmail(d.clientEmail);
        setClientCompany(d.clientCompany ?? "");
        setClientPhone(d.clientPhone ?? "");
        setCurrency(d.currency);
        setValidUntil(d.validUntil.slice(0, 10));
        setTaxPercent(d.taxPercent);
        setWorkPricePercent(d.workPricePercent);
        setDiscount(d.discount);
        setTemplateId(d.templateId ?? "");
        setPendingTemplateId(d.templateId ?? "");
        setCoverHtml(d.coverNote);
        setCoverContentRevision((n) => n + 1);
        setSelectedFvIds(
          d.sourceFileVersionIds?.length
            ? d.sourceFileVersionIds
            : d.sourceFileVersionId
              ? [d.sourceFileVersionId]
              : [],
        );
        const sel = new Set(d.attachments.map((a) => a.fileVersionId));
        setAttachments(
          project.files.flatMap((f) =>
            f.versions.map((v) => ({
              fileVersionId: v.id,
              label: `${f.name} · v${v.version}`,
              checked: sel.has(v.id),
            })),
          ),
        );
        qc.setQueryData(qk.projectProposal(projectId, d.id), d);
        setActiveSection("cover");
        setSaveStatus("saved");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load proposal."))
      .finally(() => {
        if (!cancelled) setEditHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [existingProposalId, projectId, wid, isPro, project, qc]);

  // fallow-ignore-next-line complexity
  useEffect(() => {
    if (existingProposalId || projectCurrencyPending || !projectId) return;
    if (newDraftCurrencySyncedFor.current === projectId) return;
    setCurrency(projectCurrency);
    newDraftCurrencySyncedFor.current = projectId;
  }, [existingProposalId, projectId, projectCurrency, projectCurrencyPending]);

  useEffect(() => {
    if (!project) return;
    setAttachments((prev) => {
      if (prev.length > 0) return prev;
      return project.files.flatMap((f) =>
        f.versions.map((v) => ({
          fileVersionId: v.id,
          label: `${f.name} · v${v.version}`,
          checked: false,
        })),
      );
    });
  }, [project]);

  useEffect(() => {
    if (!detail) return;
    setWorkPricePercent(detail.workPricePercent);
  }, [detail?.id, detail?.workPricePercent]);

  // ---- Auto-fetch letter preview when entering Review ----
  useEffect(() => {
    if (activeSection !== "review" || !proposalId) return;
    let cancelled = false;
    setReviewPreviewLoading(true);
    void previewProposalHtml(projectId, proposalId)
      .then((prev) => {
        if (cancelled) return;
        setReviewPreview({
          letterMarkdown: prev.letterMarkdown,
          letterHtml: prev.letterHtml,
          takeoffTableHtml: prev.takeoffTableHtml,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load preview.");
        }
      })
      .finally(() => {
        if (!cancelled) setReviewPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, proposalId, projectId, coverHtml]);

  // ---- Autosave cover letter ----
  const scheduleAutosaveCover = useCallback(
    (html: string) => {
      if (!proposalId) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      setSaveStatus("unsaved");
      autosaveTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await patchProposal(projectId, proposalId, { coverNote: html });
          qc.invalidateQueries({ queryKey: qk.projectProposal(projectId, proposalId) });
          setSaveStatus("saved");
        } catch (e) {
          setSaveStatus("error");
          toast.error(e instanceof Error ? e.message : "Could not save cover letter.");
        }
      }, 1200);
    },
    [proposalId, projectId, qc],
  );

  // ---- Mutations ----
  const createOrSaveMut = useMutation({
    mutationFn: async () => {
      const validUntilIso = new Date(validUntil + "T12:00:00.000Z").toISOString();
      if (proposalId) {
        return patchProposal(projectId, proposalId, {
          title,
          clientName,
          clientEmail,
          clientCompany: clientCompany || null,
          clientPhone: clientPhone || null,
          currency,
          validUntil: validUntilIso,
        });
      }
      return createProposal(projectId, {
        title,
        clientName,
        clientEmail,
        clientCompany: clientCompany || null,
        clientPhone: clientPhone || null,
        currency,
        validUntil: validUntilIso,
      });
    },
    onSuccess: (p) => {
      setProposalId(p.id);
      qc.setQueryData(qk.projectProposal(projectId, p.id), p);
      qc.invalidateQueries({ queryKey: qk.projectProposals(projectId) });
      if (!existingProposalId) setActiveSection("pricing");
      toast.success(proposalId ? "Details saved" : "Draft created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: (fileVersionIds: string[]) =>
      syncProposalFromTakeoff(projectId, proposalId!, fileVersionIds, "replace"),
    onSuccess: (p) => {
      qc.setQueryData(qk.projectProposal(projectId, p.id), p);
      setSelectedFvIds(
        p.sourceFileVersionIds?.length
          ? p.sourceFileVersionIds
          : p.sourceFileVersionId
            ? [p.sourceFileVersionId]
            : [],
      );
      toast.success("Loaded takeoff lines");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveItemsMut = useMutation({
    mutationFn: async (items: ProposalItemRow[]) =>
      patchProposal(projectId, proposalId!, {
        items: items.map((it, i) => ({
          itemName: it.itemName,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          sortOrder: i,
          sourceTakeoffLineId: it.sourceTakeoffLineId,
        })),
        taxPercent,
        workPricePercent,
        discount,
        attachmentFileVersionIds: attachments.filter((a) => a.checked).map((a) => a.fileVersionId),
      }),
    onSuccess: (p) => {
      qc.setQueryData(qk.projectProposal(projectId, p.id), p);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveVersionMut = useMutation({
    mutationFn: () =>
      saveProposalDocumentVersion(projectId, proposalId!, {
        contentJson: coverJson,
        contentHtml: coverHtml,
        changeSummary: versionSummary || "Manual save",
      }),
    onSuccess: (v: ProposalDocumentVersionRow) => {
      qc.invalidateQueries({
        queryKey: qk.projectProposalDocumentVersions(projectId, proposalId!),
      });
      toast.success(`Saved as v${v.versionNumber}`);
      setVersionSummary("");
      setShowVersionSummaryInput(false);
      setSaveStatus("saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: () => sendProposalToClient(projectId, proposalId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectProposals(projectId) });
      qc.invalidateQueries({ queryKey: qk.projectProposalAnalytics(projectId) });
      toast.success("Sent to client");
      router.push(`${basePath}/${proposalId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = detail;
  const hasItems = (d?.items.length ?? 0) > 0;
  const canSendToClient = d && (d.status === "DRAFT" || d.status === "CHANGE_REQUESTED");

  // ---- New manual item draft ----
  const emptyDraft = () => ({ itemName: "", quantity: "1", unit: "ea", rate: "0" });
  const [newItemDraft, setNewItemDraft] = useState(emptyDraft());
  const [addingItem, setAddingItem] = useState(false);

  const recalcItems = (items: ProposalItemRow[]): ProposalItemRow[] =>
    items.map((it) => {
      const q = Number(it.quantity);
      const r = Number(it.rate);
      const lt = Number.isFinite(q) && Number.isFinite(r) ? (q * r).toFixed(2) : it.lineTotal;
      return { ...it, lineTotal: lt };
    });

  const updateLine = (
    id: string,
    field: "rate" | "quantity" | "itemName" | "unit",
    value: string,
  ) => {
    if (!d) return;
    const items = d.items.map((it) =>
      it.id === id ? { ...it, [field]: value } : it,
    ) as ProposalItemRow[];
    saveItemsMut.mutate(recalcItems(items));
  };

  const deleteLine = (id: string) => {
    if (!d) return;
    saveItemsMut.mutate(recalcItems(d.items.filter((it) => it.id !== id) as ProposalItemRow[]));
  };

  const commitNewItem = () => {
    if (!d || !newItemDraft.itemName.trim()) return;
    const qty = newItemDraft.quantity || "1";
    const rate = newItemDraft.rate || "0";
    const lt = (Number(qty) * Number(rate)).toFixed(2);
    const newRow: ProposalItemRow = {
      id: `draft-${Date.now()}`,
      itemName: newItemDraft.itemName.trim(),
      quantity: qty,
      unit: newItemDraft.unit || "ea",
      rate,
      lineTotal: lt,
      sortOrder: d.items.length,
      sourceTakeoffLineId: null,
    };
    saveItemsMut.mutate(recalcItems([...(d.items as ProposalItemRow[]), newRow]));
    setNewItemDraft(emptyDraft());
    setAddingItem(false);
  };

  const savePricingFields = () => {
    if (proposalId)
      patchProposal(projectId, proposalId, { taxPercent, workPricePercent, discount }).then((p) =>
        qc.setQueryData(qk.projectProposal(projectId, p.id), p),
      );
  };

  const applyTemplateDefaults = (tid: string) => {
    const t = tmplData?.templates.find((x) => x.id === tid);
    if (!t) return;
    const defaults = t.defaultsJson as {
      taxPercent?: number;
      workPricePercent?: number;
      validUntilDays?: number;
    } | null;
    if (defaults?.taxPercent != null) setTaxPercent(String(defaults.taxPercent));
    if (defaults?.workPricePercent != null) setWorkPricePercent(String(defaults.workPricePercent));
    if (defaults?.validUntilDays != null) {
      const d = new Date();
      d.setDate(d.getDate() + defaults.validUntilDays);
      setValidUntil(d.toISOString().slice(0, 10));
    }
  };

  const applyTemplate = (tid: string) => {
    const t = tmplData?.templates.find((x) => x.id === tid);
    if (!t || !proposalId) {
      toast.error("Template not found. Refresh and try again.");
      return false;
    }
    if (coverHasMeaningfulContent(coverHtml)) {
      const ok = window.confirm(
        "Replace the current cover letter with this template? Unsaved edits in the letter may be lost.",
      );
      if (!ok) {
        setPendingTemplateId(templateId);
        return false;
      }
    }
    const bodyHtml = proposalCoverTextToHtml(t.body) || t.body || "<p></p>";
    setTemplateId(tid);
    setPendingTemplateId(tid);
    setCoverHtml(bodyHtml);
    setCoverContentRevision((n) => n + 1);
    applyTemplateDefaults(tid);
    setSaveStatus("saving");
    void patchProposal(projectId, proposalId, {
      templateId: tid,
      coverNote: bodyHtml,
    })
      .then((p) => {
        qc.setQueryData(qk.projectProposal(projectId, p.id), p);
        setSaveStatus("saved");
        toast.success(`Applied “${t.name}” to cover letter`);
      })
      .catch((e) => {
        setSaveStatus("error");
        toast.error(e instanceof Error ? e.message : "Could not apply template.");
      });
    return true;
  };

  const openLetterPreview = async () => {
    if (!proposalId) return;
    setPreviewLoading(true);
    try {
      const prev = await previewProposalHtml(projectId, proposalId);
      setPreviewPayload({
        letterMarkdown: prev.letterMarkdown,
        letterHtml: prev.letterHtml,
        takeoffTableHtml: prev.takeoffTableHtml,
      });
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const openReviewPdf = async () => {
    if (!proposalId) return;
    setPdfLoading(true);
    try {
      const blob = await fetchProposalPdfBlob(projectId, proposalId);
      const url = URL.createObjectURL(blob);
      setPdfObjectUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSendToClient = () => {
    if (!hasItems) {
      setActiveSection("pricing");
      toast.error("Add line items in Scope & Pricing before sending.");
      return;
    }
    if (!coverHasMeaningfulContent(coverHtml)) {
      setActiveSection("cover");
      toast.error("Add a cover letter before sending.");
      return;
    }
    if (!clientEmail.trim()) {
      setActiveSection("client");
      toast.error("Add a client email before sending.");
      return;
    }
    if (sendLockRef.current || sendMut.isPending) return;
    sendLockRef.current = true;
    sendMut.mutate(undefined, {
      onSettled: () => {
        sendLockRef.current = false;
      },
    });
  };

  const openMobilePanel = (tab: RightPanel) => {
    setRightPanel(tab);
    setMobilePanelOpen(true);
  };

  if (ctxLoading || (isPro && !wid)) return <EnterpriseLoadingState label="Loading…" />;
  if (!isPro) return <PlanUpgradeCallout feature="Proposals" />;
  if (editHydrating) return <EnterpriseLoadingState label="Loading proposal…" />;

  const totalDisplay = d ? fmtMoney(d.total, d.currency) : null;
  const statusLabel = d?.status.replace(/_/g, " ") ?? "New";

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col overflow-hidden bg-[var(--enterprise-bg)]">
      {/* ─── Top command bar ─── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 shadow-[var(--enterprise-shadow-xs)] sm:px-4">
        <Link
          href={basePath}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Back to proposals"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Proposal title…"
            className="w-full bg-transparent text-sm font-semibold text-[var(--enterprise-text)] placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {totalDisplay && (
              <span className="font-medium text-[var(--enterprise-primary)]">{totalDisplay}</span>
            )}
            {d && (
              <>
                <span>·</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                  {statusLabel}
                </span>
              </>
            )}
          </div>
        </div>

        <ProposalSaveStatusBadge status={saveStatus} />

        <div className="flex shrink-0 items-center gap-1.5">
          {proposalId && (
            <div className="relative">
              {showVersionSummaryInput ? (
                <div className="absolute right-0 top-full z-50 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3 shadow-lg">
                  <input
                    autoFocus
                    value={versionSummary}
                    onChange={(e) => setVersionSummary(e.target.value)}
                    placeholder="Describe this version…"
                    className="rounded border border-[var(--enterprise-border)] px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveVersionMut.mutate();
                      if (e.key === "Escape") setShowVersionSummaryInput(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <EnterpriseButton
                      type="button"
                      size="sm"
                      onClick={() => saveVersionMut.mutate()}
                      disabled={saveVersionMut.isPending}
                      loading={saveVersionMut.isPending}
                      className="flex-1"
                    >
                      {saveVersionMut.isPending ? "Saving…" : "Save version"}
                    </EnterpriseButton>
                    <EnterpriseButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowVersionSummaryInput(false)}
                    >
                      Cancel
                    </EnterpriseButton>
                  </div>
                </div>
              ) : null}
              <EnterpriseButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowVersionSummaryInput((v) => !v)}
                title="Save a named version snapshot"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Save version</span>
              </EnterpriseButton>
            </div>
          )}

          <EnterpriseButton
            type="button"
            variant="secondary"
            size="sm"
            disabled={previewLoading || !proposalId}
            loading={previewLoading}
            onClick={() => void openLetterPreview()}
          >
            {previewLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">Preview</span>
          </EnterpriseButton>

          {proposalId ? (
            <>
              <EnterpriseButton
                type="button"
                size="sm"
                onClick={() => setActiveSection("review")}
                title="Go to Review & Send"
              >
                Review
              </EnterpriseButton>
              {!canSendToClient ? (
                <Link
                  href={`${basePath}/${proposalId}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">View</span>
                </Link>
              ) : null}
            </>
          ) : null}

          <EnterpriseButton
            type="button"
            variant={rightPanelOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRightPanelOpen((v) => !v)}
            title={rightPanelOpen ? "Hide side panel" : "Show side panel"}
            className="hidden xl:inline-flex"
            aria-label={rightPanelOpen ? "Hide side panel" : "Show side panel"}
          >
            <MoreHorizontal className="h-4 w-4" />
          </EnterpriseButton>

          <div className="flex items-center gap-1 xl:hidden">
            <EnterpriseButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openMobilePanel("history")}
              aria-label="Version history"
              title="History"
            >
              <Clock className="h-4 w-4" />
            </EnterpriseButton>
            <EnterpriseButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openMobilePanel("comments")}
              aria-label="Notes"
              title="Notes"
            >
              <MessageSquare className="h-4 w-4" />
            </EnterpriseButton>
          </div>
        </div>
      </div>

      <ProposalEditorStepBar
        activeSection={activeSection}
        onSelect={setActiveSection}
        unlocked={{
          client: true,
          pricing: Boolean(proposalId),
          cover: Boolean(proposalId),
          review: Boolean(proposalId),
        }}
      />

      {/* ─── Main body: doc canvas + right panel ─── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Document canvas */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            {/* Client section */}
            {activeSection === "client" && (
              <section aria-label="Client details">
                <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 shadow-[var(--enterprise-shadow-xs)]">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--enterprise-text)]">
                    <Pencil className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
                    Client & proposal details
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <FormField label="Client name *" value={clientName} onChange={setClientName} />
                    <FormField label="Company" value={clientCompany} onChange={setClientCompany} />
                    <FormField
                      label="Email *"
                      value={clientEmail}
                      onChange={setClientEmail}
                      type="email"
                    />
                    <FormField label="Phone" value={clientPhone} onChange={setClientPhone} />
                    <FormField
                      label="Proposal title *"
                      value={title}
                      onChange={setTitle}
                      className="sm:col-span-2"
                    />
                    <FormField label="Currency" value={currency} onChange={setCurrency} />
                    <FormField
                      label="Valid until"
                      value={validUntil}
                      onChange={setValidUntil}
                      type="date"
                    />
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <div />
                    <EnterpriseButton
                      type="button"
                      disabled={createOrSaveMut.isPending || !title || !clientName || !clientEmail}
                      loading={createOrSaveMut.isPending}
                      onClick={() => createOrSaveMut.mutate()}
                    >
                      {createOrSaveMut.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : proposalId ? (
                        <>
                          <Check className="h-4 w-4" aria-hidden />
                          Save & continue
                        </>
                      ) : (
                        "Create draft →"
                      )}
                    </EnterpriseButton>
                  </div>
                </div>
              </section>
            )}

            {/* Pricing section */}
            {activeSection === "pricing" && (
              <section aria-label="Scope and pricing">
                <div className="space-y-5">
                  {!proposalId ? (
                    <div className="enterprise-alert-warning rounded-xl p-5 text-sm">
                      Complete client details first to enable pricing.
                      <button
                        type="button"
                        onClick={() => setActiveSection("client")}
                        className="mt-2 block font-semibold underline"
                      >
                        Go to client details →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6 shadow-[var(--enterprise-shadow-xs)]">
                        <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
                          Takeoff source
                        </h2>
                        <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                          Select sheet revisions to merge line items in order.
                        </p>
                        <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--enterprise-border)] p-3">
                          {(fvData?.fileVersions ?? []).length === 0 ? (
                            <p className="text-sm text-[var(--enterprise-text-muted)]">
                              No sheet revisions in this project yet.
                            </p>
                          ) : (
                            (fvData?.fileVersions ?? []).map((v) => (
                              <label
                                key={v.id}
                                className="flex cursor-pointer items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFvIds.includes(v.id)}
                                  onChange={(e) =>
                                    setSelectedFvIds((prev) =>
                                      e.target.checked
                                        ? [...prev, v.id]
                                        : prev.filter((id) => id !== v.id),
                                    )
                                  }
                                />
                                <span className="text-[var(--enterprise-text)]">{v.label}</span>
                              </label>
                            ))
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={selectedFvIds.length === 0 || syncMut.isPending}
                          onClick={() => {
                            const ordered = (fvData?.fileVersions ?? [])
                              .map((v) => v.id)
                              .filter((id) => selectedFvIds.includes(id));
                            if (ordered.length) syncMut.mutate(ordered);
                          }}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-4 py-2 text-sm font-medium hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-60"
                        >
                          {syncMut.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : null}
                          Load from takeoff
                        </button>
                      </div>

                      {/* Line items — mobile cards + desktop table */}
                      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
                        {detailLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 animate-spin text-[var(--enterprise-text-muted)]" />
                          </div>
                        ) : (
                          <>
                            {/* Mobile cards */}
                            <div className="space-y-3 p-3 lg:hidden">
                              {(d?.items ?? []).length === 0 && !addingItem ? (
                                <p className="px-1 py-8 text-center text-sm text-[var(--enterprise-text-muted)]">
                                  Load takeoff items above or{" "}
                                  <button
                                    type="button"
                                    onClick={() => setAddingItem(true)}
                                    className="font-medium text-[var(--enterprise-primary)] underline underline-offset-2"
                                  >
                                    add an item
                                  </button>
                                  .
                                </p>
                              ) : (
                                (d?.items ?? []).map((it) => (
                                  <div
                                    key={it.id}
                                    className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3"
                                  >
                                    <input
                                      className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none"
                                      value={it.itemName}
                                      onChange={(e) =>
                                        updateLine(it.id, "itemName", e.target.value)
                                      }
                                      placeholder="Item name"
                                    />
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                      <label className="text-xs text-[var(--enterprise-text-muted)]">
                                        Qty
                                        <input
                                          className="mt-0.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                          value={it.quantity}
                                          onChange={(e) =>
                                            updateLine(it.id, "quantity", e.target.value)
                                          }
                                        />
                                      </label>
                                      <label className="text-xs text-[var(--enterprise-text-muted)]">
                                        Unit
                                        <input
                                          className="mt-0.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                          value={it.unit}
                                          onChange={(e) =>
                                            updateLine(it.id, "unit", e.target.value)
                                          }
                                        />
                                      </label>
                                      <label className="text-xs text-[var(--enterprise-text-muted)]">
                                        Rate
                                        <input
                                          className="mt-0.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                          value={it.rate}
                                          onChange={(e) =>
                                            updateLine(it.id, "rate", e.target.value)
                                          }
                                        />
                                      </label>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                      <span className="text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                                        {fmtMoney(it.lineTotal, d!.currency)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => deleteLine(it.id)}
                                        disabled={saveItemsMut.isPending}
                                        aria-label="Remove line"
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                              {addingItem && (
                                <div className="rounded-lg border border-[var(--enterprise-primary)]/30 bg-[var(--enterprise-primary-soft)] p-3">
                                  <input
                                    autoFocus
                                    value={newItemDraft.itemName}
                                    onChange={(e) =>
                                      setNewItemDraft((p) => ({
                                        ...p,
                                        itemName: e.target.value,
                                      }))
                                    }
                                    placeholder="Item name *"
                                    className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium focus:border-[var(--enterprise-primary)] focus:outline-none"
                                  />
                                  <div className="mt-2 grid grid-cols-3 gap-2">
                                    <input
                                      value={newItemDraft.quantity}
                                      onChange={(e) =>
                                        setNewItemDraft((p) => ({
                                          ...p,
                                          quantity: e.target.value,
                                        }))
                                      }
                                      placeholder="Qty"
                                      className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                    />
                                    <input
                                      value={newItemDraft.unit}
                                      onChange={(e) =>
                                        setNewItemDraft((p) => ({ ...p, unit: e.target.value }))
                                      }
                                      placeholder="Unit"
                                      className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                    />
                                    <input
                                      value={newItemDraft.rate}
                                      onChange={(e) =>
                                        setNewItemDraft((p) => ({ ...p, rate: e.target.value }))
                                      }
                                      placeholder="Rate"
                                      className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                    />
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                    <EnterpriseButton
                                      type="button"
                                      size="sm"
                                      onClick={commitNewItem}
                                      disabled={
                                        !newItemDraft.itemName.trim() || saveItemsMut.isPending
                                      }
                                    >
                                      Add item
                                    </EnterpriseButton>
                                    <EnterpriseButton
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setAddingItem(false);
                                        setNewItemDraft(emptyDraft());
                                      }}
                                    >
                                      Cancel
                                    </EnterpriseButton>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Desktop table */}
                            <div className="hidden overflow-x-auto lg:block">
                              <table className="w-full min-w-[700px] text-sm">
                                <thead className="bg-[var(--enterprise-bg)]/60 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                                  <tr>
                                    <th className="px-4 py-3">Item</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3">Unit</th>
                                    <th className="px-4 py-3 text-right">Rate</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-2 py-3" aria-label="Actions" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {(d?.items ?? []).length === 0 && !addingItem ? (
                                    <tr>
                                      <td
                                        colSpan={6}
                                        className="px-4 py-10 text-center text-sm text-[var(--enterprise-text-muted)]"
                                      >
                                        Load takeoff items above or click{" "}
                                        <button
                                          type="button"
                                          onClick={() => setAddingItem(true)}
                                          className="font-medium text-[var(--enterprise-primary)] underline underline-offset-2"
                                        >
                                          + Add item
                                        </button>{" "}
                                        to add manually.
                                      </td>
                                    </tr>
                                  ) : (
                                    (d?.items ?? []).map((it) => (
                                      <tr
                                        key={it.id}
                                        className="group border-t border-[var(--enterprise-border)]/60"
                                      >
                                        <td className="px-4 py-2">
                                          <input
                                            className="w-full min-w-[140px] rounded border border-transparent bg-transparent px-2 py-1 font-medium text-[var(--enterprise-text)] focus:border-[var(--enterprise-border)] focus:outline-none group-hover:border-[var(--enterprise-border)]"
                                            value={it.itemName}
                                            onChange={(e) =>
                                              updateLine(it.id, "itemName", e.target.value)
                                            }
                                            placeholder="Item name"
                                          />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                          <input
                                            className="w-20 rounded border border-[var(--enterprise-border)] bg-transparent px-2 py-1 text-right text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                            value={it.quantity}
                                            onChange={(e) =>
                                              updateLine(it.id, "quantity", e.target.value)
                                            }
                                          />
                                        </td>
                                        <td className="px-4 py-2">
                                          <input
                                            className="w-16 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-border)] focus:outline-none group-hover:border-[var(--enterprise-border)]"
                                            value={it.unit}
                                            onChange={(e) =>
                                              updateLine(it.id, "unit", e.target.value)
                                            }
                                            placeholder="ea"
                                          />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                          <input
                                            className="w-28 rounded border border-[var(--enterprise-border)] bg-transparent px-2 py-1 text-right text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                            value={it.rate}
                                            onChange={(e) =>
                                              updateLine(it.id, "rate", e.target.value)
                                            }
                                          />
                                        </td>
                                        <td className="px-4 py-2 text-right font-medium tabular-nums text-[var(--enterprise-text)]">
                                          {fmtMoney(it.lineTotal, d!.currency)}
                                        </td>
                                        <td className="px-2 py-2">
                                          <button
                                            type="button"
                                            onClick={() => deleteLine(it.id)}
                                            disabled={saveItemsMut.isPending}
                                            title="Remove this line"
                                            aria-label="Remove line"
                                            className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--enterprise-text-muted)] opacity-0 transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] group-hover:opacity-100 disabled:opacity-40"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}

                                  {addingItem && (
                                    <tr className="border-t border-[var(--enterprise-primary)]/20 bg-[var(--enterprise-primary-soft)]">
                                      <td className="px-4 py-2">
                                        <input
                                          autoFocus
                                          value={newItemDraft.itemName}
                                          onChange={(e) =>
                                            setNewItemDraft((p) => ({
                                              ...p,
                                              itemName: e.target.value,
                                            }))
                                          }
                                          placeholder="Item name *"
                                          className="w-full min-w-[140px] rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-sm font-medium focus:border-[var(--enterprise-primary)] focus:outline-none"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") commitNewItem();
                                            if (e.key === "Escape") {
                                              setAddingItem(false);
                                              setNewItemDraft(emptyDraft());
                                            }
                                          }}
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <input
                                          value={newItemDraft.quantity}
                                          onChange={(e) =>
                                            setNewItemDraft((p) => ({
                                              ...p,
                                              quantity: e.target.value,
                                            }))
                                          }
                                          className="w-20 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-right text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                          placeholder="1"
                                          onKeyDown={(e) => e.key === "Enter" && commitNewItem()}
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          value={newItemDraft.unit}
                                          onChange={(e) =>
                                            setNewItemDraft((p) => ({
                                              ...p,
                                              unit: e.target.value,
                                            }))
                                          }
                                          className="w-16 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                          placeholder="ea"
                                          onKeyDown={(e) => e.key === "Enter" && commitNewItem()}
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <input
                                          value={newItemDraft.rate}
                                          onChange={(e) =>
                                            setNewItemDraft((p) => ({
                                              ...p,
                                              rate: e.target.value,
                                            }))
                                          }
                                          className="w-28 rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-right text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                          placeholder="0.00"
                                          onKeyDown={(e) => e.key === "Enter" && commitNewItem()}
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right text-xs tabular-nums text-[var(--enterprise-text-muted)]">
                                        {fmtMoney(
                                          (
                                            Number(newItemDraft.quantity || 1) *
                                            Number(newItemDraft.rate || 0)
                                          ).toFixed(2),
                                          d?.currency ?? "USD",
                                        )}
                                      </td>
                                      <td className="px-2 py-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAddingItem(false);
                                            setNewItemDraft(emptyDraft());
                                          }}
                                          title="Cancel"
                                          aria-label="Cancel"
                                          className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                        {!detailLoading && (
                          <div className="border-t border-[var(--enterprise-border)]/40 px-4 py-2">
                            {!addingItem ? (
                              <button
                                type="button"
                                onClick={() => setAddingItem(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)]"
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                                Add item manually
                              </button>
                            ) : (
                              <EnterpriseButton
                                type="button"
                                size="sm"
                                onClick={commitNewItem}
                                disabled={!newItemDraft.itemName.trim() || saveItemsMut.isPending}
                                className="hidden lg:inline-flex"
                              >
                                {saveItemsMut.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                )}
                                Add item
                              </EnterpriseButton>
                            )}
                          </div>
                        )}

                        {d && (
                          <div className="border-t border-[var(--enterprise-border)]/60 px-4 py-3 text-right text-sm">
                            <div className="space-y-0.5 text-[var(--enterprise-text-muted)]">
                              <div>Subtotal: {fmtMoney(d.subtotal, d.currency)}</div>
                              {Number(d.workPricePercent) > 0 && (
                                <div>
                                  Work ({d.workPricePercent}%): {fmtMoney(d.workAmount, d.currency)}
                                </div>
                              )}
                              <div>
                                Tax ({d.taxPercent}%): {fmtMoney(d.taxAmount, d.currency)}
                              </div>
                              {Number(d.discount) > 0 && (
                                <div>Discount: −{fmtMoney(d.discount, d.currency)}</div>
                              )}
                            </div>
                            <div className="mt-1.5 text-base font-semibold text-[var(--enterprise-primary)]">
                              Total: {fmtMoney(d.total, d.currency)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pricing adjustments */}
                      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-xs)]">
                        <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">
                          Adjustments
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-4">
                          {[
                            {
                              label: "Work %",
                              value: workPricePercent,
                              onChange: setWorkPricePercent,
                            },
                            { label: "Tax %", value: taxPercent, onChange: setTaxPercent },
                            { label: "Discount", value: discount, onChange: setDiscount },
                          ].map(({ label, value, onChange }) => (
                            <label key={label} className="flex flex-col gap-1 text-sm">
                              <span className="text-[var(--enterprise-text-muted)]">{label}</span>
                              <input
                                className="w-24 rounded-lg border border-[var(--enterprise-border)] bg-transparent px-2 py-1.5 focus:border-[var(--enterprise-primary)] focus:outline-none"
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                onBlur={savePricingFields}
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Rate hints */}
                      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-xs)]">
                        <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">
                          Historical rate hints
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                          Averages from past accepted proposals in your workspace.
                        </p>
                        <input
                          className="mt-3 w-full max-w-md rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                          placeholder="Search item name (2+ letters)…"
                          value={rateHintQ}
                          onChange={(e) => setRateHintQ(e.target.value)}
                        />
                        {(rateHints?.hints?.length ?? 0) > 0 && (
                          <ul className="mt-3 space-y-1 text-sm text-[var(--enterprise-text)]">
                            {rateHints!.hints.map((h) => (
                              <li key={h.itemName} className="flex justify-between gap-2">
                                <span className="min-w-0 flex-1 truncate">{h.itemName}</span>
                                <span className="tabular-nums text-[var(--enterprise-text-muted)]">
                                  avg {fmtMoney(String(h.avgRate), h.currency)} ({h.sampleSize}×)
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Attachments */}
                      {attachments.length > 0 && (
                        <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-xs)]">
                          <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">
                            Attached drawings
                          </h3>
                          <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto text-sm">
                            {attachments.map((a) => (
                              <label
                                key={a.fileVersionId}
                                className="flex cursor-pointer items-center gap-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={a.checked}
                                  onChange={(e) =>
                                    setAttachments((prev) =>
                                      prev.map((x) =>
                                        x.fileVersionId === a.fileVersionId
                                          ? { ...x, checked: e.target.checked }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                                <span className="text-[var(--enterprise-text)]">{a.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pb-16">
                        <EnterpriseButton type="button" onClick={() => setActiveSection("cover")}>
                          Cover letter →
                        </EnterpriseButton>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Cover letter section */}
            {activeSection === "cover" && (
              <section aria-label="Cover letter">
                <div className="space-y-4">
                  {!proposalId ? (
                    <div className="enterprise-alert-warning rounded-xl p-5 text-sm">
                      Create a draft first.
                      <button
                        type="button"
                        onClick={() => setActiveSection("client")}
                        className="mt-2 block font-semibold underline"
                      >
                        Go to client details →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)]">
                        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm sm:max-w-xs">
                          <span className="font-medium text-[var(--enterprise-text)]">
                            Letter template
                          </span>
                          <select
                            className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                            value={pendingTemplateId}
                            onChange={(e) => setPendingTemplateId(e.target.value)}
                          >
                            <option value="">Blank letter</option>
                            {(tmplData?.templates ?? []).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <EnterpriseButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!pendingTemplateId}
                          onClick={() => {
                            if (!pendingTemplateId) return;
                            applyTemplate(pendingTemplateId);
                          }}
                        >
                          Apply template
                        </EnterpriseButton>

                        {templateId && pendingTemplateId !== templateId ? (
                          <span className="text-xs text-[var(--enterprise-text-muted)]">
                            Select Apply to load the letter body
                          </span>
                        ) : null}

                        <EnterpriseButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={aiLoading}
                          loading={aiLoading}
                          onClick={async () => {
                            setAiLoading(true);
                            try {
                              const { text } = await proposalAiDraft(projectId, proposalId!, {});
                              const html = proposalCoverTextToHtml(text);
                              setCoverHtml(html);
                              setCoverContentRevision((n) => n + 1);
                              await patchProposal(projectId, proposalId!, { coverNote: html });
                              qc.invalidateQueries({
                                queryKey: qk.projectProposal(projectId, proposalId!),
                              });
                              toast.success("AI draft ready — review before sending.");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "AI failed");
                            } finally {
                              setAiLoading(false);
                            }
                          }}
                        >
                          {aiLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {aiLoading ? "Working…" : "AI draft"}
                        </EnterpriseButton>

                        <ProposalSaveStatusBadge status={saveStatus} className="ml-auto" />
                      </div>

                      <div className="overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
                        <div className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-6 pt-8 pb-5 sm:px-8">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex flex-col gap-0.5">
                              {d?.workspaceName && (
                                <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                                  {d.workspaceName}
                                </p>
                              )}
                              {d?.createdBy?.name && (
                                <p className="text-xs text-[var(--enterprise-text-muted)]">
                                  {d.createdBy.name}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-[var(--enterprise-text-muted)]">
                              {new Date().toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>

                          <div className="mt-5 flex flex-col gap-0.5">
                            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                              To
                            </p>
                            {clientName ? (
                              <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                                {clientName}
                              </p>
                            ) : (
                              <p className="text-sm italic text-[var(--enterprise-text-muted)]">
                                Client name
                              </p>
                            )}
                            {clientCompany && (
                              <p className="text-xs text-[var(--enterprise-text-muted)]">
                                {clientCompany}
                              </p>
                            )}
                          </div>

                          <div className="mt-4 border-t border-[var(--enterprise-border)] pt-4">
                            <span className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                              Re:{" "}
                            </span>
                            {title ? (
                              <span className="text-sm font-semibold text-[var(--enterprise-text)]">
                                {title}
                              </span>
                            ) : (
                              <span className="text-sm italic text-[var(--enterprise-text-muted)]">
                                Proposal title
                              </span>
                            )}
                            {d?.reference && (
                              <span className="ml-2 text-xs text-[var(--enterprise-text-muted)]">
                                ({d.reference})
                              </span>
                            )}
                          </div>
                        </div>

                        <ProposalCoverEditor
                          content={coverHtml || (d?.coverNote ?? "")}
                          contentRevision={coverContentRevision}
                          onChange={(html, json) => {
                            setCoverHtml(html);
                            setCoverJson(json);
                            scheduleAutosaveCover(html);
                          }}
                          placeholder="Write your cover letter… Type # to insert a merge field."
                          className="rounded-none border-0 shadow-none"
                          variables={[
                            {
                              key: "today.date",
                              label: "Today's date",
                              value: new Date().toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }),
                            },
                            {
                              key: "client.name",
                              label: "Client name",
                              value: clientName || d?.clientName || "",
                            },
                            {
                              key: "client.company",
                              label: "Client company",
                              value: clientCompany || d?.clientCompany || "",
                            },
                            {
                              key: "company.name",
                              label: "Your company name",
                              value: d?.workspaceName || "",
                            },
                            {
                              key: "user.name",
                              label: "Your name (sender)",
                              value: d?.createdBy?.name || "",
                            },
                            {
                              key: "project.name",
                              label: "Project name",
                              value: d?.projectName || "",
                            },
                            {
                              key: "proposal.reference",
                              label: "Proposal reference",
                              value: d?.reference || "",
                            },
                            {
                              key: "proposal.total",
                              label: "Proposal total",
                              value: d?.total ? `${d.currency} ${d.total}` : "",
                            },
                            {
                              key: "proposal.expiry",
                              label: "Valid until",
                              value: d?.validUntil
                                ? new Date(d.validUntil).toLocaleDateString(undefined, {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "",
                            },
                            {
                              key: "takeoff.table",
                              label: "Pricing table",
                              value: "(rendered at send time)",
                            },
                          ]}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <EnterpriseButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveSection("pricing")}
                        >
                          ← Pricing
                        </EnterpriseButton>
                        <EnterpriseButton type="button" onClick={() => setActiveSection("review")}>
                          Review & Send →
                        </EnterpriseButton>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Review step */}
            {activeSection === "review" && (
              <>
                {!proposalId ? (
                  <div className="enterprise-alert-warning rounded-xl p-5 text-sm">
                    Create a draft first.
                    <button
                      type="button"
                      onClick={() => setActiveSection("client")}
                      className="mt-2 block font-semibold underline"
                    >
                      Go to client details →
                    </button>
                  </div>
                ) : (
                  <ProposalReviewStep
                    clientName={clientName}
                    clientEmail={clientEmail}
                    clientCompany={clientCompany}
                    validUntil={validUntil}
                    currency={d?.currency ?? currency}
                    subtotal={d?.subtotal}
                    total={d?.total}
                    taxPercent={d?.taxPercent}
                    taxAmount={d?.taxAmount}
                    workPricePercent={d?.workPricePercent}
                    workAmount={d?.workAmount}
                    discount={d?.discount}
                    coverHtml={coverHtml || d?.coverNote || ""}
                    hasItems={hasItems}
                    canSendToClient={Boolean(canSendToClient)}
                    sendPending={sendMut.isPending}
                    previewLoading={reviewPreviewLoading || previewLoading}
                    reviewPreview={reviewPreview}
                    pdfLoading={pdfLoading}
                    onBackToCover={() => setActiveSection("cover")}
                    onOpenPreview={() => void openLetterPreview()}
                    onReviewPdf={() => void openReviewPdf()}
                    onSend={handleSendToClient}
                    onGoToClient={() => setActiveSection("client")}
                    onGoToPricing={() => setActiveSection("pricing")}
                    onGoToCover={() => setActiveSection("cover")}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── Right panel (desktop) ─── */}
        {rightPanelOpen && (
          <aside className="hidden w-72 shrink-0 flex-col overflow-hidden border-l border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] xl:flex">
            <div className="flex shrink-0 border-b border-[var(--enterprise-border)]">
              {(["details", "history", "comments"] as RightPanel[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRightPanel(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize transition ${
                    rightPanel === tab
                      ? "border-b-2 border-[var(--enterprise-primary)] text-[var(--enterprise-primary)]"
                      : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
                  }`}
                >
                  {tab === "history" ? (
                    <span className="flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      History
                    </span>
                  ) : tab === "comments" ? (
                    <span className="flex items-center justify-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Notes
                    </span>
                  ) : (
                    "Details"
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <RightPanelBody
                rightPanel={rightPanel}
                detail={d}
                basePath={basePath}
                proposalId={proposalId}
                projectId={projectId}
                currentUserId={currentUserId}
                onRestored={(v) => {
                  setCoverHtml(v.contentHtml);
                  setCoverJson(v.contentJson);
                }}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Sticky pricing totals */}
      {activeSection === "pricing" && d ? (
        <div className="mobile-sticky-footer shrink-0 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 shadow-[var(--enterprise-shadow-sm)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 text-sm">
            <span className="text-[var(--enterprise-text-muted)]">
              Subtotal{" "}
              <span className="font-medium text-[var(--enterprise-text)]">
                {fmtMoney(d.subtotal, d.currency)}
              </span>
            </span>
            <span className="font-semibold text-[var(--enterprise-primary)]">
              Total {fmtMoney(d.total, d.currency)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Mobile History / Notes sheet */}
      <EnterpriseSlideOver
        open={mobilePanelOpen}
        onClose={() => setMobilePanelOpen(false)}
        header={
          <div>
            <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
              {rightPanel === "history"
                ? "Version history"
                : rightPanel === "comments"
                  ? "Notes"
                  : "Details"}
            </h2>
          </div>
        }
        footer={
          <EnterpriseButton
            type="button"
            variant="secondary"
            onClick={() => setMobilePanelOpen(false)}
            fullWidth
          >
            Close
          </EnterpriseButton>
        }
        panelMaxWidthClass="max-w-md"
      >
        <div className="space-y-3">
          <div className="flex gap-1 rounded-lg border border-[var(--enterprise-border)] p-1">
            {(["details", "history", "comments"] as RightPanel[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightPanel(tab)}
                className={`flex-1 rounded-md py-2 text-xs font-medium capitalize ${
                  rightPanel === tab
                    ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]"
                    : "text-[var(--enterprise-text-muted)]"
                }`}
              >
                {tab === "comments" ? "Notes" : tab}
              </button>
            ))}
          </div>
          <RightPanelBody
            rightPanel={rightPanel}
            detail={d}
            basePath={basePath}
            proposalId={proposalId}
            projectId={projectId}
            currentUserId={currentUserId}
            onRestored={(v) => {
              setCoverHtml(v.contentHtml);
              setCoverJson(v.contentJson);
            }}
          />
        </div>
      </EnterpriseSlideOver>

      {previewPayload ? (
        <ProposalLetterPreviewDialog
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewPayload(null);
          }}
          title="Preview"
          description="Full proposal preview with cover letter and pricing table."
          letterMarkdown={previewPayload.letterMarkdown}
          letterHtml={previewPayload.letterHtml}
          takeoffTableHtml={previewPayload.takeoffTableHtml}
        />
      ) : null}

      {pdfObjectUrl ? (
        <ProposalPdfLightbox
          pdfUrl={pdfObjectUrl}
          fileName={`${d?.reference ?? proposalId}-proposal.pdf`}
          onClose={() => {
            URL.revokeObjectURL(pdfObjectUrl);
            setPdfObjectUrl(null);
          }}
        />
      ) : null}
    </div>
  );
}

function RightPanelBody({
  rightPanel,
  detail,
  basePath,
  proposalId,
  projectId,
  currentUserId,
  onRestored,
}: {
  rightPanel: RightPanel;
  detail: DetailSnapshot;
  basePath: string;
  proposalId: string | null;
  projectId: string;
  currentUserId?: string;
  onRestored: (v: ProposalDocumentVersionRow) => void;
}) {
  if (rightPanel === "details") {
    return (
      <ProposalDetailsPanel
        detail={detail}
        fmtMoney={fmtMoney}
        basePath={basePath}
        proposalId={proposalId}
      />
    );
  }
  if (rightPanel === "history") {
    if (!proposalId) {
      return (
        <p className="text-center text-sm text-[var(--enterprise-text-muted)]">
          Create a draft first to track versions.
        </p>
      );
    }
    return (
      <ProposalVersionHistoryPanel
        projectId={projectId}
        proposalId={proposalId}
        onRestored={onRestored}
      />
    );
  }
  if (!proposalId) {
    return (
      <p className="text-center text-sm text-[var(--enterprise-text-muted)]">
        Create a draft first to leave notes.
      </p>
    );
  }
  return (
    <ProposalCommentsPanel
      projectId={projectId}
      proposalId={proposalId}
      currentUserId={currentUserId}
    />
  );
}

type DetailSnapshot =
  | {
      reference?: string;
      title?: string;
      clientName?: string;
      clientEmail?: string;
      clientCompany?: string | null;
      status?: string;
      total?: string;
      currency?: string;
      validUntil?: string;
      sentAt?: string | null;
      acceptedAt?: string | null;
      firstViewedAt?: string | null;
    }
  | null
  | undefined;

// ---- Proposal details side panel ----
function ProposalDetailsPanel({
  detail,
  fmtMoney,
  basePath,
  proposalId,
}: {
  detail: DetailSnapshot;
  fmtMoney: (amount: string, currency: string) => string;
  basePath: string;
  proposalId: string | null;
}) {
  const p = detail;

  if (!p) {
    return (
      <div className="space-y-3 text-sm text-slate-400">
        <p>Fill in client details and create a draft to see proposal info here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {p.reference && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Reference
          </div>
          <div className="mt-0.5 font-mono text-slate-700">{p.reference}</div>
        </div>
      )}
      {p.status && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Status
          </div>
          <div className="mt-0.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {p.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      )}
      {p.total && p.currency && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total
          </div>
          <div className="mt-0.5 text-base font-semibold text-[var(--enterprise-primary)]">
            {fmtMoney(p.total, p.currency)}
          </div>
        </div>
      )}
      {p.clientName && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Client
          </div>
          <div className="mt-0.5 text-slate-700">{p.clientName}</div>
          {p.clientCompany && <div className="text-xs text-slate-500">{p.clientCompany}</div>}
          {p.clientEmail && <div className="text-xs text-slate-500">{p.clientEmail}</div>}
        </div>
      )}
      {p.validUntil && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Valid until
          </div>
          <div className="mt-0.5 text-slate-700">{new Date(p.validUntil).toLocaleDateString()}</div>
        </div>
      )}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <MilestoneRow label="Sent" at={p.sentAt ?? null} />
        <MilestoneRow label="Viewed" at={p.firstViewedAt ?? null} />
        <MilestoneRow label="Accepted" at={p.acceptedAt ?? null} />
      </div>
      {proposalId && (
        <div className="border-t border-slate-100 pt-3">
          <Link
            href={`${basePath}/${proposalId}`}
            className="text-xs font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            View full proposal →
          </Link>
        </div>
      )}
    </div>
  );
}

function MilestoneRow({ label, at }: { label: string; at: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${at ? "text-slate-700" : "text-slate-300"}`}>
        {at
          ? new Date(at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </span>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-[var(--enterprise-text-muted)]">{label}</span>
      <input
        type={type}
        className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
