import { Resend } from "resend";
import { inviteFromAddress } from "./inviteEmail.js";
import { buildTransactionalEmailHtml } from "./transactionalEmailLayout.js";
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
    const html = buildTransactionalEmailHtml(opts.env, {
        eyebrow: "RFI",
        title: opts.heading,
        bodyLines: opts.lines,
        primaryAction: { url: opts.actionUrl, label: opts.actionLabel },
        fallbackUrl: opts.actionUrl,
    });
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
    return [
        `${input.closedByName} closed the RFI.`,
        `RFI #${String(input.rfiNumber).padStart(3, "0")}: ${input.title}`,
    ];
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
