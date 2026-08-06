"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeleteProposalConfirmDialog } from "@/components/enterprise/DeleteProposalConfirmDialog";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { ProposalLetterPreviewDialog } from "@/components/enterprise/ProposalLetterPreviewDialog";
import { ProposalPdfLightbox } from "@/components/enterprise/ProposalPdfLightbox";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  deleteProposal,
  duplicateProposal,
  downloadProposalCsvExport,
  fetchProposalPdfBlob,
  fetchProposalDetail,
  fetchProposalPortalMessages,
  fetchProposalRevisions,
  postProposalExternalSignExport,
  postProposalPortalMessageStaff,
  previewProposalHtml,
  resendProposal,
} from "@/lib/api-client";
import { proposalStatusBadgeClass, proposalStatusLabel } from "@/lib/proposalStatus";
import { qk } from "@/lib/queryKeys";
import { PlanUpgradeCallout } from "@/components/enterprise/PlanUpgradeCallout";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";

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

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// fallow-ignore-next-line complexity
export function ProposalDetailClient({
  projectId,
  proposalId,
  workspaceId: wsFromPath,
}: {
  projectId: string;
  proposalId: string;
  workspaceId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProPlusClient(primary?.workspace);

  const base = wsFromPath
    ? `/workspaces/${wsFromPath}/projects/${projectId}/proposals`
    : `/projects/${projectId}/proposals`;

  const {
    data: p,
    isPending,
    isError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: qk.projectProposal(projectId, proposalId),
    queryFn: () => fetchProposalDetail(projectId, proposalId),
    enabled: Boolean(wid && isPro),
  });

  const { data: revData } = useQuery({
    queryKey: qk.projectProposalRevisions(projectId, proposalId),
    queryFn: () => fetchProposalRevisions(projectId, proposalId),
    enabled: Boolean(wid && isPro),
  });

  const { data: portalMsgData, isPending: portalMsgLoading } = useQuery({
    queryKey: qk.projectProposalPortalMessages(projectId, proposalId),
    queryFn: () => fetchProposalPortalMessages(projectId, proposalId),
    enabled: Boolean(wid && isPro && p?.publicToken),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const clientMsgBaselineRef = useRef<number | null>(null);

  useEffect(() => {
    clientMsgBaselineRef.current = null;
  }, [projectId, proposalId]);

  useEffect(() => {
    if (!portalMsgData?.messages) return;
    const clientCount = portalMsgData.messages.filter((m) => m.isFromClient).length;
    if (clientMsgBaselineRef.current === null) {
      clientMsgBaselineRef.current = clientCount;
      return;
    }
    if (clientCount > clientMsgBaselineRef.current) {
      const clientName = p?.clientName?.trim() || "Your client";
      toast.info(`${clientName} sent a new message`, {
        description: "See it in Client portal messages below.",
        action: {
          label: "View",
          onClick: () => {
            document.getElementById("proposal-portal-messages")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          },
        },
      });
      void qc.invalidateQueries({ queryKey: qk.meNotifications() });
    }
    clientMsgBaselineRef.current = clientCount;
  }, [portalMsgData, p?.clientName, qc]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<{
    letterMarkdown: string;
    letterHtml: string | null;
    takeoffTableHtml: string;
  } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [esignLoading, setEsignLoading] = useState(false);
  const [portalReply, setPortalReply] = useState("");
  const portalReplyLockRef = useRef(false);
  const resendLockRef = useRef(false);

  const portalPostMut = useMutation({
    mutationFn: (text: string) => postProposalPortalMessageStaff(projectId, proposalId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectProposalPortalMessages(projectId, proposalId) });
      setPortalReply("");
      toast.success("Reply sent — the client will see it on their proposal page.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendMut = useMutation({
    mutationFn: () => resendProposal(projectId, proposalId),
    onSuccess: () => toast.success("Resent"),
    onError: (e: Error) => toast.error(e.message ?? "Resend failed."),
  });

  const dupMut = useMutation({
    mutationFn: () => duplicateProposal(projectId, proposalId),
    onSuccess: (np) => {
      qc.invalidateQueries({ queryKey: qk.projectProposals(projectId) });
      qc.invalidateQueries({ queryKey: qk.projectProposalAnalytics(projectId) });
      toast.success("Duplicate created");
      router.push(`${base}/${np.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: () => deleteProposal(projectId, proposalId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.projectProposal(projectId, proposalId) });
      qc.removeQueries({ queryKey: qk.projectProposalPortalMessages(projectId, proposalId) });
      qc.invalidateQueries({ queryKey: qk.projectProposals(projectId) });
      qc.invalidateQueries({ queryKey: qk.projectProposalAnalytics(projectId) });
      qc.invalidateQueries({ queryKey: qk.projectProposalRevisions(projectId, proposalId) });
      toast.success("Proposal deleted");
      setDeleteOpen(false);
      router.push(base);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ctxLoading || (isPro && !wid)) return <EnterpriseLoadingState label="Loading…" />;
  if (!isPro) return <PlanUpgradeCallout feature="Proposals" />;
  if (isPending) return <EnterpriseLoadingState label="Loading proposal…" />;
  if (isError || !p) {
    return (
      <div className="enterprise-alert-danger mx-auto max-w-lg space-y-4 p-6">
        <p className="font-medium text-[var(--enterprise-semantic-danger-text)]">
          Could not load this proposal.
        </p>
        <p className="text-sm text-[var(--enterprise-semantic-danger-text)]/90">
          {loadError instanceof Error
            ? loadError.message
            : "Check that the API is running and you are signed in."}
        </p>
        <EnterpriseButton size="sm" variant="danger" onClick={() => void refetch()}>
          Try again
        </EnterpriseButton>
        <Link
          href={base}
          className="block text-sm font-medium text-[var(--enterprise-primary)] underline"
        >
          ← Back to proposals
        </Link>
      </div>
    );
  }

  const editable =
    p.status === "DRAFT" ||
    p.status === "CHANGE_REQUESTED" ||
    p.status === "SENT" ||
    p.status === "VIEWED";

  const actionsBusy =
    reviewLoading || pdfLoading || csvLoading || esignLoading || resendMut.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <DeleteProposalConfirmDialog
        open={deleteOpen}
        reference={p.reference}
        title={p.title}
        isDeleting={delMut.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => delMut.mutate()}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={base}
          className="text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
        >
          ← Proposals
        </Link>
        {editable ? (
          <EnterpriseButton
            size="sm"
            onClick={() => {
              router.push(`${base}/${proposalId}/edit`);
            }}
          >
            Edit proposal
          </EnterpriseButton>
        ) : null}
      </div>

      <div className="enterprise-card p-4 sm:p-5">
        {p.workspaceLogoUrl ? (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.workspaceLogoUrl}
              alt=""
              className="max-h-12 max-w-[180px] object-contain"
            />
          </div>
        ) : null}
        <div className="text-sm font-medium text-[var(--enterprise-text-muted)]">{p.reference}</div>
        <h1 className="mt-1 text-xl font-semibold text-[var(--enterprise-text)] sm:text-2xl">
          {p.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={proposalStatusBadgeClass(p.status)}>
            {proposalStatusLabel(p.status)}
          </span>
          <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
            {fmtMoney(p.total, p.currency)}
          </span>
          {p.validUntil ? (
            <span className="text-[var(--enterprise-text-muted)]">
              Valid until{" "}
              {new Date(p.validUntil).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>

        <div className="mt-6">
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Lifecycle</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Milestone label="Sent" at={p.sentAt} />
            <Milestone label="Viewed" at={p.firstViewedAt} />
            <Milestone label="Accepted" at={p.acceptedAt} />
          </div>
        </div>

        {p.changeRequestComment ? (
          <div className="mt-6 rounded-xl border border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] p-4 text-[var(--enterprise-semantic-warning-text)]">
            <div className="text-xs font-semibold uppercase tracking-wide">
              Client requested changes
            </div>
            {p.changeRequestedAt ? (
              <div className="mt-1 text-xs opacity-80">
                {new Date(p.changeRequestedAt).toLocaleString()}
              </div>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm">{p.changeRequestComment}</p>
            <p className="mt-3 text-xs opacity-80">
              Update the proposal in the editor, then re-send the email from this page when you are
              ready. Ongoing chat with the client is in{" "}
              <span className="font-medium">Client portal messages</span> below.
            </p>
          </div>
        ) : null}

        {p.publicToken ? (
          <div
            id="proposal-portal-messages"
            className="mt-6 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 p-4"
          >
            <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
              Client portal messages
            </h2>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Same thread as on the client&apos;s proposal link. When they write in
              &quot;Messages&quot; there, it appears here.
            </p>
            {portalMsgLoading ? (
              <p className="mt-3 text-sm text-[var(--enterprise-text-muted)]">Loading messages…</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {(portalMsgData?.messages ?? []).length === 0 ? (
                  <li className="text-[var(--enterprise-text-muted)]">No messages yet.</li>
                ) : (
                  (portalMsgData?.messages ?? []).map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-lg border px-3 py-2 ${
                        m.isFromClient
                          ? "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
                          : "border-[color-mix(in_srgb,var(--enterprise-primary)_20%,var(--enterprise-border))] bg-[var(--enterprise-primary-soft)]"
                      }`}
                    >
                      <div className="text-xs text-[var(--enterprise-text-muted)]">
                        {m.isFromClient ? p.clientName : "Your team"} ·{" "}
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-[var(--enterprise-text)]">
                        {m.body}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
            {p.status === "SENT" || p.status === "VIEWED" || p.status === "CHANGE_REQUESTED" ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <textarea
                  className="min-h-[72px] flex-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] disabled:cursor-wait disabled:opacity-70"
                  placeholder={
                    portalPostMut.isPending
                      ? "Sending…"
                      : "Reply to the client (visible on their proposal page)…"
                  }
                  value={portalReply}
                  readOnly={portalPostMut.isPending}
                  aria-busy={portalPostMut.isPending}
                  onChange={(e) => setPortalReply(e.target.value)}
                />
                <EnterpriseButton
                  size="sm"
                  disabled={!portalReply.trim() || portalPostMut.isPending}
                  loading={portalPostMut.isPending}
                  className="shrink-0"
                  onClick={() => {
                    const text = portalReply.trim();
                    if (!text || portalPostMut.isPending || portalReplyLockRef.current) return;
                    portalReplyLockRef.current = true;
                    portalPostMut.mutate(text, {
                      onSettled: () => {
                        portalReplyLockRef.current = false;
                      },
                    });
                  }}
                >
                  {portalPostMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    "Send reply"
                  )}
                </EnterpriseButton>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--enterprise-border)] pt-6">
          {p.publicToken && (
            <EnterpriseButton
              size="sm"
              variant="secondary"
              onClick={() => {
                const url = `${window.location.origin}/proposal/${p.publicToken}`;
                void navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success("Portal link copied"));
              }}
              title="Copy client portal link"
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Copy link
            </EnterpriseButton>
          )}
          <EnterpriseButton
            size="sm"
            variant="secondary"
            disabled={actionsBusy}
            loading={reviewLoading}
            onClick={async () => {
              setReviewLoading(true);
              try {
                const prev = await previewProposalHtml(projectId, proposalId);
                setReviewPreview({
                  letterMarkdown: prev.letterMarkdown,
                  letterHtml: prev.letterHtml,
                  takeoffTableHtml: prev.takeoffTableHtml,
                });
                setReviewOpen(true);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not load preview.");
              } finally {
                setReviewLoading(false);
              }
            }}
          >
            {reviewLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              "Preview"
            )}
          </EnterpriseButton>
          <EnterpriseButton
            size="sm"
            variant="secondary"
            disabled={actionsBusy}
            loading={pdfLoading}
            onClick={async () => {
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
            }}
          >
            {pdfLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Opening…
              </>
            ) : (
              "Review PDF"
            )}
          </EnterpriseButton>
          <EnterpriseButton
            size="sm"
            disabled={actionsBusy}
            loading={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              try {
                const blob = await fetchProposalPdfBlob(projectId, proposalId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${p.reference}-proposal.pdf`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Download failed.");
              } finally {
                setPdfLoading(false);
              }
            }}
          >
            {pdfLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              "Download PDF"
            )}
          </EnterpriseButton>
          {p.status === "ACCEPTED" && (
            <EnterpriseButton
              size="sm"
              variant="secondary"
              disabled={actionsBusy}
              loading={csvLoading}
              onClick={async () => {
                setCsvLoading(true);
                try {
                  await downloadProposalCsvExport(projectId, proposalId);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Export failed.");
                } finally {
                  setCsvLoading(false);
                }
              }}
            >
              {csvLoading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Exporting…
                </>
              ) : (
                "Export CSV"
              )}
            </EnterpriseButton>
          )}
          <EnterpriseButton
            size="sm"
            variant="secondary"
            disabled={actionsBusy}
            loading={esignLoading}
            onClick={async () => {
              setEsignLoading(true);
              try {
                const out = await postProposalExternalSignExport(projectId, proposalId);
                toast.message(out.message ?? "E-sign export");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Request failed.");
              } finally {
                setEsignLoading(false);
              }
            }}
          >
            {esignLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              "E-sign handoff"
            )}
          </EnterpriseButton>
          {(p.status === "SENT" || p.status === "VIEWED" || p.status === "CHANGE_REQUESTED") && (
            <EnterpriseButton
              size="sm"
              disabled={actionsBusy}
              loading={resendMut.isPending}
              onClick={() => {
                if (resendLockRef.current || resendMut.isPending) return;
                resendLockRef.current = true;
                resendMut.mutate(undefined, {
                  onSettled: () => {
                    resendLockRef.current = false;
                  },
                });
              }}
            >
              {resendMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Resend"
              )}
            </EnterpriseButton>
          )}
          <EnterpriseButton
            size="sm"
            variant="secondary"
            onClick={() => dupMut.mutate()}
            disabled={dupMut.isPending || actionsBusy}
            loading={dupMut.isPending}
          >
            {dupMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Duplicating…
              </>
            ) : (
              "Duplicate"
            )}
          </EnterpriseButton>
          <EnterpriseButton
            size="sm"
            variant="danger"
            onClick={() => setDeleteOpen(true)}
            disabled={delMut.isPending}
          >
            Delete
          </EnterpriseButton>
        </div>
      </div>

      <div className="enterprise-card p-4 sm:p-6">
        <h2 className="font-semibold text-[var(--enterprise-text)]">Breakdown</h2>
        <div className="mobile-table-wrap mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[var(--enterprise-bg)] text-left text-xs font-semibold uppercase text-[var(--enterprise-text-muted)]">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((it) => (
                <tr key={it.id} className="border-t border-[var(--enterprise-border)]">
                  <td className="px-3 py-2 text-[var(--enterprise-text)]">{it.itemName}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--enterprise-text)]">
                    {it.quantity}
                  </td>
                  <td className="px-3 py-2 text-[var(--enterprise-text-muted)]">{it.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--enterprise-text)]">
                    {fmtMoney(it.rate, p.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-[var(--enterprise-text)]">
                    {fmtMoney(it.lineTotal, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1 text-right text-sm text-[var(--enterprise-text-muted)]">
          <div>Subtotal: {fmtMoney(p.subtotal, p.currency)}</div>
          {Number(p.workPricePercent) > 0 && (
            <div>
              Work ({p.workPricePercent}%): {fmtMoney(p.workAmount, p.currency)}
            </div>
          )}
          <div>Taxable: {fmtMoney(p.taxableSubtotal, p.currency)}</div>
          <div>
            Tax ({p.taxPercent}%): {fmtMoney(p.taxAmount, p.currency)}
          </div>
          <div>Discount: {fmtMoney(p.discount, p.currency)}</div>
          <div className="text-lg font-semibold text-[var(--enterprise-primary)]">
            Total: {fmtMoney(p.total, p.currency)}
          </div>
        </div>
      </div>

      {(revData?.revisions?.length ?? 0) > 0 && (
        <div className="enterprise-card p-4 sm:p-6">
          <h2 className="font-semibold text-[var(--enterprise-text)]">Sent history</h2>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            Snapshot saved each time this proposal was emailed to the client.
          </p>
          <div className="relative mt-4 ml-2">
            <div
              className="absolute bottom-0 left-1.5 top-0 w-px bg-[var(--enterprise-border)]"
              aria-hidden
            />
            <ul className="space-y-4">
              {revData!.revisions.map((r, idx) => {
                const snap = r.snapshot;
                const isLatest = idx === 0;
                return (
                  <li key={r.id} className="relative flex gap-4 pl-6">
                    <div
                      className={`absolute left-0 top-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        isLatest
                          ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-surface)]"
                          : "border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
                      }`}
                      aria-hidden
                    >
                      {isLatest && (
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--enterprise-primary)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-medium text-[var(--enterprise-text)]">
                          {new Date(r.sentAt).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isLatest && (
                          <span className="rounded-full bg-[var(--enterprise-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--enterprise-primary)]">
                            Latest sent
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                        {snap?.title ?? p.title}
                        {snap?.total != null && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-medium text-[var(--enterprise-text)]">
                              {fmtMoney(String(snap.total), p.currency)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {reviewPreview ? (
        <ProposalLetterPreviewDialog
          open={reviewOpen}
          onClose={() => {
            setReviewOpen(false);
            setReviewPreview(null);
          }}
          title="Cover letter (as sent)"
          description="Letter uses Markdown when it does not start with HTML tags; legacy HTML letters render as before. Takeoff table matches the client email and portal."
          letterMarkdown={reviewPreview.letterMarkdown}
          letterHtml={reviewPreview.letterHtml}
          takeoffTableHtml={reviewPreview.takeoffTableHtml}
        />
      ) : null}

      {pdfObjectUrl ? (
        <ProposalPdfLightbox
          pdfUrl={pdfObjectUrl}
          fileName={`${p.reference}-proposal.pdf`}
          onClose={() => {
            URL.revokeObjectURL(pdfObjectUrl);
            setPdfObjectUrl(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Milestone({ label, at }: { label: string; at: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 p-3 text-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">{formatWhen(at)}</div>
    </div>
  );
}
