import { Resend } from "resend";
import type { Env } from "./env.js";
import { inviteFromAddress } from "./inviteEmail.js";

/** Throws if API env cannot send mail (call before committing proposal to SENT). */
export function assertProposalEmailReady(env: Env): void {
  if (!env.RESEND_API_KEY?.trim()) {
    throw new Error(
      "Email is not configured: add RESEND_API_KEY to the API environment (see Resend dashboard).",
    );
  }
  if (!inviteFromAddress(env)) {
    throw new Error(
      "Email is not configured: add RESEND_FROM (verified sender in Resend, e.g. onboarding@resend.dev for testing).",
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function proposalPortalUrl(env: Env, token: string): string {
  const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/proposal/${encodeURIComponent(token)}`;
}

export function proposalAppHref(projectId: string, proposalId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`;
}

async function sendMail(opts: {
  env: Env;
  to: string[];
  subject: string;
  heading: string;
  lines: string[];
  /** Optional HTML above heading (e.g. company logo) */
  brandingHtml?: string;
  actionUrl?: string;
  actionLabel?: string;
  attachments?: { filename: string; content: string }[];
}): Promise<void> {
  const from = inviteFromAddress(opts.env);
  if (!opts.env.RESEND_API_KEY?.trim()) {
    throw new Error(
      "Outbound email is not configured: set RESEND_API_KEY (and RESEND_FROM) in the API environment.",
    );
  }
  if (!from) {
    throw new Error(
      "Outbound email is not configured: set RESEND_FROM to a verified sender domain in Resend.",
    );
  }
  const recipients = [...new Set(opts.to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) {
    throw new Error("No valid recipient email addresses.");
  }

  const resend = new Resend(opts.env.RESEND_API_KEY);
  const base = opts.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const linesHtml = opts.lines.map(
    (l) =>
      `<p style="margin:0 0 8px;color:#334155;font:15px/1.5 Inter,system-ui,sans-serif">${escapeHtml(l)}</p>`,
  );
  const actionBlock =
    opts.actionUrl && opts.actionLabel
      ? `<p style="margin:20px 0 0"><a href="${escapeHtml(opts.actionUrl)}" style="display:inline-block;background:#2563eb;color:#fff;font:600 14px Inter,system-ui,sans-serif;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(opts.actionLabel)}</a></p>`
      : "";
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f8fafc">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    ${opts.brandingHtml ?? ""}
    <h1 style="margin:0 0 16px;font:700 20px Inter,system-ui,sans-serif;color:#0f172a">${escapeHtml(opts.heading)}</h1>
    ${linesHtml.join("")}
    ${actionBlock}
    <p style="margin:24px 0 0;font:12px Inter,system-ui,sans-serif;color:#94a3b8">${escapeHtml(base)}</p>
  </div></body></html>`;

  const textParts = [opts.heading, "", ...opts.lines];
  if (opts.actionUrl) textParts.push("", opts.actionUrl);

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
function portalMessageEmailPreview(body: string, maxChars = 500): string {
  const t = body.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1)}…`;
}

export async function sendProposalPortalReplyToClient(opts: {
  env: Env;
  toEmail: string;
  clientName: string;
  reference: string;
  title: string;
  staffName: string;
  messagePreview: string;
  portalUrl: string;
  workspaceLogoUrl?: string | null;
}): Promise<void> {
  const preview = portalMessageEmailPreview(opts.messagePreview);
  const brandingHtml =
    opts.workspaceLogoUrl?.trim() &&
    (opts.workspaceLogoUrl.startsWith("http://") || opts.workspaceLogoUrl.startsWith("https://"))
      ? `<div style="margin:0 0 16px"><img src="${escapeHtml(opts.workspaceLogoUrl.trim())}" alt="" style="max-height:56px;max-width:200px;width:auto;height:auto;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0" /></div>`
      : undefined;
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

export async function sendProposalSentToClient(opts: {
  env: Env;
  toEmail: string;
  clientName: string;
  reference: string;
  title: string;
  senderName: string;
  portalUrl: string;
  /** Absolute URL — shown in email when set */
  workspaceLogoUrl?: string | null;
}): Promise<void> {
  const brandingHtml =
    opts.workspaceLogoUrl?.trim() &&
    (opts.workspaceLogoUrl.startsWith("http://") || opts.workspaceLogoUrl.startsWith("https://"))
      ? `<div style="margin:0 0 16px"><img src="${escapeHtml(opts.workspaceLogoUrl.trim())}" alt="" style="max-height:56px;max-width:200px;width:auto;height:auto;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0" /></div>`
      : undefined;
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

export async function sendProposalViewedToSender(opts: {
  env: Env;
  toEmail: string;
  senderName: string;
  clientName: string;
  reference: string;
  title: string;
  appUrl: string;
}): Promise<void> {
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

export async function sendProposalAcceptedToSender(opts: {
  env: Env;
  toEmail: string;
  senderName: string;
  clientName: string;
  reference: string;
  title: string;
  appUrl: string;
  pdfAttachment?: Buffer;
}): Promise<void> {
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

export async function sendProposalAcceptedToClient(opts: {
  env: Env;
  toEmail: string;
  clientName: string;
  reference: string;
  title: string;
  workspaceName: string;
  /** Proposal owner — used in closing line */
  senderName?: string | null;
  /** Name entered when signing */
  signerName?: string | null;
  /** Absolute URL — shown in email when set */
  workspaceLogoUrl?: string | null;
  /** Optional link back to the client portal page */
  portalUrl?: string | null;
  pdfAttachment: Buffer;
}): Promise<void> {
  const to = opts.toEmail?.trim();
  if (!to) return;
  if (!opts.pdfAttachment?.length) return;

  const sender = opts.senderName?.trim() || "your project team";
  const brandingHtml =
    opts.workspaceLogoUrl?.trim() &&
    (opts.workspaceLogoUrl.startsWith("http://") || opts.workspaceLogoUrl.startsWith("https://"))
      ? `<div style="margin:0 0 16px"><img src="${escapeHtml(opts.workspaceLogoUrl.trim())}" alt="" style="max-height:56px;max-width:200px;width:auto;height:auto;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0" /></div>`
      : undefined;

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

export async function sendProposalDeclinedToSender(opts: {
  env: Env;
  toEmail: string;
  senderName: string;
  clientName: string;
  reference: string;
  title: string;
  reasonLabel: string;
  comment?: string | null;
  appUrl: string;
}): Promise<void> {
  const lines = [
    `Hi ${opts.senderName},`,
    `${opts.clientName} declined your proposal.`,
    `${opts.reference}: ${opts.title}`,
    `Reason: ${opts.reasonLabel}`,
  ];
  if (opts.comment?.trim()) lines.push(`Comments: ${opts.comment.trim()}`);
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

export async function sendProposalChangeRequestedToSender(opts: {
  env: Env;
  toEmail: string;
  senderName: string;
  clientName: string;
  reference: string;
  title: string;
  comment: string;
  appUrl: string;
}): Promise<void> {
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

export async function sendProposalExpiringReminderToSender(opts: {
  env: Env;
  toEmail: string;
  senderName: string;
  reference: string;
  title: string;
  validUntilLabel: string;
  appUrl: string;
}): Promise<void> {
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
