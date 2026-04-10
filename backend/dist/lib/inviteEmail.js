import { faviconUrlFromHostname, normalizeWorkspaceWebsite } from "./workspaceBranding.js";
/** Logo URL, else favicon from workspace website (Google s2 resolver), for email `<img src>`. */
export function resolveWorkspaceEmailLogoUrl(publicAppUrl, logoUrl, website, opts) {
    const appBase = publicAppUrl.replace(/\/$/, "");
    const apiBase = opts?.publicApiUrl?.replace(/\/$/, "") || appBase;
    if (opts?.logoS3Key && opts.workspaceId) {
        return `${apiBase}/api/v1/public/workspaces/${encodeURIComponent(opts.workspaceId)}/logo`;
    }
    const logo = logoUrl?.trim();
    if (logo) {
        if (logo.startsWith("https://") || logo.startsWith("http://"))
            return logo;
        if (logo.startsWith("/api/"))
            return `${apiBase}${logo}`;
        if (logo.startsWith("/"))
            return `${appBase}${logo}`;
        return `${appBase}/${logo}`;
    }
    const site = website?.trim();
    if (site) {
        const n = normalizeWorkspaceWebsite(site);
        if (n.ok)
            return faviconUrlFromHostname(n.hostname);
    }
    return null;
}
function inviteKindDisplay(kind) {
    switch (kind) {
        case "CLIENT":
            return "Client";
        case "CONTRACTOR":
            return "Contractor";
        case "SUBCONTRACTOR":
            return "Subcontractor";
        default:
            return "Team member";
    }
}
function inviteKindBlurb(kind) {
    switch (kind) {
        case "CLIENT":
            return "You’ll use the client portal for the projects listed below.";
        case "CONTRACTOR":
        case "SUBCONTRACTOR":
            return "You’ll collaborate on the projects below with a trade-scoped view where applicable.";
        default:
            return "You’ll join as part of the internal team for this workspace.";
    }
}
/** Absolute http(s) URL for email `<img>`; `/api/*` paths use the API origin. */
function resolveEmailImageUrl(appBase, apiBase, url) {
    if (!url)
        return null;
    const t = url.trim();
    if (t.startsWith("https://") || t.startsWith("http://"))
        return t;
    if (!t.startsWith("/"))
        return null;
    const base = t.startsWith("/api/") ? apiBase.replace(/\/$/, "") : appBase.replace(/\/$/, "");
    return `${base}${t}`;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
export function buildProjectInviteEmailHtml(input) {
    const appBase = input.publicAppUrl.replace(/\/$/, "");
    const apiBase = input.publicApiUrl?.replace(/\/$/, "") || appBase;
    /** Served by the API so images work when `PUBLIC_APP_URL` is only the Next app or only the API. */
    const planSyncIconUrl = `${apiBase}/api/v1/public/brand/email-icon.png`;
    const workspaceResolved = resolveEmailImageUrl(appBase, apiBase, input.workspaceLogoUrl);
    const kind = input.inviteKind ?? "INTERNAL";
    const roleTitle = inviteKindDisplay(kind);
    const roleBlurb = inviteKindBlurb(kind);
    const greetName = input.inviteeName?.trim();
    const company = input.inviteeCompany?.trim();
    const trade = input.trade?.trim();
    const greetingBlock = greetName
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#0f172a">Hi ${escapeHtml(greetName)},</p>`
        : "";
    const accessDetails = [
        `<strong style="color:#0f172a">${escapeHtml(roleTitle)}</strong>`,
    ];
    if (trade)
        accessDetails.push(`Discipline: ${escapeHtml(trade)}`);
    if (company)
        accessDetails.push(`Organization: ${escapeHtml(company)}`);
    const accessBlock = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff6ff;border-radius:14px;border:1px solid #bfdbfe;margin:0 0 4px 0">
    <tr>
      <td style="padding:14px 18px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.06em">Your access</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#334155">${accessDetails.join(" · ")}</p>
        <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#64748b">${escapeHtml(roleBlurb)}</p>
      </td>
    </tr>
  </table>`;
    const workspaceBlock = workspaceResolved
        ? `<img src="${escapeHtml(workspaceResolved)}" alt="" width="64" height="64" style="display:block;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;object-fit:contain;padding:6px" />`
        : `<div style="width:64px;height:64px;border-radius:14px;background:linear-gradient(145deg,#1e293b,#0f172a);color:#ffffff;font:700 20px ${FF};line-height:64px;text-align:center">${escapeHtml(input.workspaceName.slice(0, 2).toUpperCase())}</div>`;
    const inviterResolved = resolveEmailImageUrl(appBase, apiBase, input.inviterImage);
    const inviterAvatar = inviterResolved
        ? `<img src="${escapeHtml(inviterResolved)}" alt="" width="44" height="44" style="border-radius:999px;border:1px solid #e2e8f0;object-fit:cover;display:block" />`
        : `<div style="width:44px;height:44px;border-radius:999px;background:#2563eb;color:#ffffff;font:600 15px ${FF};line-height:44px;text-align:center">${escapeHtml(input.inviterName.slice(0, 1).toUpperCase())}</div>`;
    const projectSection = input.projectNames.length === 0
        ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#64748b">Full access to every project in this workspace.</p>`
        : `<p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Projects</p>
         <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
           ${input.projectNames
            .map((n, i) => `<tr><td style="padding:0 0 ${i < input.projectNames.length - 1 ? "10" : "0"}px 0"><div style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;font-weight:500;color:#0f172a">${escapeHtml(n)}</div></td></tr>`)
            .join("")}
         </table>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Invitation</title>
</head>
<body style="margin:0;padding:0;background:#e8edf3;font-family:${FF}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8edf3;padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border-collapse:separate;border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 25px 50px -12px rgba(15,23,42,0.12),0 0 0 1px rgba(15,23,42,0.04)">
          <!-- Brand: PlanSync logo + wordmark -->
          <tr>
            <td style="background:linear-gradient(160deg,#0f172a 0%,#1e293b 55%,#0f172a 100%);padding:32px 32px 28px;text-align:center">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto">
                <tr>
                  <td style="background:#ffffff;border-radius:16px;padding:14px;box-shadow:0 10px 40px rgba(0,0,0,0.25)">
                    <img src="${escapeHtml(planSyncIconUrl)}" alt="PlanSync" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none" />
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px">
                    <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.03em;line-height:1.2">
                      <span style="color:#f8fafc">Plan</span><span style="color:#3b82f6">Sync</span>
                    </p>
                    <p style="margin:6px 0 0;font-size:12px;font-weight:500;color:#94a3b8;letter-spacing:0.04em;text-transform:uppercase">Construction collaboration</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:28px 32px 8px;background:#ffffff">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Workspace invitation</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25;letter-spacing:-0.02em">Join ${escapeHtml(input.workspaceName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0;background:#ffffff">
              ${greetingBlock}
              ${accessBlock}
            </td>
          </tr>
          <!-- Workspace mark -->
          <tr>
            <td style="padding:16px 32px 0;background:#ffffff">
              <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Workspace</p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:16px">${workspaceBlock}</td>
                  <td style="vertical-align:middle">
                    <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(input.workspaceName)}</p>
                    <p style="margin:6px 0 0;font-size:13px;color:#64748b;line-height:1.5">You’ve been invited to collaborate on this workspace.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Inviter -->
          <tr>
            <td style="padding:24px 32px;background:#ffffff">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0">
                <tr>
                  <td style="padding:16px 18px">
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <tr>
                        <td style="width:52px;vertical-align:middle">${inviterAvatar}</td>
                        <td style="vertical-align:middle;padding-left:14px">
                          <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(input.inviterName)}</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#64748b">Invited you to the team</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Projects -->
          <tr>
            <td style="padding:0 32px 24px;background:#ffffff">
              ${projectSection}
              <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Link expires <span style="color:#64748b">${escapeHtml(input.expiresLabel)}</span></p>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;background:#ffffff;text-align:center">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto">
                <tr>
                  <td style="border-radius:12px;background:#2563eb;box-shadow:0 4px 14px rgba(37,99,235,0.35)">
                    <a href="${escapeHtml(input.joinUrl)}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px">Accept invitation</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center">If you didn’t expect this email, you can safely ignore it.</p>
              <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1;word-break:break-all;text-align:center">${escapeHtml(input.joinUrl)}</p>
              <p style="margin:20px 0 0;font-size:11px;color:#cbd5e1;text-align:center">© PlanSync · Construction collaboration</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
export function buildProjectInviteEmailText(input) {
    const projects = input.projectNames.length === 0
        ? "Projects: full workspace access."
        : `Projects:\n${input.projectNames.map((n) => `- ${n}`).join("\n")}`;
    const kind = input.inviteKind ?? "INTERNAL";
    const lines = [
        "PlanSync — construction collaboration",
        "",
        `You're invited to ${input.workspaceName} on PlanSync`,
        "",
    ];
    const greet = input.inviteeName?.trim();
    if (greet)
        lines.push(`Hi ${greet},`, "");
    lines.push(`Your access: ${inviteKindDisplay(kind)}`);
    if (input.trade?.trim())
        lines.push(`Discipline: ${input.trade.trim()}`);
    if (input.inviteeCompany?.trim())
        lines.push(`Organization: ${input.inviteeCompany.trim()}`);
    lines.push("", inviteKindBlurb(kind), "", `${input.inviterName} invited you (${input.to}).`, "", projects, "", `Accept (expires ${input.expiresLabel}):`, input.joinUrl);
    return lines.join("\n");
}
export function inviteFromAddress(env) {
    return env.RESEND_FROM?.trim() || null;
}
