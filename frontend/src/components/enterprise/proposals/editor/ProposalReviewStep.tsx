"use client";

import { CheckCircle2, Circle, Eye, FileText, Loader2, Send } from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { ProposalLetterPreviewBlock } from "@/components/enterprise/ProposalLetterPreviewBlock";
import {
  coverHasMeaningfulContent,
  fmtMoney,
} from "@/components/enterprise/proposals/editor/proposalEditorShared";

type ReviewPreview = {
  letterMarkdown: string;
  letterHtml: string | null;
  takeoffTableHtml: string;
} | null;

// fallow-ignore-next-line complexity
export function ProposalReviewStep({
  clientName,
  clientEmail,
  clientCompany,
  validUntil,
  currency,
  subtotal,
  total,
  taxPercent,
  taxAmount,
  workPricePercent,
  workAmount,
  discount,
  coverHtml,
  hasItems,
  canSendToClient,
  sendPending,
  previewLoading,
  reviewPreview,
  pdfLoading,
  onBackToCover,
  onOpenPreview,
  onReviewPdf,
  onSend,
  onGoToClient,
  onGoToPricing,
  onGoToCover,
}: {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  validUntil: string;
  currency: string;
  subtotal?: string;
  total?: string;
  taxPercent?: string;
  taxAmount?: string;
  workPricePercent?: string;
  workAmount?: string;
  discount?: string;
  coverHtml: string;
  hasItems: boolean;
  canSendToClient: boolean;
  sendPending: boolean;
  previewLoading: boolean;
  reviewPreview: ReviewPreview;
  pdfLoading: boolean;
  onBackToCover: () => void;
  onOpenPreview: () => void;
  onReviewPdf: () => void;
  onSend: () => void;
  onGoToClient: () => void;
  onGoToPricing: () => void;
  onGoToCover: () => void;
}) {
  const emailOk = Boolean(clientEmail.trim());
  const coverOk = coverHasMeaningfulContent(coverHtml);
  const checklistOk = emailOk && hasItems && coverOk;

  return (
    <section aria-label="Review and send" className="space-y-5">
      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-xs)] sm:p-6">
        <h2 className="text-base font-semibold text-[var(--enterprise-text)]">Review & send</h2>
        <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
          Confirm recipient, totals, and letter before sending to the client.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="enterprise-type-label text-[var(--enterprise-text-muted)]">
              Recipient
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">
              {clientName || "—"}
            </div>
            {clientCompany ? (
              <div className="text-xs text-[var(--enterprise-text-muted)]">{clientCompany}</div>
            ) : null}
            <div className="text-xs text-[var(--enterprise-text-muted)]">
              {clientEmail || "No email"}
            </div>
          </div>
          <div>
            <div className="enterprise-type-label text-[var(--enterprise-text-muted)]">
              Valid until
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">
              {validUntil
                ? new Date(validUntil + "T12:00:00").toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-4 py-3 text-sm">
          <div className="space-y-0.5 text-[var(--enterprise-text-muted)]">
            {subtotal != null && <div>Subtotal: {fmtMoney(subtotal, currency)}</div>}
            {workPricePercent != null && Number(workPricePercent) > 0 && workAmount != null && (
              <div>
                Work ({workPricePercent}%): {fmtMoney(workAmount, currency)}
              </div>
            )}
            {taxPercent != null && taxAmount != null && (
              <div>
                Tax ({taxPercent}%): {fmtMoney(taxAmount, currency)}
              </div>
            )}
            {discount != null && Number(discount) > 0 && (
              <div>Discount: −{fmtMoney(discount, currency)}</div>
            )}
          </div>
          <div className="mt-1.5 text-base font-semibold text-[var(--enterprise-primary)]">
            Total: {total != null ? fmtMoney(total, currency) : "—"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-xs)]">
        <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Checklist</h3>
        <ul className="mt-3 space-y-2">
          <ChecklistRow
            ok={emailOk}
            label="Client email"
            onFix={!emailOk ? onGoToClient : undefined}
          />
          <ChecklistRow
            ok={hasItems}
            label="Line items"
            onFix={!hasItems ? onGoToPricing : undefined}
          />
          <ChecklistRow
            ok={coverOk}
            label="Cover letter not empty"
            onFix={!coverOk ? onGoToCover : undefined}
          />
        </ul>
      </div>

      <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-xs)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Letter preview</h3>
          {previewLoading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--enterprise-text-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading…
            </span>
          ) : null}
        </div>
        <div className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-[var(--enterprise-border)] bg-white px-4 py-4">
          {reviewPreview ? (
            <ProposalLetterPreviewBlock
              letterMarkdown={reviewPreview.letterMarkdown}
              letterHtml={reviewPreview.letterHtml}
              takeoffTableHtml={reviewPreview.takeoffTableHtml}
            />
          ) : previewLoading ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">Loading preview…</p>
          ) : (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              Preview will appear here once the proposal is saved.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <EnterpriseButton type="button" variant="ghost" size="sm" onClick={onBackToCover}>
          ← Cover
        </EnterpriseButton>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="sm"
            disabled={previewLoading}
            onClick={onOpenPreview}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="sm"
            loading={pdfLoading}
            disabled={pdfLoading}
            onClick={onReviewPdf}
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
            Review PDF
          </EnterpriseButton>
          {canSendToClient ? (
            <EnterpriseButton
              type="button"
              size="sm"
              disabled={sendPending || !checklistOk}
              loading={sendPending}
              onClick={onSend}
              title={!checklistOk ? "Complete the checklist before sending" : undefined}
            >
              {sendPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {sendPending ? "Sending…" : "Send to client"}
            </EnterpriseButton>
          ) : (
            <p className="text-xs text-[var(--enterprise-text-muted)] sm:text-right">
              Already sent. Edits auto-update the portal.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ChecklistRow({ ok, label, onFix }: { ok: boolean; label: string; onFix?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-[var(--enterprise-text)]">
        {ok ? (
          <CheckCircle2
            className="h-4 w-4 text-[var(--enterprise-semantic-success-text)]"
            aria-hidden
          />
        ) : (
          <Circle className="h-4 w-4 text-[var(--enterprise-text-muted)]" aria-hidden />
        )}
        {label}
      </span>
      {!ok && onFix ? (
        <button
          type="button"
          onClick={onFix}
          className="text-xs font-medium text-[var(--enterprise-primary)] hover:underline"
        >
          Fix →
        </button>
      ) : null}
    </li>
  );
}
