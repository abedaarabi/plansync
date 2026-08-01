import { Resend } from "resend";
import type { Env } from "../env.js";
import { inviteFromAddress } from "../inviteEmail.js";
import { prisma } from "../prisma.js";
import { createUserNotifications } from "../userNotifications.js";
import type { BimLoqReport } from "./types.js";
import {
  buildBimModelReadyEmailHtml,
  buildBimModelReadyEmailText,
  buildBimViewerUrl,
  buildProjectFilesUrl,
  buildPublishWizardPath,
} from "./bimModelEmail.js";

/** Completion email only when job ran at least this long (ms). Failures always email. */
const BIM_COMPLETION_EMAIL_MIN_MS = 2 * 60 * 1000;

export type BimNotifyKind =
  | "bim.levels_ready"
  | "bim.geometry_ready"
  | "bim.index_ready"
  | "bim.publish_complete"
  | "bim.conversion_failed"
  | "bim.pdf_ready";

type NotifyContext = {
  env: Env;
  workspaceId: string;
  projectId: string;
  projectName: string;
  fileId: string;
  fileVersionId: string;
  fileName: string;
  versionNumber: number;
  userId: string | null;
  jobStartedAt: Date | null;
  loq?: BimLoqReport | null;
  elementCount?: number;
  errorMessage?: string;
};

async function sendBimEmail(
  env: Env,
  to: string,
  subject: string,
  input: Parameters<typeof buildBimModelReadyEmailHtml>[1],
): Promise<void> {
  const key = env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress(env);
  if (!key || !from) return;

  const resend = new Resend(key);
  await resend.emails.send({
    from,
    to,
    subject,
    html: buildBimModelReadyEmailHtml(env, input),
    text: buildBimModelReadyEmailText(input),
  });
}

function loqOneLiner(loq: BimLoqReport | null | undefined): string | null {
  if (!loq) return null;
  return `${loq.pctQuantities}% of elements have quantities · ${loq.pctLevel}% have levels assigned`;
}

function shouldEmailCompletion(jobStartedAt: Date | null): boolean {
  if (!jobStartedAt) return true;
  return Date.now() - jobStartedAt.getTime() >= BIM_COMPLETION_EMAIL_MIN_MS;
}

export async function notifyBimJobEvent(kind: BimNotifyKind, ctx: NotifyContext): Promise<void> {
  if (!ctx.userId) return;

  const viewerUrl = buildBimViewerUrl(ctx.env, {
    projectId: ctx.projectId,
    fileId: ctx.fileId,
    fileVersionId: ctx.fileVersionId,
    fileName: ctx.fileName,
  });
  const projectFilesUrl = buildProjectFilesUrl(ctx.env, ctx.projectId);
  const publishPath = buildPublishWizardPath(ctx.projectId, ctx.fileVersionId);

  const viewerPath = `/bim-viewer?${new URLSearchParams({
    projectId: ctx.projectId,
    fileId: ctx.fileId,
    fileVersionId: ctx.fileVersionId,
    name: ctx.fileName,
  }).toString()}`;

  const titles: Record<BimNotifyKind, string> = {
    "bim.levels_ready": `Levels ready — ${ctx.fileName}`,
    "bim.geometry_ready": `3D model ready — ${ctx.fileName}`,
    "bim.index_ready": `Model analysis complete — ${ctx.fileName}`,
    "bim.publish_complete": `Model published — ${ctx.fileName}`,
    "bim.conversion_failed": `Model processing failed — ${ctx.fileName}`,
    "bim.pdf_ready": `Drawing ready — ${ctx.fileName}`,
  };

  const bodies: Record<BimNotifyKind, string> = {
    "bim.levels_ready": `${ctx.fileName} — building storeys extracted. Continue publish setup.`,
    "bim.geometry_ready": `${ctx.fileName} — geometry is ready in the BIM viewer.`,
    "bim.index_ready": `${ctx.fileName} — quantity index and analytics are ready.`,
    "bim.publish_complete": `${ctx.fileName} v${ctx.versionNumber} is published.`,
    "bim.conversion_failed": ctx.errorMessage ?? `${ctx.fileName} — conversion failed.`,
    "bim.pdf_ready": `${ctx.fileName} — PDF thumbnail is ready for level registration.`,
  };

  const hrefs: Record<BimNotifyKind, string> = {
    "bim.levels_ready": publishPath,
    "bim.geometry_ready": viewerPath,
    "bim.index_ready": viewerPath,
    "bim.publish_complete": viewerPath,
    "bim.conversion_failed": publishPath,
    "bim.pdf_ready": projectFilesUrl,
  };

  await createUserNotifications({
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    recipientUserIds: [ctx.userId],
    kind,
    title: titles[kind],
    body: bodies[kind],
    href: hrefs[kind],
    actorUserId: ctx.userId,
  });

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { email: true },
  });
  if (!user?.email) return;

  const emailCommon = {
    to: user.email,
    fileName: ctx.fileName,
    projectName: ctx.projectName,
    versionNumber: ctx.versionNumber,
    elementCount: ctx.elementCount ?? 0,
    loqLine: loqOneLiner(ctx.loq),
    viewerUrl,
    publishUrl: projectFilesUrl,
  };

  if (kind === "bim.conversion_failed") {
    await sendBimEmail(ctx.env, user.email, `PlanSync: model failed — ${ctx.fileName}`, {
      ...emailCommon,
      failed: true,
      errorMessage: ctx.errorMessage,
    }).catch((e) => console.error("[bim.email]", e));
    return;
  }

  if (kind === "bim.index_ready" || kind === "bim.geometry_ready") {
    if (!shouldEmailCompletion(ctx.jobStartedAt)) return;
    await sendBimEmail(
      ctx.env,
      user.email,
      `PlanSync: ${ctx.fileName} is ready`,
      emailCommon,
    ).catch((e) => console.error("[bim.email]", e));
  }
}
