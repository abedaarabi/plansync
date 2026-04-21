"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { ProposalLetterPreviewDialog } from "@/components/enterprise/ProposalLetterPreviewDialog";
import { ProposalPdfLightbox } from "@/components/enterprise/ProposalPdfLightbox";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { ProposalCoverEditor } from "@/components/enterprise/proposals/editor/ProposalCoverEditor";
import { ProposalVersionHistoryPanel } from "@/components/enterprise/proposals/editor/ProposalVersionHistoryPanel";
import { ProposalCommentsPanel } from "@/components/enterprise/proposals/editor/ProposalCommentsPanel";
import {
  createProposal,
  fetchProposalDetail,
  fetchProposalTakeoffFileVersions,
  fetchProposalTemplates,
  fetchProjects,
  fetchWorkspaceProposalRateHints,
  patchProposal,
  previewProposalHtml,
  proposalAiDraft,
  ProRequiredError,
  saveProposalDocumentVersion,
  sendProposalToClient,
  syncProposalFromTakeoff,
  type ProposalDocumentVersionRow,
  type ProposalItemRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

function fmtMoney(amount: string, currency: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "USD",
    }).format(n);
  } catch {
    return amount;
  }
}

type AttachmentPick = { fileVersionId: string; label: string; checked: boolean };
type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type RightPanel = "details" | "history" | "comments";
type ActiveSection = "cover" | "pricing" | "client";

const SECTION_LABELS: Record<ActiveSection, string> = {
  client: "Client Details",
  pricing: "Scope & Pricing",
  cover: "Cover Letter",
};

const VARS = [
  "{{client.name}}",
  "{{client.company}}",
  "{{project.name}}",
  "{{proposal.total}}",
  "{{proposal.expiry}}",
  "{{takeoff.table}}",
  "{{company.name}}",
];

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
  const isPro = isWorkspaceProClient(primary?.workspace);
  const currentUserId = me?.user.id;

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
  const [attachments, setAttachments] = useState<AttachmentPick[]>([]);
  const [selectedFvIds, setSelectedFvIds] = useState<string[]>([]);

  // ---- UI state ----
  const [activeSection, setActiveSection] = useState<ActiveSection>("client");
  const [rightPanel, setRightPanel] = useState<RightPanel>("details");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [editHydrating, setEditHydrating] = useState(Boolean(existingProposalId));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<{
    letterMarkdown: string;
    letterHtml: string | null;
    takeoffTableHtml: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [rateHintQ, setRateHintQ] = useState("");
  const [debouncedRateHintQ, setDebouncedRateHintQ] = useState("");
  const [versionSummary, setVersionSummary] = useState("");
  const [showVersionSummaryInput, setShowVersionSummaryInput] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const sendLockRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newDraftCurrencySyncedFor = useRef<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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
        setCoverHtml(d.coverNote);
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

  useEffect(() => {
    if (existingProposalId || !project?.id) return;
    if (newDraftCurrencySyncedFor.current === project.id) return;
    const c = project.currency;
    if (typeof c === "string" && c.trim().length === 3) setCurrency(c.trim().toUpperCase());
    newDraftCurrencySyncedFor.current = project.id;
  }, [existingProposalId, project?.currency, project?.id]);

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

  // ---- Close more menu on outside click ----
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreMenuOpen]);

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
        } catch {
          setSaveStatus("error");
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
  };

  if (ctxLoading || (isPro && !wid)) return <EnterpriseLoadingState label="Loading…" />;
  if (!isPro)
    return (
      <div className="enterprise-alert-warning p-6 text-sm">
        Proposals require a Pro workspace (active or trial).
      </div>
    );
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

        <SaveStatusBadge status={saveStatus} />

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Save Version */}
          {proposalId && (
            <div className="relative">
              {showVersionSummaryInput ? (
                <div className="absolute right-0 top-full z-50 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <input
                    autoFocus
                    value={versionSummary}
                    onChange={(e) => setVersionSummary(e.target.value)}
                    placeholder="Describe this version…"
                    className="rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveVersionMut.mutate();
                      if (e.key === "Escape") setShowVersionSummaryInput(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveVersionMut.mutate()}
                      disabled={saveVersionMut.isPending}
                      className="flex-1 rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {saveVersionMut.isPending ? "Saving…" : "Save version"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVersionSummaryInput(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setShowVersionSummaryInput((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                title="Save a named version snapshot"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Save version</span>
              </button>
            </div>
          )}

          {/* Preview */}
          <button
            type="button"
            disabled={previewLoading || !proposalId}
            onClick={async () => {
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
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {previewLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Send */}
          {proposalId && canSendToClient ? (
            <button
              type="button"
              disabled={sendMut.isPending || !hasItems}
              aria-busy={sendMut.isPending}
              title={!hasItems ? "Add line items in Scope & Pricing before sending" : undefined}
              onClick={() => {
                if (!hasItems) {
                  setActiveSection("pricing");
                  toast.error("Add line items in Scope & Pricing before sending.");
                  return;
                }
                if (sendLockRef.current || sendMut.isPending) return;
                sendLockRef.current = true;
                sendMut.mutate(undefined, {
                  onSettled: () => {
                    sendLockRef.current = false;
                  },
                });
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] aria-busy:cursor-wait disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">{sendMut.isPending ? "Sending…" : "Send"}</span>
            </button>
          ) : proposalId ? (
            <Link
              href={`${basePath}/${proposalId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">View</span>
            </Link>
          ) : null}

          {/* Right panel toggle */}
          <button
            type="button"
            onClick={() => setRightPanelOpen((v) => !v)}
            title={rightPanelOpen ? "Hide side panel" : "Show side panel"}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${
              rightPanelOpen
                ? "border-[var(--enterprise-primary)]/30 bg-blue-50 text-[var(--enterprise-primary)]"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Section nav tabs ─── */}
      <div className="flex shrink-0 gap-1 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 sm:px-4">
        {(["client", "pricing", "cover"] as ActiveSection[]).map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => setActiveSection(sec)}
            className={`relative pb-2 pt-2.5 text-xs font-medium transition-colors ${
              activeSection === sec
                ? "text-[var(--enterprise-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--enterprise-primary)] after:content-['']"
                : "text-slate-500 hover:text-slate-700"
            } px-2`}
          >
            {SECTION_LABELS[sec]}
          </button>
        ))}
      </div>

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
                    <button
                      type="button"
                      disabled={createOrSaveMut.isPending || !title || !clientName || !clientEmail}
                      onClick={() => createOrSaveMut.mutate()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
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
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Pricing section */}
            {activeSection === "pricing" && (
              <section aria-label="Scope and pricing">
                <div className="space-y-5">
                  {!proposalId ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900">
                      Complete client details first to enable pricing.
                      <button
                        type="button"
                        onClick={() => setActiveSection("client")}
                        className="mt-2 block font-semibold text-amber-800 underline"
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

                      {/* Line items table */}
                      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
                        <div className="overflow-x-auto">
                          {detailLoading ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                            </div>
                          ) : (
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
                                          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-40"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}

                                {/* New item input row */}
                                {addingItem && (
                                  <tr className="border-t border-[var(--enterprise-primary)]/20 bg-blue-50/30">
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
                                        className="w-full min-w-[140px] rounded border border-[var(--enterprise-border)] bg-white px-2 py-1 text-sm font-medium focus:border-[var(--enterprise-primary)] focus:outline-none"
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
                                        className="w-20 rounded border border-[var(--enterprise-border)] bg-white px-2 py-1 text-right text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                        placeholder="1"
                                        onKeyDown={(e) => e.key === "Enter" && commitNewItem()}
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        value={newItemDraft.unit}
                                        onChange={(e) =>
                                          setNewItemDraft((p) => ({ ...p, unit: e.target.value }))
                                        }
                                        className="w-16 rounded border border-[var(--enterprise-border)] bg-white px-2 py-1 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                        placeholder="ea"
                                        onKeyDown={(e) => e.key === "Enter" && commitNewItem()}
                                      />
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <input
                                        value={newItemDraft.rate}
                                        onChange={(e) =>
                                          setNewItemDraft((p) => ({ ...p, rate: e.target.value }))
                                        }
                                        className="w-28 rounded border border-[var(--enterprise-border)] bg-white px-2 py-1 text-right text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                                        placeholder="0.00"
                                        onKeyDown={(e) => e.key === "Enter" && commitNewItem()}
                                      />
                                    </td>
                                    <td className="px-4 py-2 text-right text-xs tabular-nums text-slate-400">
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
                                        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {/* Add item button */}
                        {!detailLoading && (
                          <div className="border-t border-[var(--enterprise-border)]/40 px-4 py-2">
                            {!addingItem ? (
                              <button
                                type="button"
                                onClick={() => setAddingItem(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--enterprise-primary)] transition hover:bg-blue-50"
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                                Add item manually
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={commitNewItem}
                                disabled={!newItemDraft.itemName.trim() || saveItemsMut.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                {saveItemsMut.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                )}
                                Add item
                              </button>
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

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setActiveSection("cover")}
                          className="inline-flex items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                        >
                          Cover letter →
                        </button>
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
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900">
                      Create a draft first.
                      <button
                        type="button"
                        onClick={() => setActiveSection("client")}
                        className="mt-2 block font-semibold text-amber-800 underline"
                      >
                        Go to client details →
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Template selector */}
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)]">
                        <label className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-[var(--enterprise-text)]">
                            Template
                          </span>
                          <select
                            className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-1.5 text-sm focus:border-[var(--enterprise-primary)] focus:outline-none"
                            value={templateId}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTemplateId(v);
                              if (v) applyTemplateDefaults(v);
                              patchProposal(projectId, proposalId!, { templateId: v || null }).then(
                                (p) => qc.setQueryData(qk.projectProposal(projectId, p.id), p),
                              );
                            }}
                          >
                            <option value="">No template</option>
                            {(tmplData?.templates ?? []).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        {/* Variable chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {VARS.map((v) => (
                            <span
                              key={v}
                              className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-100"
                              title={`Click to insert ${v}`}
                              onClick={() => {
                                setCoverHtml((prev) => prev + v);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  setCoverHtml((prev) => prev + v);
                              }}
                            >
                              {v}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={aiLoading}
                          onClick={async () => {
                            setAiLoading(true);
                            try {
                              const { text } = await proposalAiDraft(projectId, proposalId!, {});
                              setCoverHtml(text);
                              await patchProposal(projectId, proposalId!, { coverNote: text });
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
                          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                        >
                          {aiLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {aiLoading ? "Working…" : "AI draft"}
                        </button>
                      </div>

                      {/* TipTap document canvas */}
                      <div className="overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-white shadow-[var(--enterprise-shadow-xs)]">
                        {/* Business-letter header */}
                        <div className="border-b border-slate-100 bg-white px-8 pt-8 pb-5">
                          {/* From / date row */}
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex flex-col gap-0.5">
                              {d?.workspaceName && (
                                <p className="text-sm font-semibold text-slate-900">
                                  {d.workspaceName}
                                </p>
                              )}
                              {d?.createdBy?.name && (
                                <p className="text-xs text-slate-500">{d.createdBy.name}</p>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date().toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>

                          {/* To block */}
                          <div className="mt-5 flex flex-col gap-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              To
                            </p>
                            {clientName ? (
                              <p className="text-sm font-semibold text-slate-900">{clientName}</p>
                            ) : (
                              <p className="text-sm italic text-slate-400">Client name</p>
                            )}
                            {clientCompany && (
                              <p className="text-xs text-slate-500">{clientCompany}</p>
                            )}
                          </div>

                          {/* Subject */}
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              Re:{" "}
                            </span>
                            {title ? (
                              <span className="text-sm font-semibold text-slate-800">{title}</span>
                            ) : (
                              <span className="text-sm italic text-slate-400">Proposal title</span>
                            )}
                            {d?.reference && (
                              <span className="ml-2 text-xs text-slate-400">({d.reference})</span>
                            )}
                          </div>
                        </div>

                        <ProposalCoverEditor
                          content={coverHtml || (d?.coverNote ?? "")}
                          onChange={(html, json) => {
                            setCoverHtml(html);
                            setCoverJson(json);
                            scheduleAutosaveCover(html);
                          }}
                          placeholder="Write your cover letter here…"
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
                        <button
                          type="button"
                          onClick={() => setActiveSection("pricing")}
                          className="text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                          ← Pricing
                        </button>
                        {canSendToClient ? (
                          <div className="flex flex-col items-end gap-2">
                            {!hasItems && (
                              <p className="text-xs font-medium text-amber-600">
                                Go to{" "}
                                <button
                                  type="button"
                                  onClick={() => setActiveSection("pricing")}
                                  className="underline underline-offset-2 hover:text-amber-700"
                                >
                                  Scope &amp; Pricing
                                </button>{" "}
                                and load line items before sending.
                              </p>
                            )}
                            <button
                              type="button"
                              disabled={sendMut.isPending || !hasItems}
                              aria-busy={sendMut.isPending}
                              title={!hasItems ? "Add line items before sending" : undefined}
                              onClick={() => {
                                if (!hasItems) {
                                  setActiveSection("pricing");
                                  return;
                                }
                                if (sendLockRef.current || sendMut.isPending) return;
                                sendLockRef.current = true;
                                sendMut.mutate(undefined, {
                                  onSettled: () => {
                                    sendLockRef.current = false;
                                  },
                                });
                              }}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm aria-busy:cursor-wait disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {sendMut.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Send className="h-4 w-4" aria-hidden />
                              )}
                              {sendMut.isPending ? "Sending…" : "Send to client"}
                            </button>
                          </div>
                        ) : (
                          <p className="max-w-xs text-right text-xs text-slate-500">
                            Already sent. Edits auto-update the portal.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ─── Right panel ─── */}
        {rightPanelOpen && (
          <aside className="hidden w-72 shrink-0 flex-col overflow-hidden border-l border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] xl:flex">
            {/* Panel tabs */}
            <div className="flex shrink-0 border-b border-[var(--enterprise-border)]">
              {(["details", "history", "comments"] as RightPanel[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRightPanel(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize transition ${
                    rightPanel === tab
                      ? "border-b-2 border-[var(--enterprise-primary)] text-[var(--enterprise-primary)]"
                      : "text-slate-500 hover:text-slate-700"
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

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-4">
              {rightPanel === "details" && (
                <ProposalDetailsPanel
                  detail={d}
                  fmtMoney={fmtMoney}
                  basePath={basePath}
                  proposalId={proposalId}
                />
              )}
              {rightPanel === "history" && proposalId && (
                <ProposalVersionHistoryPanel
                  projectId={projectId}
                  proposalId={proposalId}
                  onRestored={(v) => {
                    setCoverHtml(v.contentHtml);
                    setCoverJson(v.contentJson);
                  }}
                />
              )}
              {rightPanel === "history" && !proposalId && (
                <p className="text-center text-sm text-slate-400">
                  Create a draft first to track versions.
                </p>
              )}
              {rightPanel === "comments" && proposalId && (
                <ProposalCommentsPanel
                  projectId={projectId}
                  proposalId={proposalId}
                  currentUserId={currentUserId}
                />
              )}
              {rightPanel === "comments" && !proposalId && (
                <p className="text-center text-sm text-slate-400">
                  Create a draft first to leave notes.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Dialogs */}
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

// ---- Save status badge ----
function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  if (status === "unsaved") return <span className="text-xs text-amber-500">Unsaved</span>;
  if (status === "error") return <span className="text-xs text-red-500">Save failed</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Saved</span>
    </span>
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
