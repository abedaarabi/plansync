"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteProposalConfirmDialog } from "@/components/enterprise/DeleteProposalConfirmDialog";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { ProposalLetterPreviewBlock } from "@/components/enterprise/ProposalLetterPreviewBlock";
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
  const isPro = isWorkspaceProClient(primary?.workspace.subscriptionStatus);

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
  });

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
  const [resendLoading, setResendLoading] = useState(false);
  const [portalReply, setPortalReply] = useState("");

  const portalPostMut = useMutation({
    mutationFn: (text: string) => postProposalPortalMessageStaff(projectId, proposalId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectProposalPortalMessages(projectId, proposalId) });
      setPortalReply("");
      toast.success("Reply sent — the client will see it on their proposal page.");
    },
    onError: (e: Error) => toast.error(e.message),
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
  if (!isPro)
    return (
      <div className="text-amber-800">Proposals require a Pro workspace (active or trial).</div>
    );
  if (isPending) return <EnterpriseLoadingState label="Loading proposal…" />;
  if (isError || !p) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-red-200 bg-red-50/90 p-6 text-red-900">
        <p className="font-medium">Could not load this proposal.</p>
        <p className="text-sm opacity-90">
          {loadError instanceof Error
            ? loadError.message
            : "Check that the API is running and you are signed in."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          Try again
        </button>
        <Link href={base} className="block text-sm font-medium text-red-800 underline">
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <DeleteProposalConfirmDialog
        open={deleteOpen}
        reference={p.reference}
        title={p.title}
        isDeleting={delMut.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => delMut.mutate()}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className="text-sm font-medium text-[#2563EB] hover:underline">
          ← Proposals
        </Link>
        {editable ? (
          <Link
            href={`${base}/${proposalId}/edit`}
            className="text-sm font-semibold text-[#2563EB] hover:underline"
          >
            Edit proposal
          </Link>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        {p.workspaceLogoUrl ? (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.workspaceLogoUrl}
              alt=""
              className="max-h-12 max-w-[180px] object-contain"
            />
          </div>
        ) : null}
        <div className="text-sm font-medium text-slate-500">{p.reference}</div>
        <h1 className="mt-1 text-2xl font-semibold text-[#0F172A]">{p.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
            {p.status.replace(/_/g, " ")}
          </span>
          <span className="text-slate-600">{fmtMoney(p.total, p.currency)}</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Milestone label="Sent" at={p.sentAt} />
          <Milestone label="Viewed" at={p.firstViewedAt} />
          <Milestone label="Accepted" at={p.acceptedAt} />
        </div>

        {p.changeRequestComment ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-amber-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Client requested changes
            </div>
            {p.changeRequestedAt ? (
              <div className="mt-1 text-xs text-amber-800/80">
                {new Date(p.changeRequestedAt).toLocaleString()}
              </div>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm">{p.changeRequestComment}</p>
            <p className="mt-3 text-xs text-amber-800/80">
              Update the proposal in the editor, then re-send the email from this page when you are
              ready. Ongoing chat with the client is in{" "}
              <span className="font-medium">Client portal messages</span> below.
            </p>
          </div>
        ) : null}

        {p.publicToken ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Client portal messages</h2>
            <p className="mt-1 text-xs text-slate-600">
              Same thread as on the client&apos;s proposal link. When they write in
              &quot;Messages&quot; there, it appears here.
            </p>
            {portalMsgLoading ? (
              <p className="mt-3 text-sm text-slate-500">Loading messages…</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {(portalMsgData?.messages ?? []).length === 0 ? (
                  <li className="text-slate-500">No messages yet.</li>
                ) : (
                  (portalMsgData?.messages ?? []).map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-lg border px-3 py-2 ${
                        m.isFromClient ? "border-slate-200 bg-white" : "border-blue-100 bg-blue-50"
                      }`}
                    >
                      <div className="text-xs text-slate-500">
                        {m.isFromClient ? p.clientName : "Your team"} ·{" "}
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-slate-800">{m.body}</div>
                    </li>
                  ))
                )}
              </ul>
            )}
            {p.status === "SENT" || p.status === "VIEWED" || p.status === "CHANGE_REQUESTED" ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <textarea
                  className="min-h-[72px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Reply to the client (visible on their proposal page)…"
                  value={portalReply}
                  onChange={(e) => setPortalReply(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!portalReply.trim() || portalPostMut.isPending}
                  onClick={() => portalPostMut.mutate(portalReply.trim())}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {portalPostMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    "Send reply"
                  )}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-6">
          <button
            type="button"
            disabled={reviewLoading || pdfLoading || csvLoading || esignLoading || resendLoading}
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {reviewLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              "Review cover letter"
            )}
          </button>
          <button
            type="button"
            disabled={pdfLoading || reviewLoading || csvLoading || esignLoading || resendLoading}
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pdfLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Opening…
              </>
            ) : (
              "Review PDF"
            )}
          </button>
          {p.status === "ACCEPTED" && (
            <button
              type="button"
              disabled={csvLoading || reviewLoading || pdfLoading || esignLoading || resendLoading}
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
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {csvLoading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Exporting…
                </>
              ) : (
                "Export CSV"
              )}
            </button>
          )}
          <button
            type="button"
            disabled={esignLoading || reviewLoading || pdfLoading || csvLoading || resendLoading}
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {esignLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              "E-sign handoff"
            )}
          </button>
          {(p.status === "SENT" || p.status === "VIEWED" || p.status === "CHANGE_REQUESTED") && (
            <button
              type="button"
              disabled={resendLoading || reviewLoading || pdfLoading || csvLoading || esignLoading}
              onClick={async () => {
                setResendLoading(true);
                try {
                  await resendProposal(projectId, proposalId);
                  toast.success("Resent");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Resend failed.");
                } finally {
                  setResendLoading(false);
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Resend email"
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => dupMut.mutate()}
            disabled={
              dupMut.isPending ||
              reviewLoading ||
              pdfLoading ||
              csvLoading ||
              esignLoading ||
              resendLoading
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {dupMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Duplicating…
              </>
            ) : (
              "Duplicate"
            )}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={delMut.isPending}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#0F172A]">Breakdown</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
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
              {p.items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{it.itemName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-3 py-2">{it.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtMoney(it.rate, p.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {fmtMoney(it.lineTotal, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1 text-right text-sm">
          <div>Subtotal: {fmtMoney(p.subtotal, p.currency)}</div>
          <div>
            Tax ({p.taxPercent}%):{" "}
            {fmtMoney(String(Number(p.subtotal) * (Number(p.taxPercent) / 100) || 0), p.currency)}
          </div>
          <div>Discount: {fmtMoney(p.discount, p.currency)}</div>
          <div className="text-lg font-semibold text-[#2563EB]">
            Total: {fmtMoney(p.total, p.currency)}
          </div>
        </div>
      </div>

      {(revData?.revisions?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#0F172A]">Sent versions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Snapshot saved each time this proposal was emailed to the client.
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {revData!.revisions.map((r) => {
              const snap = r.snapshot;
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                >
                  <div className="font-medium text-slate-800">
                    {new Date(r.sentAt).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="text-slate-600">
                    {snap?.title ?? "—"} · Total{" "}
                    {snap?.total != null ? fmtMoney(String(snap.total), p.currency) : "—"}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {reviewOpen && reviewPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="proposal-review-title"
          >
            <div className="flex justify-between gap-2">
              <h3 id="proposal-review-title" className="font-semibold text-[#0F172A]">
                Cover letter (as sent)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setReviewOpen(false);
                  setReviewPreview(null);
                }}
                className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Letter uses Markdown when it does not start with HTML tags; legacy HTML letters render
              as before. Takeoff table matches the client email and portal.
            </p>
            <div className="mt-4">
              <ProposalLetterPreviewBlock
                letterMarkdown={reviewPreview.letterMarkdown}
                letterHtml={reviewPreview.letterHtml}
                takeoffTableHtml={reviewPreview.takeoffTableHtml}
              />
            </div>
          </div>
        </div>
      )}

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
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">
        {at
          ? new Date(at).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </div>
    </div>
  );
}
