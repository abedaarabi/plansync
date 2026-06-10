import type { Env } from "./env.js";

const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** Inline brand tokens (mirrors enterprise palette). */
const C = {
  primary: "#2563eb",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  borderSoft: "#edf2f7",
  surface: "#f8fafc",
  white: "#ffffff",
  pageBg: "#f3f6fb",
} as const;

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

/** Horizontal logo + wordmark header — shared across transactional & marketing mail. */
export function planSyncBrandHeaderHtml(
  iconUrl: string,
  tagline = "Construction collaboration",
  rightHtml?: string,
  appUrl?: string,
): string {
  const rightCell = rightHtml
    ? `<td align="right" class="email-header-badge" style="vertical-align:middle;padding-left:12px;white-space:nowrap">${rightHtml}</td>`
    : "";
  const brandInner = `<table role="presentation" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background:${C.white};border:1px solid ${C.border};border-radius:12px;padding:5px;box-shadow:0 1px 3px rgba(15,23,42,0.08)">
              <img src="${escapeHtml(iconUrl)}" alt="" width="36" height="36" style="display:block;width:36px;height:36px;max-width:36px;border:0;border-radius:8px" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;font-family:${FF}">
          <span style="color:${C.ink}">Plan</span><span style="color:${C.primary}">Sync</span>
        </p>
        <p style="margin:4px 0 0;font-size:10px;font-weight:650;color:${C.muted};letter-spacing:0.08em;text-transform:uppercase;font-family:${FF}">${escapeHtml(tagline)}</p>
      </td>
    </tr>
  </table>`;
  const brandBlock = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="text-decoration:none;color:inherit">${brandInner}</a>`
    : brandInner;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td class="email-header" style="padding:0;background:${C.white};border-bottom:1px solid ${C.borderSoft}">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,${C.primary} 0%,#3b82f6 100%);font-size:0;line-height:0;mso-line-height-rule:exactly">&nbsp;</td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-header-inner" style="padding:20px 28px">
          <tr>
            <td style="vertical-align:middle">${brandBlock}</td>
            ${rightCell}
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/** Shared responsive rules for transactional + marketing email shells. */
export const EMAIL_RESPONSIVE_CSS = `
  @media only screen and (max-width: 560px) {
    .email-shell, .mkt-shell { padding: 20px 12px !important; }
    .email-card, .mkt-card { border-radius: 16px !important; }
    .email-header-inner { padding: 16px 20px !important; }
    .email-title-wrap, .mkt-section { padding-left: 20px !important; padding-right: 20px !important; }
    .email-title-wrap { padding-top: 24px !important; padding-bottom: 6px !important; }
    .email-body { padding: 6px 20px 24px !important; }
    .email-footer { padding: 18px 20px 22px !important; }
    .email-title, .mkt-title { font-size: 20px !important; }
    .email-cta-link, .mkt-cta-link { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 14px 20px !important; }
    .email-header-badge { display: block !important; text-align: left !important; padding: 10px 0 0 58px !important; white-space: normal !important; }
    .mkt-stack-col { display: block !important; width: 100% !important; max-width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
    .mkt-stack-hide { display: none !important; width: 0 !important; height: 0 !important; overflow: hidden !important; }
    .mkt-perk { display: block !important; padding: 5px 0 !important; }
    .mkt-trust { display: block !important; padding: 6px 0 !important; text-align: center !important; }
    .mkt-offer-title { font-size: 22px !important; }
    .mkt-social-pill { display: block !important; padding: 6px 0 !important; text-align: center !important; }
  }
`;

/**
 * Shared SaaS-style wrapper: PlanSync mark, wordmark, card body, CTA, footer.
 * Use for all transactional mail except the bespoke project-invite template.
 */
export function buildTransactionalEmailHtml(env: Env, content: TransactionalEmailContent): string {
  const appBase = env.PUBLIC_APP_URL.replace(/\/$/, "");
  const iconUrl = planSyncEmailIconUrl(env);
  const header = planSyncBrandHeaderHtml(iconUrl, "Construction collaboration", undefined, appBase);
  const eyebrow = content.eyebrow
    ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;font-family:${FF}">${escapeHtml(content.eyebrow)}</p>`
    : "";
  const linesHtml = content.bodyLines
    .filter((l) => l.trim().length > 0)
    .map(
      (l) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${C.body};font-family:${FF}">${escapeHtml(l)}</p>`,
    )
    .join("");
  const preBody = content.preBodyHtml ?? "";
  const extra = content.extraHtml ?? "";
  const cta = content.primaryAction
    ? `<table role="presentation" cellspacing="0" cellpadding="0" align="center" class="email-cta" style="margin:28px auto 0;width:100%;max-width:320px"><tr><td style="border-radius:12px;background:${C.primary};box-shadow:0 4px 14px rgba(37,99,235,0.28)"><a href="${escapeHtml(content.primaryAction.url)}" class="email-cta-link" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${C.white};text-decoration:none;border-radius:12px;font-family:${FF}">${escapeHtml(content.primaryAction.label)}</a></td></tr></table>`
    : "";
  const fallback = content.fallbackUrl
    ? `<p style="margin:18px 0 0;font-size:11px;line-height:1.5;color:${C.faint};word-break:break-all;text-align:center;font-family:${FF}">${escapeHtml(content.fallbackUrl)}</p>`
    : "";
  const footerNote =
    content.footerNote ??
    "If you didn't expect this email, you can safely ignore it. Need help? Reply to this message or contact your workspace admin.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>${escapeHtml(content.title)}</title>
  <style type="text/css">${EMAIL_RESPONSIVE_CSS}</style>
</head>
<body style="margin:0;padding:0;background:${C.pageBg};font-family:${FF};color:${C.ink};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-shell" style="background:${C.pageBg};padding:36px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-card" style="max-width:520px;border-collapse:separate;border-radius:20px;overflow:hidden;background:${C.white};box-shadow:0 24px 60px -24px rgba(15,23,42,0.18),0 0 0 1px rgba(15,23,42,0.04)">
          <tr>
            <td style="padding:0">${header}</td>
          </tr>
          <tr>
            <td class="email-title-wrap" style="padding:28px 28px 8px;background:${C.white}">
              ${eyebrow}
              <h1 class="email-title" style="margin:0;font-size:22px;font-weight:700;color:${C.ink};line-height:1.3;letter-spacing:-0.02em;font-family:${FF}">${escapeHtml(content.title)}</h1>
            </td>
          </tr>
          <tr>
            <td class="email-body" style="padding:8px 28px 28px;background:${C.white}">
              ${preBody}
              ${linesHtml}
              ${extra}
              ${cta}
              ${fallback}
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding:20px 28px 26px;background:${C.surface};border-top:1px solid ${C.borderSoft}">
              <p style="margin:0;font-size:12px;line-height:1.65;color:${C.faint};text-align:center;font-family:${FF}">${escapeHtml(footerNote)}</p>
              <p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1;text-align:center;font-family:${FF}">${escapeHtml(appBase)}</p>
              <p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;text-align:center;font-family:${FF}">© PlanSync</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
