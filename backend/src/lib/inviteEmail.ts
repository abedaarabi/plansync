import type { Env } from "./env.js";

type InviteEmailInput = {
  to: string;
  inviterName: string;
  inviterImage: string | null;
  workspaceName: string;
  workspaceLogoUrl: string | null;
  /** App origin (no trailing slash) — used for PlanSync assets and relative workspace logos */
  publicAppUrl: string;
  projectNames: string[];
  joinUrl: string;
  expiresLabel: string;
};

/** Absolute http(s) URL for email clients; supports relative paths from the app. */
function resolvePublicAssetUrl(publicAppUrl: string, url: string | null): string | null {
  if (!url) return null;
  const t = url.trim();
  if (t.startsWith("https://") || t.startsWith("http://")) return t;
  if (t.startsWith("/")) return `${publicAppUrl.replace(/\/$/, "")}${t}`;
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export function buildProjectInviteEmailHtml(input: InviteEmailInput): string {
  const base = input.publicAppUrl.replace(/\/$/, "");
  /** App icon from `public/icons` (same as PWA); PNG loads reliably in email. */
  const planSyncIconUrl = `${base}/icons/icon-192.png`;
  const workspaceResolved = resolvePublicAssetUrl(base, input.workspaceLogoUrl);

  const workspaceBlock = workspaceResolved
    ? `<img src="${escapeHtml(workspaceResolved)}" alt="" width="64" height="64" style="display:block;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;object-fit:contain;padding:6px" />`
    : `<div style="width:64px;height:64px;border-radius:14px;background:linear-gradient(145deg,#1e293b,#0f172a);color:#ffffff;font:700 20px ${FF};line-height:64px;text-align:center">${escapeHtml(input.workspaceName.slice(0, 2).toUpperCase())}</div>`;

  const inviterResolved = resolvePublicAssetUrl(base, input.inviterImage);
  const inviterAvatar = inviterResolved
    ? `<img src="${escapeHtml(inviterResolved)}" alt="" width="44" height="44" style="border-radius:999px;border:1px solid #e2e8f0;object-fit:cover;display:block" />`
    : `<div style="width:44px;height:44px;border-radius:999px;background:#2563eb;color:#ffffff;font:600 15px ${FF};line-height:44px;text-align:center">${escapeHtml(input.inviterName.slice(0, 1).toUpperCase())}</div>`;

  const projectSection =
    input.projectNames.length === 0
      ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#64748b">Full access to every project in this workspace.</p>`
      : `<p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Projects</p>
         <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
           ${input.projectNames
             .map(
               (n, i) =>
                 `<tr><td style="padding:0 0 ${i < input.projectNames.length - 1 ? "10" : "0"}px 0"><div style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;font-weight:500;color:#0f172a">${escapeHtml(n)}</div></td></tr>`,
             )
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
          <!-- Brand: icon only -->
          <tr>
            <td style="background:linear-gradient(160deg,#0f172a 0%,#1e293b 55%,#0f172a 100%);padding:36px 32px 32px;text-align:center">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto">
                <tr>
                  <td style="background:#ffffff;border-radius:16px;padding:14px;box-shadow:0 10px 40px rgba(0,0,0,0.25)">
                    <img src="${escapeHtml(planSyncIconUrl)}" alt="PlanSync" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none" />
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
          <!-- Workspace mark -->
          <tr>
            <td style="padding:8px 32px 0;background:#ffffff">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:16px">${workspaceBlock}</td>
                  <td style="vertical-align:middle">
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">You’ve been invited to collaborate on this workspace.</p>
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

export function buildProjectInviteEmailText(input: InviteEmailInput): string {
  const projects =
    input.projectNames.length === 0
      ? "Projects: full workspace access."
      : `Projects:\n${input.projectNames.map((n) => `- ${n}`).join("\n")}`;
  return `You're invited to ${input.workspaceName} on PlanSync

${input.inviterName} invited you (${input.to}).

${projects}

Accept (expires ${input.expiresLabel}):
${input.joinUrl}
`;
}

export function inviteFromAddress(env: Env): string | null {
  return env.RESEND_FROM?.trim() || null;
}
