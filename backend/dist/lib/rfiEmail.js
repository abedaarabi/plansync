import { Resend } from "resend";
import { inviteFromAddress } from "./inviteEmail.js";
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function excerpt(s, max = 400) {
    const t = s.trim();
    return t.length <= max ? t : `${t.slice(0, max)}…`;
}
export async function sendRfiNotificationEmail(opts) {
    const from = inviteFromAddress(opts.env);
    if (!opts.env.RESEND_API_KEY || !from)
        return;
    const recipients = [...new Set(opts.to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (recipients.length === 0)
        return;
    const resend = new Resend(opts.env.RESEND_API_KEY);
    const base = opts.env.PUBLIC_APP_URL.replace(/\/$/, "");
    const linesHtml = opts.lines.map((l) => `<p style="margin:0 0 8px;color:#334155;font:15px/1.5 Inter,system-ui,sans-serif">${escapeHtml(l)}</p>`).join("");
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f8fafc">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <h1 style="margin:0 0 16px;font:700 20px Inter,system-ui,sans-serif;color:#0f172a">${escapeHtml(opts.heading)}</h1>
    ${linesHtml}
    <p style="margin:20px 0 0"><a href="${escapeHtml(opts.actionUrl)}" style="display:inline-block;background:#2563eb;color:#fff;font:600 14px Inter,system-ui,sans-serif;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(opts.actionLabel)}</a></p>
    <p style="margin:24px 0 0;font:12px Inter,system-ui,sans-serif;color:#94a3b8">${escapeHtml(base)}</p>
  </div></body></html>`;
    const text = `${opts.heading}\n\n${opts.lines.join("\n")}\n\n${opts.actionUrl}`;
    await resend.emails.send({
        from,
        to: recipients,
        subject: opts.subject,
        html,
        text,
    });
}
export function rfiDetailUrl(env, projectId, rfiId) {
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    return `${base}/projects/${encodeURIComponent(projectId)}/rfi/${encodeURIComponent(rfiId)}`;
}
export function buildRfiSentEmailLines(input) {
    return [
        `${input.senderName} sent an RFI for your review.`,
        `RFI #${String(input.rfiNumber).padStart(3, "0")}: ${input.title}`,
        input.dueLabel ? `Due: ${input.dueLabel}` : "No due date set.",
    ];
}
export function buildRfiResponseEmailLines(input) {
    return [
        `${input.responderName} submitted an official response.`,
        `RFI #${String(input.rfiNumber).padStart(3, "0")}: ${input.title}`,
        excerpt(input.responseExcerpt, 500),
    ];
}
export function buildRfiClosedEmailLines(input) {
    return [`${input.closedByName} closed the RFI.`, `RFI #${String(input.rfiNumber).padStart(3, "0")}: ${input.title}`];
}
export function buildRfiReopenedEmailLines(input) {
    return [
        `${input.reopenedByName} reopened the RFI for further review.`,
        `RFI #${String(input.rfiNumber).padStart(3, "0")}: ${input.title}`,
    ];
}
export function buildRfiMessageEmailLines(input) {
    return [
        `${input.authorName} posted a message on the RFI.`,
        `RFI #${String(input.rfiNumber).padStart(3, "0")}: ${input.title}`,
        excerpt(input.bodyExcerpt, 500),
    ];
}
export function buildRfiOverdueEmailLines(input) {
    return [
        "This RFI is overdue.",
        `RFI #${String(input.rfiNumber).padStart(3, "0")}: ${input.title}`,
        `Was due: ${input.dueLabel}`,
    ];
}
