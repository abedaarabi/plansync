"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { ProposalLetterPreviewBlock } from "@/components/enterprise/ProposalLetterPreviewBlock";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
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
  sendProposalToClient,
  syncProposalFromTakeoff,
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

export function ProposalNewWizard({
  projectId,
  workspaceId: wsFromPath,
  existingProposalId,
}: {
  projectId: string;
  workspaceId?: string;
  /** When set, load this proposal for editing (draft, change-requested, sent, or viewed). */
  existingProposalId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace.subscriptionStatus);

  const [step, setStep] = useState(1);
  const [proposalId, setProposalId] = useState<string | null>(null);

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

  const [selectedFvIds, setSelectedFvIds] = useState<string[]>([]);
  const [taxPercent, setTaxPercent] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [templateId, setTemplateId] = useState<string>("");
  const [coverNote, setCoverNote] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<{
    letterMarkdown: string;
    letterHtml: string | null;
    takeoffTableHtml: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [rateHintQ, setRateHintQ] = useState("");
  const [debouncedRateHintQ, setDebouncedRateHintQ] = useState("");
  const [editHydrating, setEditHydrating] = useState(Boolean(existingProposalId));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRateHintQ(rateHintQ.trim()), 400);
    return () => clearTimeout(t);
  }, [rateHintQ]);

  const [attachments, setAttachments] = useState<AttachmentPick[]>([]);

  const basePath = wsFromPath
    ? `/workspaces/${wsFromPath}/projects/${projectId}/proposals`
    : `/projects/${projectId}/proposals`;

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });
  const project = projects.find((p) => p.id === projectId);

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
        setDiscount(d.discount);
        setTemplateId(d.templateId ?? "");
        setCoverNote(d.coverNote);
        setSelectedFvIds(
          d.sourceFileVersionIds?.length
            ? d.sourceFileVersionIds
            : d.sourceFileVersionId
              ? [d.sourceFileVersionId]
              : [],
        );
        const sel = new Set(d.attachments.map((a) => a.fileVersionId));
        const picks: AttachmentPick[] = [];
        for (const f of project.files) {
          for (const v of f.versions) {
            picks.push({
              fileVersionId: v.id,
              label: `${f.name} · v${v.version}`,
              checked: sel.has(v.id),
            });
          }
        }
        setAttachments(picks);
        qc.setQueryData(qk.projectProposal(projectId, d.id), d);
        setStep(1);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load proposal."))
      .finally(() => {
        if (!cancelled) setEditHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [existingProposalId, projectId, wid, isPro, project, qc]);

  const { data: fvData } = useQuery({
    queryKey: qk.proposalTakeoffVersions(projectId),
    queryFn: () => fetchProposalTakeoffFileVersions(projectId),
    enabled: Boolean(wid && isPro && step >= 2),
  });

  const { data: detail, isPending: detailLoading } = useQuery({
    queryKey: qk.projectProposal(projectId, proposalId ?? ""),
    queryFn: () => fetchProposalDetail(projectId, proposalId!),
    enabled: Boolean(wid && isPro && proposalId && step >= 2),
  });

  const { data: tmplData } = useQuery({
    queryKey: qk.proposalTemplates(wid ?? ""),
    queryFn: () => fetchProposalTemplates(wid!),
    enabled: Boolean(wid && isPro && proposalId),
  });

  const { data: rateHints } = useQuery({
    queryKey: qk.proposalRateHints(wid ?? "", debouncedRateHintQ),
    queryFn: () => fetchWorkspaceProposalRateHints(wid!, debouncedRateHintQ),
    enabled: Boolean(wid && isPro && step === 2 && debouncedRateHintQ.length >= 2),
  });

  useEffect(() => {
    if (!project) return;
    setAttachments((prev) => {
      if (prev.length > 0) return prev;
      const picks: AttachmentPick[] = [];
      for (const f of project.files) {
        for (const v of f.versions) {
          picks.push({
            fileVersionId: v.id,
            label: `${f.name} · v${v.version}`,
            checked: false,
          });
        }
      }
      return picks;
    });
  }, [project]);

  const step1ContinueMut = useMutation({
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
      qc.invalidateQueries({ queryKey: qk.projectProposalAnalytics(projectId) });
      setStep(2);
      toast.success(proposalId != null ? "Saved" : "Draft created");
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

  const saveItemsMut = useMutation({
    mutationFn: async (items: ProposalItemRow[]) => {
      return patchProposal(projectId, proposalId!, {
        items: items.map((it, i) => ({
          itemName: it.itemName,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          sortOrder: i,
          sourceTakeoffLineId: it.sourceTakeoffLineId,
        })),
        taxPercent,
        discount,
        attachmentFileVersionIds: attachments.filter((a) => a.checked).map((a) => a.fileVersionId),
      });
    },
    onSuccess: (p) => {
      qc.setQueryData(qk.projectProposal(projectId, p.id), p);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyTemplateDefaults = (tid: string) => {
    const t = tmplData?.templates.find((x) => x.id === tid);
    const d = t?.defaultsJson as { taxPercent?: number; validUntilDays?: number } | null;
    if (d?.taxPercent != null) setTaxPercent(String(d.taxPercent));
    if (d?.validUntilDays != null && proposalId) {
      const end = new Date();
      end.setDate(end.getDate() + d.validUntilDays);
      patchProposal(projectId, proposalId, {
        validUntil: end.toISOString(),
      }).then((p) => {
        qc.setQueryData(qk.projectProposal(projectId, p.id), p);
      });
    }
  };

  if (ctxLoading || (isPro && !wid)) {
    return <EnterpriseLoadingState label="Loading…" />;
  }
  if (!isPro) {
    return (
      <div className="text-amber-800">Proposals require a Pro workspace (active or trial).</div>
    );
  }
  if (editHydrating) {
    return <EnterpriseLoadingState label="Loading proposal…" />;
  }

  const d = detail;
  const canSendToClient = d && (d.status === "DRAFT" || d.status === "CHANGE_REQUESTED");

  const updateLine = (id: string, field: "rate" | "quantity", value: string) => {
    if (!d) return;
    const items = d.items.map((it) =>
      it.id === id ? { ...it, [field]: value } : it,
    ) as ProposalItemRow[];
    const recalc = items.map((it) => {
      const q = Number(it.quantity);
      const r = Number(it.rate);
      const lt = Number.isFinite(q) && Number.isFinite(r) ? (q * r).toFixed(2) : it.lineTotal;
      return { ...it, lineTotal: lt };
    });
    saveItemsMut.mutate(recalc);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={basePath} className="text-sm font-medium text-[#2563EB] hover:underline">
          ← Proposals
        </Link>
        <div className="text-sm text-slate-500">Step {step} of 3</div>
      </div>

      {step === 1 && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-[#0F172A]">
            {existingProposalId ? "Edit client & proposal" : "Client & proposal details"}
          </h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Client name" value={clientName} onChange={setClientName} />
            <Field label="Company" value={clientCompany} onChange={setClientCompany} />
            <Field label="Email" value={clientEmail} onChange={setClientEmail} type="email" />
            <Field label="Phone" value={clientPhone} onChange={setClientPhone} />
            <Field
              label="Proposal title"
              value={title}
              onChange={setTitle}
              className="sm:col-span-2"
            />
            <Field label="Currency" value={currency} onChange={setCurrency} />
            <Field label="Valid until" value={validUntil} onChange={setValidUntil} type="date" />
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={step1ContinueMut.isPending || !title || !clientName || !clientEmail}
              onClick={() => step1ContinueMut.mutate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {step1ContinueMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Next →"
              )}
            </button>
          </div>
        </div>
      )}

      {step === 2 && d && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F172A]">Takeoff & pricing</h2>
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-sm font-medium text-slate-800">Takeoff revisions</div>
                <p className="mt-1 text-xs text-slate-500">
                  Select one or more sheet revisions. Lines are merged in the order shown below
                  (same order as this list).
                </p>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {(fvData?.fileVersions ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No sheet revisions in this project yet.
                    </p>
                  ) : (
                    (fvData?.fileVersions ?? []).map((v) => (
                      <label key={v.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedFvIds.includes(v.id)}
                          onChange={(e) => {
                            setSelectedFvIds((prev) =>
                              e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id),
                            );
                          }}
                        />
                        <span>{v.label}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={selectedFvIds.length === 0 || syncMut.isPending}
                onClick={() => {
                  const ordered = (fvData?.fileVersions ?? [])
                    .map((v) => v.id)
                    .filter((id) => selectedFvIds.includes(id));
                  if (ordered.length === 0) return;
                  syncMut.mutate(ordered);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60"
              >
                {syncMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Load from takeoff"
                )}
              </button>
            </div>

            {detailLoading ? (
              <EnterpriseLoadingState label="Loading lines…" />
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                          Select one or more takeoff revisions and click &quot;Load from
                          takeoff&quot;.
                        </td>
                      </tr>
                    ) : (
                      d.items.map((it) => (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{it.itemName}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              className="w-24 rounded border border-slate-200 px-2 py-1 text-right"
                              value={it.quantity}
                              onChange={(e) => updateLine(it.id, "quantity", e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">{it.unit}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              className="w-28 rounded border border-slate-200 px-2 py-1 text-right"
                              value={it.rate}
                              onChange={(e) => updateLine(it.id, "rate", e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {fmtMoney(it.lineTotal, d.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Historical rate hints
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Averages from past accepted proposals in your workspace (privacy-safe aggregates).
              </p>
              <input
                className="mt-2 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search line item name (2+ letters)…"
                value={rateHintQ}
                onChange={(e) => setRateHintQ(e.target.value)}
              />
              {(rateHints?.hints?.length ?? 0) > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {rateHints!.hints.map((h) => (
                    <li key={h.itemName} className="flex flex-wrap justify-between gap-2">
                      <span className="min-w-0 flex-1">{h.itemName}</span>
                      <span className="tabular-nums text-slate-600">
                        avg {fmtMoney(String(h.avgRate), h.currency)} ({h.sampleSize}×)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span>Tax %</span>
                <input
                  className="w-24 rounded border border-slate-200 px-2 py-1"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  onBlur={() => {
                    if (proposalId)
                      patchProposal(projectId, proposalId, { taxPercent, discount }).then((p) => {
                        qc.setQueryData(qk.projectProposal(projectId, p.id), p);
                      });
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Discount</span>
                <input
                  className="w-28 rounded border border-slate-200 px-2 py-1"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  onBlur={() => {
                    if (proposalId)
                      patchProposal(projectId, proposalId, { taxPercent, discount }).then((p) => {
                        qc.setQueryData(qk.projectProposal(projectId, p.id), p);
                      });
                  }}
                />
              </label>
            </div>
            <div className="mt-2 text-right text-sm font-semibold">
              Total: {fmtMoney(d.total, d.currency)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-[#0F172A]">Attach drawings</h3>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {attachments.map((a) => (
                <label key={a.fileVersionId} className="flex items-center gap-2">
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
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              className="text-sm font-medium text-slate-600"
              onClick={() => setStep(1)}
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!d.items.length || saveItemsMut.isPending}
              onClick={() => {
                saveItemsMut.mutate(d.items, {
                  onSuccess: () => {
                    if (tmplData?.templates[0] && !templateId) {
                      setTemplateId(tmplData.templates[0].id);
                    }
                    setStep(3);
                  },
                });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saveItemsMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Next →"
              )}
            </button>
          </div>
        </div>
      )}

      {step === 3 && d && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F172A]">Template & letter</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={templateId}
                onChange={(e) => {
                  const v = e.target.value;
                  setTemplateId(v);
                  if (v) applyTemplateDefaults(v);
                  patchProposal(projectId, proposalId!, { templateId: v || null }).then((p) => {
                    qc.setQueryData(qk.projectProposal(projectId, p.id), p);
                  });
                }}
              >
                <option value="">No template</option>
                {(tmplData?.templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Link
                href={`${basePath}/templates`}
                className="self-center text-sm font-medium text-[#2563EB] hover:underline"
              >
                + Manage templates
              </Link>
            </div>
            <label className="mt-4 block text-sm">
              <span className="text-slate-600">Cover letter (Markdown or HTML)</span>
              <textarea
                className="mt-1 min-h-[200px] w-full rounded-lg border border-slate-200 p-3 font-mono text-sm"
                value={coverNote || d.coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                onBlur={() => {
                  const html = coverNote || d.coverNote;
                  patchProposal(projectId, proposalId!, { coverNote: html }).then((p) => {
                    qc.setQueryData(qk.projectProposal(projectId, p.id), p);
                  });
                }}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aiLoading || previewLoading || sendMut.isPending}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const { text } = await proposalAiDraft(projectId, proposalId!, {});
                    setCoverNote(text);
                    await patchProposal(projectId, proposalId!, { coverNote: text });
                    qc.invalidateQueries({ queryKey: qk.projectProposal(projectId, proposalId!) });
                    toast.success("AI draft ready — review and edit before sending.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "AI failed");
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Working…
                  </>
                ) : (
                  "Improve with AI"
                )}
              </button>
              <button
                type="button"
                disabled={previewLoading || aiLoading || sendMut.isPending}
                onClick={async () => {
                  setPreviewLoading(true);
                  try {
                    const prev = await previewProposalHtml(projectId, proposalId!);
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
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Preview"
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="text-sm text-slate-600" onClick={() => setStep(2)}>
              ← Back
            </button>
            {canSendToClient ? (
              <button
                type="button"
                disabled={sendMut.isPending || previewLoading || aiLoading}
                onClick={() => sendMut.mutate()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sendMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  "Send to client →"
                )}
              </button>
            ) : (
              <div className="flex flex-col items-end gap-2 text-right">
                <p className="max-w-sm text-xs text-slate-600">
                  This proposal is already live with your client. Edits here update the portal
                  immediately. Use <span className="font-medium">Resend</span> on the detail page if
                  you want another email.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`${basePath}/${proposalId}`)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
                >
                  Back to proposal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {previewOpen && previewPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex justify-between gap-2">
              <h3 className="font-semibold">Preview</h3>
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewPayload(null);
                }}
                className="text-slate-500"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Markdown letter when not HTML; takeoff table below.
            </p>
            <div className="mt-4">
              <ProposalLetterPreviewBlock
                letterMarkdown={previewPayload.letterMarkdown}
                letterHtml={previewPayload.letterHtml}
                takeoffTableHtml={previewPayload.takeoffTableHtml}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
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
      <span className="text-slate-600">{label}</span>
      <input
        type={type}
        className="rounded-lg border border-slate-200 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
