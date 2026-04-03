"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

export function ProposalPortalClient({ token }: { token: string }) {
  const qc = useQueryClient();
  const viewedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

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
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">Loading…</div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-slate-600">Proposal not found.</div>
    );
  }

  const p = data;
  const canAct =
    !p.expired &&
    !done &&
    (p.status === "SENT" || p.status === "VIEWED" || p.status === "CHANGE_REQUESTED");

  const taxAmt = Number(p.taxAmount);

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      <header className="flex items-center justify-center gap-2 border-b border-slate-200 bg-[#0F172A] px-4 py-3 text-center text-sm text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="" className="h-6 w-6 shrink-0" width={24} height={24} />
        <span>
          Powered by <span className="font-semibold">PlanSync</span>
        </span>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-slate-200 p-6 shadow-sm">
          {p.workspaceLogoUrl ? (
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.workspaceLogoUrl}
                alt=""
                className="max-h-14 max-w-[200px] object-contain"
              />
            </div>
          ) : null}
          <div className="text-sm text-slate-500">Proposal</div>
          <div className="text-lg font-semibold">From: {p.workspaceName}</div>
          <div className="mt-2 text-sm text-slate-600">
            Ref: {p.reference} · Valid until:{" "}
            {new Date(p.validUntil).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div className="text-sm text-slate-600">For: {p.clientName}</div>
          {p.expired && (
            <div className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">
              This proposal has expired.
            </div>
          )}
        </div>

        <section
          className="prose prose-sm mt-8 max-w-none border-t border-slate-200 pt-8"
          dangerouslySetInnerHTML={{ __html: p.coverHtml }}
        />

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Breakdown</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[480px] text-sm">
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
                    <td className="px-3 py-2 text-right">{it.quantity}</td>
                    <td className="px-3 py-2">{it.unit}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(it.rate, p.currency)}</td>
                    <td className="px-3 py-2 text-right font-medium">
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
              Tax ({p.taxPercent}%): {fmtMoney(String(taxAmt), p.currency)}
            </div>
            <div>Discount: {fmtMoney(p.discount, p.currency)}</div>
            <div className="text-base font-semibold text-[#2563EB]">
              Total: {fmtMoney(p.total, p.currency)}
            </div>
          </div>
        </section>

        {p.attachments.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Attached drawings</h2>
            <ul className="mt-2 space-y-2">
              {p.attachments.map((a) => (
                <li key={a.fileVersionId}>
                  {a.readUrl ? (
                    <a
                      href={a.readUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#2563EB] underline"
                    >
                      {a.fileName} (v{a.version})
                    </a>
                  ) : (
                    <span className="text-slate-600">
                      {a.fileName} (v{a.version})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {canAct && panel === "none" && (
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => setPanel("accept")}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Accept proposal
            </button>
            <button
              type="button"
              onClick={() => setPanel("decline")}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => setPanel("changes")}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"
            >
              Request changes
            </button>
          </div>
        )}

        {panel === "accept" && canAct && (
          <div className="mt-8 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">Accept</h3>
            <label className="mt-3 block text-sm">
              Full name
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </label>
            <div className="mt-3">
              <div className="text-sm text-slate-600">Signature</div>
              <canvas
                ref={canvasRef}
                width={440}
                height={120}
                className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white touch-none"
              />
              <button
                type="button"
                className="mt-2 text-sm text-slate-600"
                onClick={() => {
                  const cv = canvasRef.current;
                  const ctx = cv?.getContext("2d");
                  if (ctx && cv) {
                    ctx.fillStyle = "#fff";
                    ctx.fillRect(0, 0, cv.width, cv.height);
                  }
                }}
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              disabled={actionBusy !== null}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={async () => {
                const cv = canvasRef.current;
                if (!signerName.trim() || !cv) {
                  toast.error("Name and signature required");
                  return;
                }
                const dataUrl = cv.toDataURL("image/png");
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
          </div>
        )}

        {panel === "decline" && canAct && (
          <div className="mt-8 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">Decline</h3>
            <div className="mt-3 space-y-2">
              {DECLINE.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="dr"
                    checked={declineReason === r.value}
                    onChange={() => setDeclineReason(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <label className="mt-3 block text-sm">
              Comments (optional)
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 p-2"
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={actionBusy !== null}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={async () => {
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
          </div>
        )}

        {panel === "changes" && canAct && (
          <div className="mt-8 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">Request changes</h3>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 p-2"
              rows={4}
              value={changeComment}
              onChange={(e) => setChangeComment(e.target.value)}
              placeholder="What should be adjusted?"
            />
            <button
              type="button"
              disabled={actionBusy !== null}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={async () => {
                if (!changeComment.trim()) {
                  toast.error("Please add a message");
                  return;
                }
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
                "Submit"
              )}
            </button>
          </div>
        )}

        <section className="mt-10 border-t border-slate-200 pt-8">
          <h2 className="text-lg font-semibold">Messages</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(msgData?.messages ?? []).map((m) => (
              <li
                key={m.id}
                className={`rounded-lg px-3 py-2 ${m.isFromClient ? "bg-slate-100" : "bg-blue-50"}`}
              >
                <div className="text-xs text-slate-500">
                  {m.isFromClient ? "You" : "Company"} · {new Date(m.createdAt).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </li>
            ))}
          </ul>
          {!p.expired && (
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Add a message…"
              />
              <button
                type="button"
                disabled={actionBusy !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={async () => {
                  if (!msgBody.trim()) return;
                  setActionBusy("msg");
                  try {
                    await postPublicProposalMessage(token, msgBody.trim());
                    setMsgBody("");
                    qc.invalidateQueries({ queryKey: ["publicProposalMessages", token] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setActionBusy(null);
                  }
                }}
              >
                {actionBusy === "msg" ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          )}
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            className="h-4 w-4 shrink-0 opacity-80"
            width={16}
            height={16}
          />
          <span>
            Powered by <span className="font-semibold text-slate-700">PlanSync</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
