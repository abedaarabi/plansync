"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  PenLine,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatProjectMoney } from "@/lib/projectCurrency";
import {
  ProposalLetterPreviewBlock,
  splitProposalCoverNote,
} from "@/components/enterprise/ProposalLetterPreviewBlock";
import {
  fetchPublicProposal,
  fetchPublicProposalMessages,
  postPublicProposalAccept,
  postPublicProposalDecline,
  postPublicProposalMessage,
  postPublicProposalRequestChanges,
  postPublicProposalView,
} from "@/lib/api-client";

function fmtMoney(amount: string, currency: string) {
  return formatProjectMoney(amount, currency);
}

const DECLINE = [
  { value: "PRICE_TOO_HIGH", label: "Price too high" },
  { value: "TIMING", label: "Timing doesn't work" },
  { value: "SCOPE", label: "Scope not right" },
  { value: "OTHER_COMPANY", label: "Going with another company" },
  { value: "OTHER", label: "Other" },
] as const;

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

function statusPresentation(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "SENT":
      return { label: "Awaiting your review", tone: "info" };
    case "VIEWED":
      return { label: "Viewed", tone: "neutral" };
    case "CHANGE_REQUESTED":
      return { label: "Changes requested", tone: "warning" };
    case "ACCEPTED":
      return { label: "Accepted", tone: "success" };
    case "DECLINED":
      return { label: "Declined", tone: "danger" };
    case "EXPIRED":
      return { label: "Expired", tone: "muted" };
    case "DRAFT":
      return { label: "Draft", tone: "muted" };
    default:
      return { label: status.replace(/_/g, " "), tone: "neutral" };
  }
}

const badgeTone: Record<StatusTone, string> = {
  neutral:
    "bg-[var(--enterprise-bg)] text-[var(--enterprise-text)] ring-[var(--enterprise-border)]",
  info: "bg-[var(--enterprise-semantic-info-bg)] text-[var(--enterprise-semantic-info-text)] ring-[var(--enterprise-semantic-info-border)]",
  success:
    "bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)] ring-[var(--enterprise-semantic-success-border)]",
  warning:
    "bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)] ring-[var(--enterprise-semantic-warning-border)]",
  danger:
    "bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)] ring-[var(--enterprise-semantic-danger-border)]",
  muted:
    "bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)] ring-[var(--enterprise-border)]",
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2.5 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] outline-none transition-[box-shadow,border-color] placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:ring-2 focus:ring-[var(--enterprise-primary)]/25";

/** Matches PlanSync enterprise shell — hover, focus, active micro-interaction */
const btnBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const btnPrimary = `${btnBase} bg-[var(--enterprise-primary)] text-white shadow-sm hover:bg-[var(--enterprise-primary-deep)] focus-visible:ring-[var(--enterprise-primary)] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none aria-busy:cursor-wait`;

const btnSecondary = `${btnBase} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] hover:bg-[var(--enterprise-primary-soft)] hover:text-[var(--enterprise-primary-deep)] focus-visible:ring-[var(--enterprise-primary)]/35`;

const btnDanger = `${btnBase} border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)] shadow-[var(--enterprise-shadow-xs)] hover:brightness-95 focus-visible:ring-[var(--enterprise-error)]/35`;

const btnDangerSolid = `${btnBase} bg-[var(--enterprise-error)] text-white shadow-sm hover:brightness-110 focus-visible:ring-[var(--enterprise-error)]/50 disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-wait`;

const btnBack =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition-colors hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25 disabled:pointer-events-none disabled:opacity-40";

const btnText =
  "cursor-pointer rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--enterprise-primary)] underline-offset-2 transition-colors hover:bg-[var(--enterprise-primary-soft)] hover:text-[var(--enterprise-primary-deep)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30";

// fallow-ignore-next-line complexity
export function ProposalPortalClient({ token }: { token: string }) {
  const qc = useQueryClient();
  const viewedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  /** Blocks double-submit before React re-renders (e.g. double-click, Enter + click). */
  const messageSendLockRef = useRef(false);
  const panelSubmitLockRef = useRef(false);

  const { data, isPending, error } = useQuery({
    queryKey: ["publicProposal", token],
    queryFn: () => fetchPublicProposal(token),
  });

  const { data: msgData } = useQuery({
    queryKey: ["publicProposalMessages", token],
    queryFn: () => fetchPublicProposalMessages(token),
    enabled: Boolean(data && !data.expired),
  });

  useEffect(() => {
    if (!data || viewedRef.current) return;
    viewedRef.current = true;
    void postPublicProposalView(token);
  }, [data, token]);

  const [panel, setPanel] = useState<"none" | "accept" | "decline" | "changes">("none");
  const [signerName, setSignerName] = useState("");
  const [declineReason, setDeclineReason] = useState<string>("PRICE_TOO_HIGH");
  const [declineComment, setDeclineComment] = useState("");
  const [changeComment, setChangeComment] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [done, setDone] = useState(false);
  const [actionBusy, setActionBusy] = useState<null | "accept" | "decline" | "changes" | "msg">(
    null,
  );

  const msgSending = actionBusy === "msg";

  async function sendPortalMessage() {
    const text = msgBody.trim();
    if (!text || messageSendLockRef.current) return;
    messageSendLockRef.current = true;
    setActionBusy("msg");
    try {
      await postPublicProposalMessage(token, text);
      setMsgBody("");
      await qc.invalidateQueries({ queryKey: ["publicProposalMessages", token] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      messageSendLockRef.current = false;
      setActionBusy(null);
    }
  }

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || panel !== "accept") return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    const pos = (e: MouseEvent | TouchEvent) => {
      const r = cv.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0]!.clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0]!.clientY : e.clientY;
      return { x: clientX - r.left, y: clientY - r.top };
    };
    const down = (e: MouseEvent | TouchEvent) => {
      drawing.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      drawing.current = false;
    };
    cv.addEventListener("mousedown", down);
    cv.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    cv.addEventListener("touchstart", down, { passive: true });
    cv.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      cv.removeEventListener("mousedown", down);
      cv.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      cv.removeEventListener("touchstart", down);
      cv.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [panel]);

  if (isPending) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[var(--enterprise-bg)]">
        <header className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/90 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" className="h-6 w-6" width={24} height={24} />
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-md)]">
            <Loader2
              className="h-6 w-6 animate-spin text-[var(--enterprise-primary)]"
              aria-hidden
            />
          </div>
          <p className="text-sm font-medium text-[var(--enterprise-text-muted)]">
            Loading your proposal…
          </p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[var(--enterprise-bg)]">
        <header className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-[var(--enterprise-text)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" className="h-6 w-6" width={24} height={24} />
            <span className="text-sm font-medium">PlanSync</span>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="enterprise-card max-w-md p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--enterprise-bg)]">
              <AlertCircle className="h-6 w-6 text-[var(--enterprise-text-muted)]" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-[var(--enterprise-text)]">
              Proposal not found
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
              This link may be incorrect or the proposal may no longer be available. If you need
              help, contact the company that sent you this link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const p = data;
  const canAct =
    !p.expired &&
    !done &&
    (p.status === "SENT" || p.status === "VIEWED" || p.status === "CHANGE_REQUESTED");

  const st = statusPresentation(p.status);
  const badgeClass = badgeTone[st.tone];
  const validUntilLabel = new Date(p.validUntil).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-[100dvh] bg-[var(--enterprise-bg)] text-[var(--enterprise-text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            className="h-6 w-6 shrink-0 opacity-90"
            width={24}
            height={24}
          />
          <span className="text-sm text-[var(--enterprise-text-muted)]">
            Secured proposal ·{" "}
            <span className="font-semibold text-[var(--enterprise-text)]">PlanSync</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {p.status === "ACCEPTED" && (
          <div className="mb-5 flex gap-3 rounded-2xl border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-surface)] text-[var(--enterprise-semantic-success-text)]">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-[var(--enterprise-semantic-success-text)]">
                Proposal accepted
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-semantic-success-text)]/85">
                Thank you. Your acceptance is on record. The team may follow up with next steps.
              </p>
            </div>
          </div>
        )}
        {p.status === "DECLINED" && (
          <div className="mb-5 flex gap-3 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)] sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <XCircle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-[var(--enterprise-text)]">Proposal declined</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                Your response has been recorded. You can still message the team below if needed.
              </p>
            </div>
          </div>
        )}
        {p.expired && p.status !== "ACCEPTED" && p.status !== "DECLINED" && (
          <div className="mb-5 flex gap-3 rounded-2xl border border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-surface)] text-[var(--enterprise-semantic-warning-text)]">
              <Calendar className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-[var(--enterprise-semantic-warning-text)]">
                This proposal has expired
              </p>
              <p className="mt-1 text-sm text-[var(--enterprise-semantic-warning-text)]/85">
                You can still read the details below. Contact the sender if you need an updated
                offer.
              </p>
            </div>
          </div>
        )}

        {/* First viewport: company, title, total, valid until, Accept CTA */}
        <article className="overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-card)]">
          <div className="border-b border-[var(--enterprise-border)] bg-gradient-to-b from-[var(--enterprise-primary-soft)]/50 to-[var(--enterprise-surface)] px-5 py-6 sm:px-8 sm:py-8">
            {p.workspaceLogoUrl ? (
              <div className="mb-4 flex justify-center sm:justify-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.workspaceLogoUrl}
                  alt=""
                  className="max-h-14 max-w-[200px] object-contain"
                />
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--enterprise-text-muted)]">
              {p.workspaceName}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              {p.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}
              >
                {st.label}
              </span>
              <span className="text-xs text-[var(--enterprise-text-muted)]">
                Prepared for {p.clientName}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Total
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[var(--enterprise-primary)] sm:text-4xl">
                  {fmtMoney(p.total, p.currency)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--enterprise-text-muted)]">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Valid until {validUntilLabel}
                </p>
              </div>
              {canAct && panel === "none" ? (
                <button
                  type="button"
                  onClick={() => setPanel("accept")}
                  className={`${btnPrimary} min-h-12 w-full px-6 py-3.5 sm:w-auto sm:min-w-[180px]`}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Accept proposal
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 sm:px-8 sm:py-5">
            <div className="rounded-xl bg-[var(--enterprise-bg)]/80 px-4 py-3 ring-1 ring-[var(--enterprise-border)]">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Reference
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-[var(--enterprise-text)]">
                {p.reference}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--enterprise-bg)]/80 px-4 py-3 ring-1 ring-[var(--enterprise-border)]">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                From
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--enterprise-text)]">
                {p.workspaceName}
              </p>
            </div>
          </div>
        </article>

        {/* Cover letter */}
        <section className="mt-6 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-sm)] sm:mt-8 sm:p-8">
          <div className="mb-5 flex items-center gap-2 border-b border-[var(--enterprise-border)] pb-4">
            <PenLine className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
            <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">Cover letter</h2>
          </div>
          <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-5 sm:px-6 sm:py-6">
            <ProposalLetterPreviewBlock
              {...splitProposalCoverNote(p.coverHtml)}
              takeoffTableHtml=""
            />
          </div>
        </section>

        {/* Breakdown */}
        <section className="mt-6 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-sm)] sm:mt-8 sm:p-8">
          <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">
            Line items & totals
          </h2>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            Scope and pricing as proposed.
          </p>
          <div className="mt-5 overflow-hidden rounded-xl border border-[var(--enterprise-border)]">
            <div className="mobile-table-wrap overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
                  {p.items.map((it) => (
                    <tr
                      key={it.id}
                      className="transition-colors hover:bg-[var(--enterprise-hover-surface)]/50"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--enterprise-text)]">
                        {it.itemName}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--enterprise-text)]">
                        {it.quantity}
                      </td>
                      <td className="px-4 py-3 text-[var(--enterprise-text-muted)]">{it.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--enterprise-text)]">
                        {fmtMoney(it.rate, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                        {fmtMoney(it.lineTotal, p.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-5 space-y-2 rounded-xl bg-[var(--enterprise-bg)]/80 p-4 ring-1 ring-[var(--enterprise-border)] sm:p-5">
            <div className="flex justify-between text-sm text-[var(--enterprise-text-muted)]">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-[var(--enterprise-text)]">
                {fmtMoney(p.subtotal, p.currency)}
              </span>
            </div>
            {Number(p.workPricePercent) > 0 && (
              <div className="flex justify-between text-sm text-[var(--enterprise-text-muted)]">
                <span>Work ({p.workPricePercent}%)</span>
                <span className="tabular-nums font-medium text-[var(--enterprise-text)]">
                  {fmtMoney(p.workAmount, p.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm text-[var(--enterprise-text-muted)]">
              <span>Tax ({p.taxPercent}%)</span>
              <span className="tabular-nums font-medium text-[var(--enterprise-text)]">
                {fmtMoney(p.taxAmount, p.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-[var(--enterprise-text-muted)]">
              <span>Discount</span>
              <span className="tabular-nums font-medium text-[var(--enterprise-text)]">
                {fmtMoney(p.discount, p.currency)}
              </span>
            </div>
            <div className="border-t border-[var(--enterprise-border)] pt-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-semibold text-[var(--enterprise-text)]">Total</span>
                <span className="text-2xl font-bold tracking-tight text-[var(--enterprise-primary)]">
                  {fmtMoney(p.total, p.currency)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {p.attachments.length > 0 && (
          <section className="mt-6 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-sm)] sm:mt-8 sm:p-8">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
              <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">Attachments</h2>
            </div>
            <ul className="space-y-2">
              {p.attachments.map((a) => (
                <li key={a.fileVersionId}>
                  {a.readUrl ? (
                    <a
                      href={a.readUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-4 py-3 text-sm font-medium text-[var(--enterprise-text)] transition-colors hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-primary-soft)] hover:text-[var(--enterprise-primary-deep)]"
                    >
                      <span className="min-w-0 truncate">
                        {a.fileName}
                        <span className="ml-2 font-normal text-[var(--enterprise-text-muted)]">
                          v{a.version}
                        </span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)] group-hover:text-[var(--enterprise-primary)]" />
                    </a>
                  ) : (
                    <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-4 py-3 text-sm text-[var(--enterprise-text-muted)]">
                      {a.fileName}{" "}
                      <span className="text-[var(--enterprise-text-muted)]">(v{a.version})</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions */}
        {canAct && panel === "none" && (
          <section className="mt-8 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-md)] sm:mt-10 sm:p-8">
            <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">Your response</h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Accept to proceed, decline if it is not a fit, or ask for revisions.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => setPanel("accept")}
                className={`${btnPrimary} min-h-12 flex-1 px-5 py-3.5 sm:min-w-[160px] sm:flex-none`}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Accept proposal
              </button>
              <button
                type="button"
                onClick={() => setPanel("changes")}
                className={`${btnSecondary} min-h-12 flex-1 px-5 py-3.5 sm:min-w-[160px] sm:flex-none`}
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() => setPanel("decline")}
                className={`${btnDanger} min-h-12 flex-1 px-5 py-3.5 sm:min-w-[140px] sm:flex-none`}
              >
                Decline
              </button>
            </div>
          </section>
        )}

        {panel === "accept" && canAct && (
          <section className="mt-8 rounded-2xl border border-[color-mix(in_srgb,var(--enterprise-primary)_25%,var(--enterprise-border))] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-md)] sm:mt-10 sm:p-8">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => setPanel("none")}
              className={btnBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <h3 className="mt-4 text-lg font-semibold text-[var(--enterprise-text)]">
              Accept this proposal
            </h3>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Sign below to confirm. Your name should match how you are agreeing to this proposal.
            </p>
            <label className="mt-6 block text-sm font-medium text-[var(--enterprise-text)]">
              Full legal name
              <input
                className={fieldClass}
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                autoComplete="name"
                placeholder="e.g. Jane Smith"
              />
            </label>
            <div className="mt-5">
              <p className="text-sm font-medium text-[var(--enterprise-text)]">Signature</p>
              <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                Draw with your finger or mouse in the box.
              </p>
              <canvas
                ref={canvasRef}
                width={440}
                height={120}
                className="mt-2 w-full max-w-md touch-none rounded-xl border-2 border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-inner"
              />
              <button
                type="button"
                className={`${btnText} mt-2`}
                onClick={() => {
                  const cv = canvasRef.current;
                  const ctx = cv?.getContext("2d");
                  if (ctx && cv) {
                    ctx.fillStyle = "#fff";
                    ctx.fillRect(0, 0, cv.width, cv.height);
                  }
                }}
              >
                Clear signature
              </button>
            </div>
            <button
              type="button"
              disabled={actionBusy !== null}
              aria-busy={actionBusy === "accept"}
              className={`${btnPrimary} mt-6 w-full px-5 py-3.5 sm:w-auto`}
              onClick={async () => {
                if (panelSubmitLockRef.current) return;
                const cv = canvasRef.current;
                if (!signerName.trim() || !cv) {
                  toast.error("Name and signature required");
                  return;
                }
                const dataUrl = cv.toDataURL("image/png");
                panelSubmitLockRef.current = true;
                setActionBusy("accept");
                try {
                  await postPublicProposalAccept(token, {
                    signerName: signerName.trim(),
                    signatureData: dataUrl,
                  });
                  setDone(true);
                  setPanel("none");
                  toast.success("Thank you — your acceptance has been recorded.");
                  qc.invalidateQueries({ queryKey: ["publicProposal", token] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  panelSubmitLockRef.current = false;
                  setActionBusy(null);
                }
              }}
            >
              {actionBusy === "accept" ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                "Confirm acceptance"
              )}
            </button>
          </section>
        )}

        {panel === "decline" && canAct && (
          <section className="mt-8 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-md)] sm:mt-10 sm:p-8">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => setPanel("none")}
              className={btnBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <h3 className="mt-4 text-lg font-semibold text-[var(--enterprise-text)]">
              Decline proposal
            </h3>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Optional feedback helps the team understand your decision.
            </p>
            <div className="mt-5 space-y-2">
              {DECLINE.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    declineReason === r.value
                      ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary-soft)] ring-1 ring-[var(--enterprise-primary)]/30"
                      : "border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/30 hover:bg-[var(--enterprise-hover-surface)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="dr"
                    checked={declineReason === r.value}
                    onChange={() => setDeclineReason(r.value)}
                    className="h-4 w-4 border-[var(--enterprise-border)] text-[var(--enterprise-primary)] focus:ring-[var(--enterprise-primary)]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <label className="mt-5 block text-sm font-medium text-[var(--enterprise-text)]">
              Comments{" "}
              <span className="font-normal text-[var(--enterprise-text-muted)]">(optional)</span>
              <textarea
                className={`${fieldClass} min-h-[100px] resize-y`}
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                rows={3}
              />
            </label>
            <button
              type="button"
              disabled={actionBusy !== null}
              aria-busy={actionBusy === "decline"}
              className={`${btnDangerSolid} mt-6 w-full px-5 py-3.5 sm:w-auto`}
              onClick={async () => {
                if (panelSubmitLockRef.current) return;
                panelSubmitLockRef.current = true;
                setActionBusy("decline");
                try {
                  await postPublicProposalDecline(token, {
                    reason: declineReason,
                    comment: declineComment || null,
                  });
                  setDone(true);
                  setPanel("none");
                  toast.success("Response recorded.");
                  qc.invalidateQueries({ queryKey: ["publicProposal", token] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  panelSubmitLockRef.current = false;
                  setActionBusy(null);
                }
              }}
            >
              {actionBusy === "decline" ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                "Confirm decline"
              )}
            </button>
          </section>
        )}

        {panel === "changes" && canAct && (
          <section className="mt-8 rounded-2xl border border-[color-mix(in_srgb,var(--enterprise-primary)_20%,var(--enterprise-border))] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-md)] sm:mt-10 sm:p-8">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => setPanel("none")}
              className={btnBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <h3 className="mt-4 text-lg font-semibold text-[var(--enterprise-text)]">
              Request changes
            </h3>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Describe what you would like adjusted. The team will review and follow up.
            </p>
            <textarea
              className={`${fieldClass} mt-5 min-h-[140px] resize-y`}
              rows={5}
              value={changeComment}
              onChange={(e) => setChangeComment(e.target.value)}
              placeholder="e.g. Adjust quantities on line 3, extend validity date…"
            />
            <button
              type="button"
              disabled={actionBusy !== null}
              aria-busy={actionBusy === "changes"}
              className={`${btnPrimary} mt-6 w-full px-5 py-3.5 sm:w-auto`}
              onClick={async () => {
                if (panelSubmitLockRef.current) return;
                if (!changeComment.trim()) {
                  toast.error("Please add a message");
                  return;
                }
                panelSubmitLockRef.current = true;
                setActionBusy("changes");
                try {
                  await postPublicProposalRequestChanges(token, changeComment.trim());
                  setDone(true);
                  setPanel("none");
                  toast.success("Your request was sent.");
                  qc.invalidateQueries({ queryKey: ["publicProposal", token] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  panelSubmitLockRef.current = false;
                  setActionBusy(null);
                }
              }}
            >
              {actionBusy === "changes" ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Submit request"
              )}
            </button>
          </section>
        )}

        {/* Messages */}
        <section className="mt-8 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-sm)] sm:mt-10 sm:p-8">
          <div className="mb-5 flex items-center gap-2 border-b border-[var(--enterprise-border)] pb-4">
            <MessageSquare className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">Messages</h2>
              <p className="text-sm text-[var(--enterprise-text-muted)]">
                Chat with the team about this proposal.
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {(msgData?.messages ?? []).length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-4 py-8 text-center text-sm text-[var(--enterprise-text-muted)]">
                No messages yet. Say hello or ask a question below.
              </li>
            ) : (
              (msgData?.messages ?? []).map((m) => (
                <li
                  key={m.id}
                  className={`flex flex-col rounded-2xl px-4 py-3 text-sm ${
                    m.isFromClient
                      ? "ml-4 bg-[var(--enterprise-bg)] text-[var(--enterprise-text)] ring-1 ring-[var(--enterprise-border)]"
                      : "mr-4 bg-gradient-to-br from-[var(--enterprise-primary-soft)] to-[var(--enterprise-surface)] text-[var(--enterprise-text)] ring-1 ring-[color-mix(in_srgb,var(--enterprise-primary)_20%,var(--enterprise-border))]"
                  }`}
                >
                  <div className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                    {m.isFromClient ? "You" : p.workspaceName} ·{" "}
                    {new Date(m.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                  <div className="mt-1.5 whitespace-pre-wrap leading-relaxed">{m.body}</div>
                </li>
              ))
            )}
          </ul>
          {!p.expired ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <input
                className={`${fieldClass} ${msgSending ? "cursor-wait opacity-90" : ""}`}
                value={msgBody}
                readOnly={msgSending}
                aria-busy={msgSending}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder={msgSending ? "Sending…" : "Write a message…"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendPortalMessage();
                  }
                }}
              />
              <button
                type="button"
                disabled={msgSending || !msgBody.trim()}
                aria-busy={msgSending}
                className={`${btnPrimary} min-h-12 shrink-0 self-stretch px-6 py-3 sm:self-auto`}
                onClick={() => void sendPortalMessage()}
              >
                {msgSending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-center text-sm text-[var(--enterprise-text-muted)]">
              Messaging is unavailable for expired proposals.
            </p>
          )}
        </section>
      </main>

      <footer className="mt-4 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/60 px-4 py-8 text-center backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            className="h-5 w-5 shrink-0 opacity-70"
            width={20}
            height={20}
          />
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            Proposal hosted securely by{" "}
            <span className="font-semibold text-[var(--enterprise-text)]">PlanSync</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
