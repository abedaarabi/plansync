import type { Env } from "./env.js";

const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** API origin for `/api/v1/public/*` assets (email images); falls back to app URL. */
export function publicApiBaseFromEnv(env: Env): string {
  const app = env.PUBLIC_APP_URL.replace(/\/$/, "");
  return env.PUBLIC_API_URL?.replace(/\/$/, "") || app;
}

/** Same icon as `frontend/public/icons/icon-180.png` — must be an absolute app URL for email clients. */
export function planSyncEmailIconPublicUrl(publicAppUrl: string): string {
  return `${publicAppUrl.replace(/\/$/, "")}/icons/icon-180.png`;
}

export function planSyncEmailIconUrl(env: Env): string {
  return planSyncEmailIconPublicUrl(env.PUBLIC_APP_URL);
}

export type TransactionalEmailContent = {
  /** Small uppercase label above the title */
  eyebrow?: string;
  title: string;
  /** Raw HTML after title (e.g. workspace logo) — must be pre-escaped/safe */
  preBodyHtml?: string;
  /** Plain-text lines rendered as paragraphs */
  bodyLines: string[];
  /** Optional extra safe HTML after body paragraphs */
  extraHtml?: string;
  primaryAction?: { url: string; label: string };
  /** Shown under the CTA for copy-paste clients */
  fallbackUrl?: string;
  footerNote?: string;
};

/**
 * Shared SaaS-style wrapper: PlanSync mark, wordmark, card body, CTA, footer.
 * Use for all transactional mail except the bespoke project-invite template.
 */
export function buildTransactionalEmailHtml(env: Env, content: TransactionalEmailContent): string {
  const appBase = env.PUBLIC_APP_URL.replace(/\/$/, "");
  const iconUrl = planSyncEmailIconUrl(env);
  const eyebrow = content.eyebrow
    ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">${escapeHtml(content.eyebrow)}</p>`
    : "";
  const linesHtml = content.bodyLines
    .filter((l) => l.trim().length > 0)
    .map(
      (l) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#334155;font-family:${FF}">${escapeHtml(l)}</p>`,
    )
    .join("");
  const preBody = content.preBodyHtml ?? "";
  const extra = content.extraHtml ?? "";
  const cta = content.primaryAction
    ? `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto 0"><tr><td style="border-radius:12px;background:#2563eb;box-shadow:0 4px 14px rgba(37,99,235,0.35)"><a href="${escapeHtml(content.primaryAction.url)}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;font-family:${FF}">${escapeHtml(content.primaryAction.label)}</a></td></tr></table>`
    : "";
  const fallback = content.fallbackUrl
    ? `<p style="margin:18px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;word-break:break-all;text-align:center;font-family:${FF}">${escapeHtml(content.fallbackUrl)}</p>`
    : "";
  const footerNote =
    content.footerNote ??
    "If you didn't expect this email, you can safely ignore it. Need help? Reply to this message or contact your workspace admin.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:#e8edf3;font-family:${FF};color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8edf3;padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border-collapse:separate;border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 25px 50px -12px rgba(15,23,42,0.12),0 0 0 1px rgba(15,23,42,0.04)">
          <tr>
            <td style="background:linear-gradient(160deg,#0f172a 0%,#1e293b 55%,#0f172a 100%);padding:32px 32px 28px;text-align:center">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto">
                <tr>
                  <td style="background:#ffffff;border-radius:16px;padding:14px;box-shadow:0 10px 40px rgba(0,0,0,0.25)">
                    <img src="${escapeHtml(iconUrl)}" alt="PlanSync" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none" />
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px">
                    <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.03em;line-height:1.2;font-family:${FF}">
                      <span style="color:#f8fafc">Plan</span><span style="color:#3b82f6">Sync</span>
                    </p>
                    <p style="margin:6px 0 0;font-size:12px;font-weight:500;color:#94a3b8;letter-spacing:0.04em;text-transform:uppercase;font-family:${FF}">Construction collaboration</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;background:#ffffff">
              ${eyebrow}
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;letter-spacing:-0.02em;font-family:${FF}">${escapeHtml(content.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;background:#ffffff">
              ${preBody}
              ${linesHtml}
              ${extra}
              ${cta}
              ${fallback}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;line-height:1.65;color:#94a3b8;text-align:center;font-family:${FF}">${escapeHtml(footerNote)}</p>
              <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1;text-align:center;font-family:${FF}">${escapeHtml(appBase)}</p>
              <p style="margin:14px 0 0;font-size:11px;color:#cbd5e1;text-align:center;font-family:${FF}">© PlanSync</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
