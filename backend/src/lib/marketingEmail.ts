import {
  EMAIL_RESPONSIVE_CSS,
  escapeHtml,
  planSyncBrandHeaderHtml,
  planSyncEmailIconPublicUrl,
} from "./transactionalEmailLayout.js";

const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** Inline brand tokens (mirrors enterprise / landing palette). */
const C = {
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  borderSoft: "#edf2f7",
  surface: "#f8fafc",
  blueTint: "#eff6ff",
  blueBorder: "#dbeafe",
  white: "#ffffff",
  pageBg: "#f3f6fb",
} as const;

export const MARKETING_DEMO_VIDEO = {
  id: "7g1qpgmHNg0",
  watchUrl: "https://www.youtube.com/watch?v=7g1qpgmHNg0&t=92s",
  title: "Watch the full workflow",
  subtitle: "PDF upload → takeoff → proposal — on one screen",
} as const;

export const MARKETING_FOUNDER = {
  name: "Abed",
  title: "Founder, PlanSync",
} as const;

/** Core value story: one platform from drawing to bid. */
export const MARKETING_WORKFLOW = [
  {
    step: "1",
    title: "Open the PDF",
    body: "Upload any drawing set — no desktop software or file conversions.",
  },
  {
    step: "2",
    title: "Measure & takeoff",
    body: "Calibrate scale, quantify materials, and mark up issues directly on the sheet.",
  },
  {
    step: "3",
    title: "Send the proposal",
    body: "Build and send a professional bid from the same workspace — no retyping.",
  },
] as const;

export const MARKETING_LINKS = {
  appUrl: "https://plansync.dev",
  signupUrl: "https://plansync.dev/sign-in",
  linkedIn: "https://www.linkedin.com/company/plansyncdev/?viewAsMember=true",
  youtube: MARKETING_DEMO_VIDEO.watchUrl,
  supportEmail: "support@plansync.dev",
} as const;

/** Paths under `frontend/public` — resolved against the marketing app URL (production by default). */
export const MARKETING_IMAGES = {
  measure: "/images/measure.png",
  markup: "/images/markup.png",
} as const;

export const MARKETING_PREVIEW_IMAGES = [
  {
    path: MARKETING_IMAGES.measure,
    alt: "PlanSync PDF viewer with measurement tools",
    caption: "Measure on the drawing",
  },
  {
    path: MARKETING_IMAGES.markup,
    alt: "PlanSync issue pins on a drawing",
    caption: "Markup & takeoff",
  },
] as const;

export const MARKETING_FEATURES = [
  {
    title: "One platform, not five tools",
    body: "Stop exporting measurements to spreadsheets and copying numbers into separate proposal apps.",
  },
  {
    title: "Takeoff tied to the drawing",
    body: "Every quantity stays linked to the sheet it came from — fewer errors, faster reviews.",
  },
  {
    title: "Proposals from your takeoff",
    body: "Turn measured line items into a polished bid without leaving PlanSync.",
  },
  {
    title: "Issues, RFIs & collaboration",
    body: "Pin issues on the plan, run formal RFIs, and keep field and office aligned on the same drawings.",
  },
] as const;

/** Shown in the dark “Your invite” offer banner. */
export const MARKETING_OFFER_PERKS = [
  "Full takeoff & proposals",
  "Unlimited projects",
  "O&M handover & FM",
  "Reply for a walkthrough",
] as const;

/** O&M / facilities — expanded copy for plain-text email. */
export const MARKETING_OM = {
  lead: "PlanSync doesn't stop when construction ends. The same project workspace carries forward into operations — O&M manuals, asset registers, inspections, work orders, and tenant requests stay in one place.",
} as const;

export type MarketingRecipient = {
  email: string;
  company?: string;
  name?: string;
  /** 0-based index in the source spreadsheet rows (for updating `sent`). */
  rowIndex: number;
};

export function marketingPublicAssetUrl(appBase: string, assetPath: string): string {
  return `${appBase.replace(/\/$/, "")}${assetPath.startsWith("/") ? assetPath : `/${assetPath}`}`;
}

function isLocalDevAppUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  } catch {
    return true;
  }
}

/** Public app origin for links and email images — never localhost unless MARKETING_APP_URL is set. */
export function resolveMarketingAppUrl(publicAppUrl?: string): string {
  const explicit = process.env.MARKETING_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const candidate = publicAppUrl?.trim();
  if (candidate && !isLocalDevAppUrl(candidate)) {
    return candidate.replace(/\/$/, "");
  }
  return MARKETING_LINKS.appUrl.replace(/\/$/, "");
}

export function marketingAppDisplayHost(appBase: string): string {
  try {
    const normalized = appBase.startsWith("http") ? appBase : `https://${appBase}`;
    return new URL(normalized).host.replace(/^www\./, "");
  } catch {
    return appBase.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function marketingEmailSubject(): string {
  return "From PDF drawing to sent proposal — 6 months of PlanSync Pro, free";
}

function greeting(recipient: MarketingRecipient): string {
  if (recipient.name?.trim()) return `Hi ${recipient.name.trim()},`;
  if (recipient.company?.trim()) return `Hi ${recipient.company.trim()} team,`;
  return "Hi there,";
}

function founderOpening(recipient: MarketingRecipient): string {
  return `${greeting(recipient)} I'm ${MARKETING_FOUNDER.name}, founder of PlanSync.`;
}

export function buildMarketingEmailText(recipient: MarketingRecipient): string {
  const opening = founderOpening(recipient);
  const features = MARKETING_FEATURES.map((f) => `• ${f.title}: ${f.body}`).join("\n");
  const workflow = MARKETING_WORKFLOW.map((s) => `${s.step}. ${s.title} — ${s.body}`).join("\n");

  return [
    opening,
    "",
    "I'm reaching out personally because I think PlanSync could save your team real time on every bid.",
    "",
    "Most teams still jump between PDF viewers, spreadsheets, email, and proposal tools just to go from a drawing set to a sent bid. PlanSync puts that whole workflow in one place.",
    "",
    "How it works:",
    workflow,
    "",
    "Why teams switch to PlanSync:",
    features,
    "",
    MARKETING_OM.lead,
    "",
    "Your 6-month Pro trial includes:",
    ...MARKETING_OFFER_PERKS.map((p) => `✓ ${p}`),
    "",
    "I'd love for you to try it on a real project — we're offering select companies 6 months of Pro access completely free.",
    "",
    "Start your free trial:",
    MARKETING_LINKS.signupUrl,
    "",
    "Watch a 2-minute demo:",
    MARKETING_DEMO_VIDEO.watchUrl,
    "",
    "Questions? Just reply to this email — I read every message.",
    "",
    `— ${MARKETING_FOUNDER.name}, ${MARKETING_FOUNDER.title}`,
    MARKETING_LINKS.supportEmail,
    "",
    "If you'd prefer not to receive outreach from PlanSync, reply with \"unsubscribe\" and we'll remove you.",
  ].join("\n");
}

function smallPreviewImagesHtml(appBase: string, signInUrl: string): string {
  const cells = MARKETING_PREVIEW_IMAGES.map((img) => {
    const url = marketingPublicAssetUrl(appBase, img.path);
    return `<td width="50%" align="center" class="mkt-stack-col" style="padding:0 8px;vertical-align:top">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.white};border:1px solid ${C.borderSoft};border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:8px 8px 0;line-height:0">
            <a href="${escapeHtml(signInUrl)}" style="text-decoration:none">
              <img src="${escapeHtml(url)}" alt="${escapeHtml(img.alt)}" width="200" style="display:block;width:100%;max-width:200px;height:auto;border-radius:10px;border:1px solid ${C.border};margin:0 auto" />
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 12px 13px;text-align:center">
            <p style="margin:0;font-size:12px;font-weight:650;color:${C.body};font-family:${FF}">${escapeHtml(img.caption)}</p>
          </td>
        </tr>
      </table>
    </td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:460px;margin:0 auto"><tr>${cells}</tr></table>`;
}

export function marketingDemoEmbedUrl(startSeconds = 92, origin?: string): string {
  const params = new URLSearchParams({
    start: String(startSeconds),
    rel: "0",
  });
  if (origin) params.set("origin", origin);
  return `https://www.youtube.com/embed/${MARKETING_DEMO_VIDEO.id}?${params.toString()}`;
}

function videoPlayButtonHtml(size = 80): string {
  const triTop = Math.round(size * 0.19);
  const triLeft = Math.round(size * 0.3);
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center">
    <tr>
      <td align="center" valign="middle" width="${size}" height="${size}" style="width:${size}px;height:${size}px;background:linear-gradient(145deg,${C.primary} 0%,${C.primaryDark} 100%);border-radius:999px;border:4px solid ${C.white};box-shadow:0 0 0 10px rgba(255,255,255,0.2),0 16px 40px rgba(15,23,42,0.55);">
        <table role="presentation" cellspacing="0" cellpadding="0" align="center">
          <tr>
            <td align="center" valign="middle" style="padding-left:5px;line-height:0;font-size:0">
              <span style="display:inline-block;width:0;height:0;border-style:solid;border-width:${triTop}px 0 ${triTop}px ${triLeft}px;border-color:transparent transparent transparent ${C.white};line-height:0;font-size:0">&nbsp;</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function demoVideoHtml(embedInline = false, embedOrigin?: string): string {
  const watchUrl = MARKETING_DEMO_VIDEO.watchUrl;
  const thumb = `https://img.youtube.com/vi/${MARKETING_DEMO_VIDEO.id}/maxresdefault.jpg`;
  const embedSrc = marketingDemoEmbedUrl(92, embedOrigin);

  const player = embedInline
    ? `<tr>
      <td style="padding:0;background:#0f172a">
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;background:#0f172a">
          <iframe src="${escapeHtml(embedSrc)}" title="${escapeHtml(MARKETING_DEMO_VIDEO.title)}" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
      </td>
    </tr>`
    : `<tr>
      <td style="padding:0;line-height:0;background:#0f172a">
        <a href="${escapeHtml(watchUrl)}" style="text-decoration:none;display:block">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:524px;margin:0 auto">
            <tr>
              <td align="center" valign="middle" background="${escapeHtml(thumb)}" bgcolor="#0f172a" height="295" style="background-image:url(${escapeHtml(thumb)});background-size:cover;background-position:center center;height:295px;padding:36px 20px">
                ${videoPlayButtonHtml(80)}
                <p style="margin:16px 0 0;font-size:11px;font-weight:700;color:${C.white};letter-spacing:0.12em;text-transform:uppercase;font-family:${FF}">Play demo</p>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:14px 16px 18px;background:linear-gradient(180deg,#111827 0%,#0f172a 100%)">
        <p style="margin:0;font-size:13px;font-weight:600;color:#e2e8f0;font-family:${FF}">Watch the 2-minute walkthrough on YouTube</p>
        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;font-family:${FF}">
          <a href="${escapeHtml(watchUrl)}" style="color:#93c5fd;text-decoration:none;font-weight:600">Open demo video ↗</a>
        </p>
      </td>
    </tr>`;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:524px;margin:0 auto;border:1px solid ${C.border};border-radius:16px;overflow:hidden;background:${C.ink};box-shadow:0 10px 30px rgba(15,23,42,0.12)">
    <tr>
      <td style="padding:14px 16px 12px;background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-bottom:1px solid rgba(255,255,255,0.08)">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:0.12em;font-family:${FF}">Product demo</p>
        <p style="margin:0;font-size:16px;font-weight:800;color:${C.white};line-height:1.3;letter-spacing:-0.02em;font-family:${FF}">${escapeHtml(MARKETING_DEMO_VIDEO.title)}</p>
        <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;font-family:${FF}">${escapeHtml(MARKETING_DEMO_VIDEO.subtitle)}</p>
      </td>
    </tr>
    ${player}
  </table>`;
}

function workflowStepsHtml(): string {
  const stepCell = (s: (typeof MARKETING_WORKFLOW)[number], showArrow: boolean) =>
    `<td class="mkt-stack-col" style="padding:6px;vertical-align:top;width:33%">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.white};border:1px solid ${C.borderSoft};border-radius:14px;height:100%">
        <tr>
          <td style="padding:16px 14px">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:10px">
              <tr>
                <td align="center" valign="middle" width="28" height="28" style="width:28px;height:28px;background:${C.primary};border-radius:999px;font-size:13px;font-weight:800;color:${C.white};font-family:${FF}">${escapeHtml(s.step)}</td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${C.ink};line-height:1.35;font-family:${FF}">${escapeHtml(s.title)}</p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};font-family:${FF}">${escapeHtml(s.body)}</p>
          </td>
        </tr>
      </table>
    </td>${showArrow ? `<td class="mkt-stack-hide" style="width:20px;padding:0 2px;vertical-align:middle;text-align:center;font-size:16px;color:${C.faint};font-family:${FF}">→</td>` : ""}`;

  const cells = MARKETING_WORKFLOW.map((s, i) =>
    stepCell(s, i < MARKETING_WORKFLOW.length - 1),
  ).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${cells}</tr></table>`;
}

function founderNoteHtml(greet: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.blueTint};border:1px solid ${C.blueBorder};border-left:4px solid ${C.primary};border-radius:14px;margin-bottom:22px">
    <tr>
      <td style="padding:16px 18px">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${C.primary};text-transform:uppercase;letter-spacing:0.1em;font-family:${FF}">Personal note</p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${C.ink};font-family:${FF}"><strong>${escapeHtml(greet)}</strong> I'm ${escapeHtml(MARKETING_FOUNDER.name)}, founder of PlanSync.</p>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.7;color:${C.body};font-family:${FF}">I'm reaching out personally because I think PlanSync could save your team real time on every bid — especially when a PDF drawing lands in your inbox and you need to measure, take off, and send a proposal without juggling five different tools.</p>
      </td>
    </tr>
  </table>`;
}
function featureCardsHtml(): string {
  const featureCell = (f: (typeof MARKETING_FEATURES)[number]) =>
    `<td class="mkt-stack-col" style="padding:6px;width:50%;vertical-align:top">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.surface};border:1px solid ${C.borderSoft};border-radius:14px">
          <tr>
            <td style="padding:16px">
              <p style="margin:0 0 7px;font-size:13px;font-weight:700;color:${C.ink};line-height:1.35;font-family:${FF}">${escapeHtml(f.title)}</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};font-family:${FF}">${escapeHtml(f.body)}</p>
            </td>
          </tr>
        </table>
      </td>`;

  const rows = [];
  for (let i = 0; i < MARKETING_FEATURES.length; i += 2) {
    const left = MARKETING_FEATURES[i]!;
    const right = MARKETING_FEATURES[i + 1];
    rows.push(
      `<tr>${featureCell(left)}${right ? featureCell(right) : `<td class="mkt-stack-col" style="padding:6px;width:50%"></td>`}</tr>`,
    );
  }
  return rows.join("");
}

function offerBannerHtml(): string {
  const perkCells = MARKETING_OFFER_PERKS.map(
    (label, i) =>
      `<td class="mkt-perk" style="padding:${i < MARKETING_OFFER_PERKS.length - 1 ? "0 12px 0 0" : "0"};font-size:12px;line-height:1.5;color:#cbd5e1;font-family:${FF}">✓ ${escapeHtml(label)}</td>`,
  ).join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,${C.ink} 0%,#1e293b 100%);border-radius:18px">
    <tr>
      <td style="padding:22px 24px;text-align:left">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:0.12em;font-family:${FF}">Your invite</p>
        <p class="mkt-offer-title" style="margin:0;font-size:26px;font-weight:800;color:${C.white};line-height:1.12;letter-spacing:-0.03em;font-family:${FF}">6 months of Pro — free</p>
        <p style="margin:8px 0 0;font-size:14px;font-weight:500;color:#dbeafe;line-height:1.5;font-family:${FF}">Run real projects with your team. No credit card required.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px">
          <tr>${perkCells}</tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function headerHtml(iconUrl: string, appUrl: string): string {
  const badge = `<p style="margin:0;font-size:11px;font-weight:700;color:${C.primary};background:${C.blueTint};border:1px solid ${C.blueBorder};border-radius:999px;padding:7px 11px;display:inline-block;font-family:${FF}">Personal invite</p>`;
  return planSyncBrandHeaderHtml(iconUrl, "From drawing to proposal", badge, appUrl);
}

function socialLinksHtml(): string {
  const pill = (href: string, label: string, accent = false) =>
    `<td class="mkt-social-pill" style="padding:4px">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:9px 14px;font-size:12px;font-weight:600;color:${accent ? C.primary : C.ink};text-decoration:none;border:1px solid ${accent ? C.blueBorder : C.border};border-radius:999px;background:${accent ? C.blueTint : C.white};font-family:${FF}">${escapeHtml(label)}</a>
    </td>`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center">
    <tr>
      ${pill(MARKETING_LINKS.linkedIn, "LinkedIn", true)}
      ${pill(MARKETING_LINKS.youtube, "YouTube")}
      ${pill(`mailto:${MARKETING_LINKS.supportEmail}`, "Email us")}
    </tr>
  </table>`;
}

export function buildMarketingEmailHtml(
  recipient: MarketingRecipient,
  opts?: { publicAppUrl?: string; embedVideo?: boolean; previewOrigin?: string },
): string {
  const appBase = resolveMarketingAppUrl(opts?.publicAppUrl);
  const appDisplay = marketingAppDisplayHost(appBase);
  const iconUrl = planSyncEmailIconPublicUrl(appBase);
  const signInUrl = `${appBase}/sign-in`;
  const greet = escapeHtml(greeting(recipient));
  const previewImages = smallPreviewImagesHtml(appBase, signInUrl);
  const embedVideo = opts?.embedVideo === true;
  const demoVideo = demoVideoHtml(embedVideo, embedVideo ? opts?.previewOrigin : undefined);
  const featureCards = featureCardsHtml();
  const offerBanner = offerBannerHtml();
  const header = headerHtml(iconUrl, appBase);
  const founderNote = founderNoteHtml(greet);
  const workflowSteps = workflowStepsHtml();
  const social = socialLinksHtml();
  const founderSignOff = escapeHtml(`${MARKETING_FOUNDER.name}, ${MARKETING_FOUNDER.title}`);
  const previewReferrerMeta = embedVideo
    ? `\n  <meta name="referrer" content="strict-origin-when-cross-origin" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />${previewReferrerMeta}
  <title>From PDF drawing to sent proposal — PlanSync</title>
  <style type="text/css">${EMAIL_RESPONSIVE_CSS}</style>
</head>
<body style="margin:0;padding:0;background:${C.pageBg};font-family:${FF};color:${C.ink};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent">
    A personal note from PlanSync founder Abed — 6 months of Pro free. PDF takeoff, proposals, and O&amp;M handover in one platform.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="mkt-shell" style="background:${C.pageBg};padding:36px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="mkt-card" style="max-width:620px;border-collapse:separate;border-radius:22px;overflow:hidden;background:${C.white};box-shadow:0 24px 60px -24px rgba(15,23,42,0.22),0 0 0 1px rgba(15,23,42,0.04)">
          <tr>
            <td style="padding:0">${header}</td>
          </tr>
          <tr>
            <td class="mkt-section" style="padding:28px 30px 8px;background:${C.white}">
              ${founderNote}
              <h1 class="mkt-title" style="margin:0 0 14px;font-size:27px;font-weight:800;color:${C.ink};line-height:1.18;letter-spacing:-0.04em;font-family:${FF}">From PDF drawing to sent proposal — in one app.</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:${C.body};font-family:${FF}">Most construction teams still bounce between PDF viewers, spreadsheets, email threads, and separate proposal tools just to turn a drawing set into a bid. That handoff costs hours on every project — and mistakes when numbers get copied twice.</p>
              <p style="margin:0;font-size:15px;line-height:1.75;color:${C.body};font-family:${FF}"><strong style="color:${C.ink}">PlanSync is the value:</strong> one workspace where you open the PDF, calibrate scale, run takeoff, mark up issues, and send a professional proposal — without switching apps or retyping quantities. And when the project hands over, the same platform supports O&amp;M — asset registers, inspections, work orders, and facilities management.</p>
            </td>
          </tr>
          <tr>
            <td class="mkt-section" style="padding:8px 30px 24px;background:${C.white}">
              ${offerBanner}
            </td>
          </tr>
          <tr>
            <td class="mkt-section" style="padding:0 24px 24px;background:${C.white}">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.1em;font-family:${FF}">How it works</p>
              ${workflowSteps}
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 28px;background:${C.white}">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.surface};border:1px solid ${C.borderSoft};border-radius:18px">
                <tr>
                  <td style="padding:18px 18px 20px;text-align:center">
                    <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.1em;font-family:${FF}">Inside the app</p>
              ${previewImages}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 28px;background:${C.white};text-align:center">
              ${demoVideo}
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 8px;background:${C.white}">
              <p style="margin:0 6px 16px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.1em;font-family:${FF}">Why teams switch</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${featureCards}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 30px 0;background:${C.white};text-align:center">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td class="mkt-trust" style="padding:0 10px;font-size:12px;color:${C.muted};font-family:${FF}">No credit card required</td>
                  <td class="mkt-trust" style="padding:0 10px;font-size:12px;color:${C.muted};font-family:${FF}">Use real project data</td>
                  <td class="mkt-trust" style="padding:0 10px;font-size:12px;color:${C.muted};font-family:${FF}">Guided walkthrough available</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 30px 30px;background:${C.white};text-align:center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.white};border:1px solid ${C.borderSoft};border-radius:18px">
                <tr>
                  <td style="padding:26px 22px">
                    <p style="margin:0 0 14px;font-size:16px;font-weight:750;color:${C.ink};line-height:1.45;font-family:${FF}">I'd love for you to try it on a real project — free for 6 months.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto">
                      <tr>
                        <td style="border-radius:12px;background:${C.primary}">
                          <a href="${escapeHtml(signInUrl)}" class="mkt-cta-link" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:${C.white};text-decoration:none;border-radius:12px;font-family:${FF}">Start your free 6-month trial</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:${C.muted};font-family:${FF}">Or just reply to this email — I read every message and happy to walk you through it.</p>
                    <p style="margin:16px 0 0;font-size:14px;font-weight:600;color:${C.ink};font-family:${FF}">— ${founderSignOff}</p>
                    <p style="margin:10px 0 0;font-size:13px;font-family:${FF}">
                      <a href="${escapeHtml(appBase)}" style="color:${C.primary};text-decoration:none;font-weight:600">Explore plansync.dev</a>
                      <span style="color:${C.faint}"> · </span>
                      <a href="${escapeHtml(MARKETING_LINKS.youtube)}" style="color:${C.primary};text-decoration:none;font-weight:600">Watch demo</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 26px;background:${C.white};text-align:center">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;font-family:${FF}">Connect with us</p>
              ${social}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 30px 26px;background:${C.surface};border-top:1px solid ${C.borderSoft}">
              <p style="margin:0;font-size:12px;line-height:1.65;color:${C.faint};text-align:center;font-family:${FF}">Questions? Reply to this message or contact ${escapeHtml(MARKETING_LINKS.supportEmail)}.</p>
              <p style="margin:10px 0 0;font-size:11px;line-height:1.55;color:#cbd5e1;text-align:center;font-family:${FF}">If you'd prefer not to receive outreach from PlanSync, reply with "unsubscribe" and we'll remove you.</p>
              <p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;text-align:center;font-family:${FF}">© PlanSync · <a href="${escapeHtml(appBase)}" style="color:#94a3b8;text-decoration:none">${escapeHtml(appDisplay)}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function pickField(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const [rawKey, value] of Object.entries(row)) {
    const key = normalizeHeader(rawKey);
    if (keys.includes(key)) {
      const s = String(value ?? "").trim();
      if (s) return s;
    }
  }
  return undefined;
}

function pickFieldRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const [rawKey, value] of Object.entries(row)) {
    const key = normalizeHeader(rawKey);
    if (keys.includes(key)) return value;
  }
  return undefined;
}

/** True when the sheet marks this row as already emailed. */
export function parseMarketingSentFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "x" || s === "sent";
}

/** Set `sent` to true on the given row indices (mutates copies). */
export function markMarketingRowsSent(
  rows: Record<string, unknown>[],
  rowIndices: number[],
): Record<string, unknown>[] {
  const updated = rows.map((row) => ({ ...row }));
  for (const idx of rowIndices) {
    const row = updated[idx];
    if (row) updated[idx] = { ...row, sent: true };
  }
  return updated;
}

/** Parse rows from Excel/CSV sheet objects (header row keys). */
export function parseMarketingRecipients(rows: Record<string, unknown>[]): {
  recipients: MarketingRecipient[];
  skipped: { row: number; reason: string }[];
  alreadySent: number;
} {
  const recipients: MarketingRecipient[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();
  let alreadySent = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const sentRaw = pickFieldRaw(row, ["sent", "sent?", "emailed", "mail sent"]);
    if (parseMarketingSentFlag(sentRaw)) {
      alreadySent++;
      skipped.push({ row: rowNum, reason: "already sent" });
      return;
    }

    const email =
      pickField(row, ["email", "e-mail", "email address", "work email", "contact email"]) ??
      Object.values(row)
        .map((v) => String(v ?? "").trim())
        .find((v) => EMAIL_RE.test(v));

    if (!email) {
      skipped.push({ row: rowNum, reason: "missing email" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      skipped.push({ row: rowNum, reason: `invalid email: ${email}` });
      return;
    }

    const normalized = email.toLowerCase();
    if (seen.has(normalized)) {
      skipped.push({ row: rowNum, reason: `duplicate: ${email}` });
      return;
    }
    seen.add(normalized);

    recipients.push({
      email: normalized,
      company: pickField(row, ["company", "company name", "organization", "org"]),
      name: pickField(row, ["name", "contact name", "first name", "contact", "full name"]),
      rowIndex: index,
    });
  });

  return { recipients, skipped, alreadySent };
}
