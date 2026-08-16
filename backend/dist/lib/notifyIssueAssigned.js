import { Resend } from "resend";
import { inviteFromAddress } from "./inviteEmail.js";
import { buildIssueAssignedEmailHtml, buildIssueAssignedEmailText, buildViewerIssuePath, buildViewerIssueUrl, truncatePlain, } from "./issueAssignEmail.js";
import { parseReferencePhotos } from "./issueReferencePhotos.js";
import { prisma } from "./prisma.js";
import { presignGet } from "./s3.js";
import { createUserNotifications } from "./userNotifications.js";
/** Wait for the client to finish uploading the create-time snapshot before notifying. */
const CREATE_ASSIGN_DEFER_MS = 4000;
/** Signed URL lifetime for email/push preview images (S3 IAM max is typically 7 days). */
const PREVIEW_URL_TTL_SEC = 60 * 60 * 24 * 7;
const pendingByIssueId = new Map();
function titleForNotify(title) {
    const t = title.trim() || "Untitled issue";
    return truncatePlain(t, 120);
}
function cancelPendingIssueAssignedNotify(issueId) {
    const pending = pendingByIssueId.get(issueId);
    if (!pending)
        return;
    clearTimeout(pending.handle);
    pendingByIssueId.delete(issueId);
}
/**
 * Defer assign email/push briefly so a create-time reference photo can land first
 * (BIM clash / markup snapshot uploads right after POST /issues).
 */
export function scheduleIssueAssignedNotify(env, issueId, actorUserId, targets) {
    if (!targets.internal && !targets.external)
        return;
    cancelPendingIssueAssignedNotify(issueId);
    const handle = setTimeout(() => {
        pendingByIssueId.delete(issueId);
        void deliverIssueAssignedNotify(env, issueId, actorUserId, targets).catch((e) => console.error("[issue-assign-notify]", e));
    }, CREATE_ASSIGN_DEFER_MS);
    pendingByIssueId.set(issueId, { handle, actorUserId, targets });
}
/** If a create-time notify is waiting, send it now (e.g. first photo just completed). */
export function flushPendingIssueAssignedNotify(env, issueId, actorUserId) {
    const pending = pendingByIssueId.get(issueId);
    if (!pending)
        return;
    const targets = pending.targets;
    cancelPendingIssueAssignedNotify(issueId);
    void deliverIssueAssignedNotify(env, issueId, actorUserId ?? pending.actorUserId, targets).catch((e) => console.error("[issue-assign-notify-flush]", e));
}
async function resolvePreviewImageUrl(env, referencePhotos) {
    const photos = parseReferencePhotos(referencePhotos);
    const first = photos[0];
    if (!first?.s3Key)
        return null;
    try {
        return await presignGet(env, first.s3Key, PREVIEW_URL_TTL_SEC);
    }
    catch (e) {
        console.error("[issue-assign-preview]", e);
        return null;
    }
}
async function sendAssignedEmail(env, input) {
    const key = env.RESEND_API_KEY?.trim();
    const from = inviteFromAddress(env);
    if (!key || !from)
        return;
    const resend = new Resend(key);
    const subjectTitle = input.issueTitle.length > 60 ? `${input.issueTitle.slice(0, 60)}…` : input.issueTitle;
    await resend.emails.send({
        from,
        to: input.to,
        subject: `PlanSync: assigned — ${subjectTitle}`,
        html: buildIssueAssignedEmailHtml(env, input),
        text: buildIssueAssignedEmailText(input),
    });
}
/**
 * Load the issue and notify the requested assignee targets.
 * Includes description, priority, BIM deep link, and first reference photo when available.
 */
// fallow-ignore-next-line complexity
export async function deliverIssueAssignedNotify(env, issueId, actorUserId, targets) {
    cancelPendingIssueAssignedNotify(issueId);
    if (!targets.internal && !targets.external)
        return;
    const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        include: {
            assignee: { select: { id: true, email: true, name: true } },
            file: { select: { name: true } },
            fileVersion: { select: { version: true } },
        },
    });
    if (!issue?.fileId || !issue.fileVersionId || !issue.file || !issue.fileVersion)
        return;
    const actor = actorUserId
        ? await prisma.user.findUnique({
            where: { id: actorUserId },
            select: { name: true },
        })
        : null;
    const assignerName = actor?.name?.trim() || "Someone";
    const viewerParams = {
        issueId: issue.id,
        fileId: issue.fileId,
        fileVersionId: issue.fileVersionId,
        projectId: issue.projectId,
        fileName: issue.file.name,
        version: issue.fileVersion.version,
        bimAnchor: issue.bimAnchor,
    };
    const href = buildViewerIssuePath(viewerParams);
    const viewerUrl = buildViewerIssueUrl(env, viewerParams);
    const contextKind = href.startsWith("/bim-viewer") ? "model" : "drawing";
    const previewImageUrl = await resolvePreviewImageUrl(env, issue.referencePhotos);
    const desc = issue.description?.trim() || null;
    const notifyBody = desc ? `${issue.file.name}\n${truncatePlain(desc, 180)}` : issue.file.name;
    const emailBase = {
        assignerName,
        issueTitle: issue.title,
        fileName: issue.file.name,
        viewerUrl,
        description: desc,
        priority: issue.priority,
        previewImageUrl,
        contextKind,
    };
    if (targets.internal && issue.assigneeId && issue.assignee?.email) {
        void sendAssignedEmail(env, {
            ...emailBase,
            to: issue.assignee.email,
        }).catch((e) => console.error("[issue-email]", e));
        void createUserNotifications({
            workspaceId: issue.workspaceId,
            projectId: issue.projectId,
            recipientUserIds: [issue.assigneeId],
            kind: "ISSUE_ASSIGNED",
            title: `Assigned: ${titleForNotify(issue.title)}`,
            body: notifyBody,
            href,
            actorUserId,
            imageUrl: previewImageUrl,
        }).catch((e) => console.error("[issue-notification]", e));
    }
    const ext = issue.externalAssigneeEmail?.trim();
    if (targets.external && ext) {
        void sendAssignedEmail(env, {
            ...emailBase,
            to: ext,
        }).catch((e) => console.error("[issue-email-external]", e));
    }
}
