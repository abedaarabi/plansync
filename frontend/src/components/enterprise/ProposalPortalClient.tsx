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
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/80",
  info: "bg-sky-50 text-sky-900 ring-sky-200/80",
  success: "bg-emerald-50 text-emerald-900 ring-emerald-200/80",
  warning: "bg-amber-50 text-amber-950 ring-amber-200/80",
  danger: "bg-red-50 text-red-900 ring-red-200/80",
  muted: "bg-slate-100 text-slate-600 ring-slate-200/80",
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[var(--enterprise-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-[var(--enterprise-primary)]/25";

/** Matches PlanSync enterprise shell — hover, focus, active micro-interaction */
const btnBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const btnPrimary = `${btnBase} bg-[var(--enterprise-primary)] text-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_2px_8px_-2px_rgba(37,99,235,0.35)] hover:bg-[var(--enterprise-primary-deep)] hover:shadow-[0_4px_14px_-4px_rgba(37,99,235,0.45)] focus-visible:ring-[var(--enterprise-primary)] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none aria-busy:cursor-wait`;

const btnSecondary = `${btnBase} border border-[var(--enterprise-border)] bg-white text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] hover:border-blue-200 hover:bg-[var(--enterprise-primary-soft)] hover:text-[var(--enterprise-primary-deep)] focus-visible:ring-[var(--enterprise-primary)]/35`;

const btnDanger = `${btnBase} border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)] shadow-[var(--enterprise-shadow-xs)] hover:border-red-300 hover:bg-red-100/90 focus-visible:ring-red-500/35`;

const btnDangerSolid = `${btnBase} bg-[var(--enterprise-error)] text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:brightness-110 hover:shadow-md focus-visible:ring-red-500/50 disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-wait`;

const btnBack =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition-colors hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25 disabled:pointer-events-none disabled:opacity-40";

const btnText =
  "cursor-pointer rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--enterprise-primary)] underline-offset-2 transition-colors hover:bg-[var(--enterprise-primary-soft)] hover:text-[var(--enterprise-primary-deep)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30";

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
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" className="h-6 w-6" width={24} height={24} />
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[var(--enterprise-shadow-md)]">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-600">Loading your proposal…</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="border-b border-slate-200/80 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" className="h-6 w-6" width={24} height={24} />
            <span className="text-sm font-medium">PlanSync</span>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-[var(--enterprise-shadow-card)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <AlertCircle className="h-6 w-6 text-slate-500" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">Proposal not found</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
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

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            className="h-6 w-6 shrink-0 opacity-90"
            width={24}
            height={24}
          />
          <span className="text-sm text-slate-600">
            Secured proposal · <span className="font-semibold text-slate-800">PlanSync</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        {/* Status banners */}
        {p.status === "ACCEPTED" && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-[var(--enterprise-shadow-xs)] sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-emerald-950">Proposal accepted</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-900/80">
                Thank you. Your acceptance is on record. The team may follow up with next steps.
              </p>
            </div>
          </div>
        )}
        {p.status === "DECLINED" && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--enterprise-shadow-xs)] sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <XCircle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Proposal declined</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Your response has been recorded. You can still message the team below if needed.
              </p>
            </div>
          </div>
        )}
        {p.expired && p.status !== "ACCEPTED" && p.status !== "DECLINED" && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Calendar className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-amber-950">This proposal has expired</p>
              <p className="mt-1 text-sm text-amber-900/85">
                You can still read the details below. Contact the sender if you need an updated
                offer.
              </p>
            </div>
          </div>
        )}

        {/* Hero */}
        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--enterprise-shadow-card)]">
          <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 py-6 sm:px-8 sm:py-8">
            {p.workspaceLogoUrl ? (
              <div className="mb-6 flex justify-center sm:justify-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.workspaceLogoUrl}
                  alt=""
                  className="max-h-16 max-w-[220px] object-contain"
                />
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Proposal
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {p.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}
              >
                {st.label}
              </span>
            </div>
          </div>
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-8 sm:py-6">
            <div className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-100">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">From</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{p.workspaceName}</p>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-100">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Prepared for
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{p.clientName}</p>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-100">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Reference
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{p.reference}</p>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-100">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Valid until
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {new Date(p.validUntil).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </article>

        {/* Cover letter */}
        <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--enterprise-shadow-sm)] sm:p-8">
          <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
            <PenLine className="h-5 w-5 text-sky-600" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-900">Cover message</h2>
          </div>
          <ProposalLetterPreviewBlock
            {...splitProposalCoverNote(p.coverHtml)}
            takeoffTableHtml=""
          />
        </section>

        {/* Breakdown */}
        <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--enterprise-shadow-sm)] sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Line items & totals</h2>
          <p className="mt-1 text-sm text-slate-600">Scope and pricing as proposed.</p>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 ring-1 ring-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {p.items.map((it) => (
                    <tr key={it.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">{it.itemName}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {it.quantity}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{it.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {fmtMoney(it.rate, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                        {fmtMoney(it.lineTotal, p.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-5 space-y-2 rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100 sm:p-5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-slate-800">
                {fmtMoney(p.subtotal, p.currency)}
              </span>
            </div>
            {Number(p.workPricePercent) > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Work ({p.workPricePercent}%)</span>
                <span className="tabular-nums font-medium text-slate-800">
                  {fmtMoney(p.workAmount, p.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tax ({p.taxPercent}%)</span>
              <span className="tabular-nums font-medium text-slate-800">
                {fmtMoney(p.taxAmount, p.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Discount</span>
              <span className="tabular-nums font-medium text-slate-800">
                {fmtMoney(p.discount, p.currency)}
              </span>
            </div>
            <div className="border-t border-slate-200/80 pt-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-2xl font-bold tracking-tight text-sky-600">
                  {fmtMoney(p.total, p.currency)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {p.attachments.length > 0 && (
          <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--enterprise-shadow-sm)] sm:p-8">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-900">Attachments</h2>
            </div>
            <ul className="space-y-2">
              {p.attachments.map((a) => (
                <li key={a.fileVersionId}>
                  {a.readUrl ? (
                    <a
                      href={a.readUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-sky-200 hover:bg-sky-50/40 hover:text-sky-800"
                    >
                      <span className="min-w-0 truncate">
                        {a.fileName}
                        <span className="ml-2 font-normal text-slate-500">v{a.version}</span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-sky-600" />
                    </a>
                  ) : (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm text-slate-600">
                      {a.fileName} <span className="text-slate-400">(v{a.version})</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions */}
        {canAct && panel === "none" && (
          <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--enterprise-shadow-md)] sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Your response</h2>
            <p className="mt-1 text-sm text-slate-600">
              Accept to proceed, decline if it is not a fit, or ask for revisions.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => setPanel("accept")}
                className={`${btnPrimary} flex-1 px-5 py-3.5 sm:min-w-[160px] sm:flex-none`}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Accept proposal
              </button>
              <button
                type="button"
                onClick={() => setPanel("changes")}
                className={`${btnSecondary} flex-1 px-5 py-3.5 sm:min-w-[160px] sm:flex-none`}
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() => setPanel("decline")}
                className={`${btnDanger} flex-1 px-5 py-3.5 sm:min-w-[140px] sm:flex-none`}
              >
                Decline
              </button>
            </div>
          </section>
        )}

        {panel === "accept" && canAct && (
          <section className="mt-10 rounded-2xl border border-blue-200/70 bg-white p-5 shadow-[var(--enterprise-shadow-md)] sm:p-8">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => setPanel("none")}
              className={btnBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Accept this proposal</h3>
            <p className="mt-1 text-sm text-slate-600">
              Sign below to confirm. Your name should match how you are agreeing to this proposal.
            </p>
            <label className="mt-6 block text-sm font-medium text-slate-700">
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
              <p className="text-sm font-medium text-slate-700">Signature</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Draw with your finger or mouse in the box.
              </p>
              <canvas
                ref={canvasRef}
                width={440}
                height={120}
                className="mt-2 w-full max-w-md rounded-xl border-2 border-dashed border-slate-200 bg-white shadow-inner touch-none"
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
          <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--enterprise-shadow-md)] sm:p-8">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => setPanel("none")}
              className={btnBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Decline proposal</h3>
            <p className="mt-1 text-sm text-slate-600">
              Optional feedback helps the team understand your decision.
            </p>
            <div className="mt-5 space-y-2">
              {DECLINE.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    declineReason === r.value
                      ? "border-blue-300 bg-[var(--enterprise-primary-soft)] ring-1 ring-blue-200/80"
                      : "border-[var(--enterprise-border)] bg-slate-50/30 hover:border-slate-300 hover:bg-[var(--enterprise-hover-surface)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="dr"
                    checked={declineReason === r.value}
                    onChange={() => setDeclineReason(r.value)}
                    className="h-4 w-4 border-slate-300 text-[var(--enterprise-primary)] focus:ring-[var(--enterprise-primary)]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Comments <span className="font-normal text-slate-500">(optional)</span>
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
          <section className="mt-10 rounded-2xl border border-blue-200/60 bg-white p-5 shadow-[var(--enterprise-shadow-md)] sm:p-8">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => setPanel("none")}
              className={btnBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Request changes</h3>
            <p className="mt-1 text-sm text-slate-600">
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
        <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--enterprise-shadow-sm)] sm:p-8">
          <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
            <MessageSquare className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
              <p className="text-sm text-slate-600">Chat with the team about this proposal.</p>
            </div>
          </div>
          <ul className="space-y-3">
            {(msgData?.messages ?? []).length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
                No messages yet. Say hello or ask a question below.
              </li>
            ) : (
              (msgData?.messages ?? []).map((m) => (
                <li
                  key={m.id}
                  className={`flex flex-col rounded-2xl px-4 py-3 text-sm ${
                    m.isFromClient
                      ? "ml-4 bg-slate-100 text-slate-800 ring-1 ring-slate-200/80"
                      : "mr-4 bg-gradient-to-br from-[var(--enterprise-primary-soft)] to-white text-slate-800 ring-1 ring-blue-100/80"
                  }`}
                >
                  <div className="text-xs font-medium text-slate-500">
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
                className={`${fieldClass} ${msgSending ? "cursor-wait bg-slate-50/90" : ""}`}
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
                className={`${btnPrimary} shrink-0 self-stretch px-6 py-3 sm:self-auto`}
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
            <p className="mt-4 text-center text-sm text-slate-500">
              Messaging is unavailable for expired proposals.
            </p>
          )}
        </section>
      </main>

      <footer className="mt-4 border-t border-slate-200/80 bg-white/60 px-4 py-8 text-center backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            className="h-5 w-5 shrink-0 opacity-70"
            width={20}
            height={20}
          />
          <p className="text-xs text-slate-500">
            Proposal hosted securely by{" "}
            <span className="font-semibold text-slate-700">PlanSync</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
