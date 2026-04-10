import { Resend } from "resend";
import { inviteFromAddress } from "./inviteEmail.js";
import { buildTransactionalEmailHtml, escapeHtml } from "./transactionalEmailLayout.js";
import { resolveWorkspaceLogoUrlForEmail } from "./workspaceLogo.js";
/** Throws if API env cannot send mail (call before committing proposal to SENT). */
export function assertProposalEmailReady(env) {
    if (!env.RESEND_API_KEY?.trim()) {
        throw new Error("Email is not configured: add RESEND_API_KEY to the API environment (see Resend dashboard).");
    }
    if (!inviteFromAddress(env)) {
        throw new Error("Email is not configured: add RESEND_FROM (verified sender in Resend, e.g. onboarding@resend.dev for testing).");
    }
}
function workspaceLogoBrandingHtml(env, workspaceLogoUrl) {
    const abs = resolveWorkspaceLogoUrlForEmail(env, workspaceLogoUrl);
    if (!abs)
        return undefined;
    return `<div style="margin:0 0 16px"><img src="${escapeHtml(abs)}" alt="" style="max-height:56px;max-width:200px;width:auto;height:auto;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0" /></div>`;
}
export function proposalPortalUrl(env, token) {
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    return `${base}/proposal/${encodeURIComponent(token)}`;
}
export function proposalAppHref(projectId, proposalId) {
    return `/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`;
}
async function sendMail(opts) {
    const from = inviteFromAddress(opts.env);
    if (!opts.env.RESEND_API_KEY?.trim()) {
        throw new Error("Outbound email is not configured: set RESEND_API_KEY (and RESEND_FROM) in the API environment.");
    }
    if (!from) {
        throw new Error("Outbound email is not configured: set RESEND_FROM to a verified sender domain in Resend.");
    }
    const recipients = [...new Set(opts.to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (recipients.length === 0) {
        throw new Error("No valid recipient email addresses.");
    }
    const resend = new Resend(opts.env.RESEND_API_KEY);
    const html = buildTransactionalEmailHtml(opts.env, {
        eyebrow: "PlanSync",
        title: opts.heading,
        preBodyHtml: opts.brandingHtml,
        bodyLines: opts.lines,
        primaryAction: opts.actionUrl && opts.actionLabel
            ? { url: opts.actionUrl, label: opts.actionLabel }
            : undefined,
        fallbackUrl: opts.actionUrl,
    });
    const textParts = [opts.heading, "", ...opts.lines];
    if (opts.actionUrl)
        textParts.push("", opts.actionUrl);
    const { error } = await resend.emails.send({
        from,
        to: recipients,
        subject: opts.subject,
        html,
        text: textParts.join("\n"),
        attachments: opts.attachments,
    });
    if (error) {
        throw new Error(error.message || "Resend rejected the email.");
    }
}
/** Short plain-text snippet for notification emails (body is staff/client plain text). */
function portalMessageEmailPreview(body, maxChars = 500) {
    const t = body.trim().replace(/\s+/g, " ");
    if (t.length <= maxChars)
        return t;
    return `${t.slice(0, maxChars - 1)}…`;
}
export async function sendProposalPortalReplyToClient(opts) {
    const preview = portalMessageEmailPreview(opts.messagePreview);
    const brandingHtml = workspaceLogoBrandingHtml(opts.env, opts.workspaceLogoUrl);
    await sendMail({
        env: opts.env,
        to: [opts.toEmail],
        subject: `New reply on proposal ${opts.reference}`,
        heading: "You have a new message",
        brandingHtml,
        lines: [
            `Hi ${opts.clientName},`,
            `${opts.staffName} replied in the message thread for your proposal.`,
            `${opts.reference}: ${opts.title}`,
            preview ? `“${preview}”` : "",
            "Open your proposal link to read the full thread and respond.",
        ].filter(Boolean),
        actionUrl: opts.portalUrl,
        actionLabel: "Open proposal",
    });
}
export async function sendProposalSentToClient(opts) {
    const brandingHtml = workspaceLogoBrandingHtml(opts.env, opts.workspaceLogoUrl);
    await sendMail({
        env: opts.env,
        to: [opts.toEmail],
        subject: `Proposal ${opts.reference} — ${opts.title}`,
        heading: "You have a new proposal",
        brandingHtml,
        lines: [
            `Hi ${opts.clientName},`,
            `${opts.senderName} has sent you a proposal.`,
            `${opts.reference}: ${opts.title}`,
            "Open the link below to review and respond (no account required).",
        ],
        actionUrl: opts.portalUrl,
        actionLabel: "View proposal",
    });
}
export async function sendProposalViewedToSender(opts) {
    await sendMail({
        env: opts.env,
        to: [opts.toEmail],
        subject: `${opts.clientName} viewed ${opts.reference}`,
        heading: "Your proposal was opened",
        lines: [
            `Hi ${opts.senderName},`,
            `${opts.clientName} opened your proposal.`,
            `${opts.reference}: ${opts.title}`,
        ],
        actionUrl: opts.appUrl,
        actionLabel: "Open in PlanSync",
    });
}
export async function sendProposalAcceptedToSender(opts) {
    await sendMail({
        env: opts.env,
        to: [opts.toEmail],
        subject: `Accepted: ${opts.reference}`,
        heading: "Proposal accepted",
        lines: [
            `Hi ${opts.senderName},`,
            `${opts.clientName} accepted your proposal.`,
            `${opts.reference}: ${opts.title}`,
            opts.pdfAttachment ? "A signed PDF is attached." : "",
        ].filter(Boolean),
        actionUrl: opts.appUrl,
        actionLabel: "View in PlanSync",
        attachments: opts.pdfAttachment
            ? [
                {
                    filename: `${opts.reference.replace(/[^a-z0-9-_]/gi, "_")}-signed.pdf`,
                    content: opts.pdfAttachment.toString("base64"),
                },
            ]
            : undefined,
    });
}
export async function sendProposalAcceptedToClient(opts) {
    const to = opts.toEmail?.trim();
    if (!to)
        return;
    if (!opts.pdfAttachment?.length)
        return;
    const sender = opts.senderName?.trim() || "your project team";
    const brandingHtml = workspaceLogoBrandingHtml(opts.env, opts.workspaceLogoUrl);
    const lines = [
        `Hi ${opts.clientName},`,
        `Thank you for accepting and signing. We're pleased to confirm ${opts.title} (reference ${opts.reference}) with ${opts.workspaceName}.`,
        "Your signed agreement is attached as a PDF — please keep it for your records.",
        opts.signerName?.trim() ? `Recorded signature: ${opts.signerName.trim()}` : "",
        `${sender} will follow up if anything else is needed. We look forward to working with you.`,
    ].filter(Boolean);
    await sendMail({
        env: opts.env,
        to: [to],
        subject: `Your signed proposal — ${opts.reference}`,
        heading: "Welcome — thank you for signing",
        brandingHtml,
        lines,
        actionUrl: opts.portalUrl?.trim() ?? undefined,
        actionLabel: opts.portalUrl?.trim() ? "View proposal page" : undefined,
        attachments: [
            {
                filename: `${opts.reference.replace(/[^a-z0-9-_]/gi, "_")}-signed.pdf`,
                content: opts.pdfAttachment.toString("base64"),
            },
        ],
    });
}
export async function sendProposalDeclinedToSender(opts) {
    const lines = [
        `Hi ${opts.senderName},`,
        `${opts.clientName} declined your proposal.`,
        `${opts.reference}: ${opts.title}`,
        `Reason: ${opts.reasonLabel}`,
    ];
    if (opts.comment?.trim())
        lines.push(`Comments: ${opts.comment.trim()}`);
    await sendMail({
        env: opts.env,
        to: [opts.toEmail],
        subject: `Declined: ${opts.reference}`,
        heading: "Proposal declined",
        lines,
        actionUrl: opts.appUrl,
        actionLabel: "Open in PlanSync",
    });
}
export async function sendProposalChangeRequestedToSender(opts) {
    await sendMail({
        env: opts.env,
        to: [opts.toEmail],
        subject: `Changes requested: ${opts.reference}`,
        heading: "Client requested changes",
        lines: [
            `Hi ${opts.senderName},`,
            `${opts.clientName} requested changes to your proposal.`,
            `${opts.reference}: ${opts.title}`,
            opts.comment,
        ],
        actionUrl: opts.appUrl,
        actionLabel: "Open in PlanSync",
    });
}
export async function sendProposalExpiringReminderToSender(opts) {
    await sendMail({
        env: opts.env,
        to: [opts.toEmail],
        subject: `Proposal expiring soon: ${opts.reference}`,
        heading: "Proposal expiring within 48 hours",
        lines: [
            `Hi ${opts.senderName},`,
            `Your sent proposal ${opts.reference} (${opts.title}) expires on ${opts.validUntilLabel}.`,
            "Consider following up with your client.",
        ],
        actionUrl: opts.appUrl,
        actionLabel: "Open in PlanSync",
    });
}
