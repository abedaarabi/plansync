import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { sessionMiddleware } from "../../middleware/session.js";
import { logActivity, logActivitySafe } from "../../lib/activity.js";
import { maybeSendStorageAlerts } from "../../lib/storageAlerts.js";
import {
  DEFAULT_STORAGE_QUOTA_BYTES,
  MAX_WORKSPACE_MEMBERS,
  MAX_WORKSPACE_PROJECTS,
} from "../../config/product.js";
import { isWorkspaceOmBilling, isWorkspacePro } from "../../lib/subscription.js";
import {
  deleteObject,
  getObjectStream,
  presignPut,
  presignGet,
  putObjectBuffer,
} from "../../lib/s3.js";
import type { Env } from "../../lib/env.js";
import { Resend } from "resend";
import {
  ActivityType,
  EmailInviteKind,
  Prisma,
  ProjectMeasurementSystem,
  ProjectMemberRole,
  ProjectStage,
  PunchPriority,
  PunchStatus,
  WorkspaceRole,
} from "@prisma/client";
import { loadProjectWithAuth } from "../../lib/permissions.js";

/** Workspace roles that can manage members, invites, and project-level admin actions. */
const WORKSPACE_MANAGER_ROLES: WorkspaceRole[] = [WorkspaceRole.SUPER_ADMIN, WorkspaceRole.ADMIN];

function isWorkspaceManagerRole(role: WorkspaceRole): boolean {
  return WORKSPACE_MANAGER_ROLES.includes(role);
}

function projectRoleFromInviteKind(kind: EmailInviteKind): ProjectMemberRole {
  switch (kind) {
    case EmailInviteKind.CLIENT:
      return ProjectMemberRole.CLIENT;
    case EmailInviteKind.CONTRACTOR:
      return ProjectMemberRole.CONTRACTOR;
    case EmailInviteKind.SUBCONTRACTOR:
      return ProjectMemberRole.SUBCONTRACTOR;
    default:
      return ProjectMemberRole.INTERNAL;
  }
}
import {
  mergeProjectSettingsPatch,
  parseProjectCurrency,
  parseProjectSettingsJson,
} from "../../lib/projectSettings.js";
import {
  fileVersionJson,
  projectDetailApiJson,
  projectRowJson,
  projectTreeJson,
  workspaceJson,
} from "../../lib/json.js";
import {
  cloneSettingsJson,
  mergeTakeoffPricingIntoSettingsJson,
} from "../../lib/takeoffPricing.js";
import {
  buildUploadObjectKey,
  folderKeyFromFolderId,
  newUploadId,
  s3KeyMatchesFileUpload,
  upsertFileForUpload,
} from "../../lib/fileUpload.js";
import { resolvedMimeType } from "../../lib/mime.js";
import { findBestUploadMatch } from "../../lib/uploadMatch.js";
import {
  deleteFileFromS3AndDb,
  deleteFolderTreeFromDbAndS3,
} from "../../lib/deleteProjectAssets.js";
import { deleteAllWorkspaceS3Objects } from "../../lib/deleteWorkspaceS3.js";
import { logoUrlFromWebsiteUrl, normalizeWebsiteUrl } from "../../lib/websiteUrl.js";
import { fileVersionPublicSelect, viewerStatePutSchema } from "../../lib/viewerState.js";
import {
  faviconUrlFromHostname,
  isGoogleFaviconUrl,
  normalizeWorkspaceWebsite,
} from "../../lib/workspaceBranding.js";
import { apiPublicOrigin, workspaceLogoUrlForClients } from "../../lib/workspaceLogo.js";
import { getEmailBrandIconPngBytes } from "../../lib/emailBrandIcon.js";
import { registerMaterialsRoutes } from "./materialsRoutes.js";
import { registerIssuesRoutes } from "./issuesRoutes.js";
import { registerOmRoutes, registerOccupantPublicRoutes } from "./omRoutes.js";
import { runOmMaintenanceReminders } from "../../lib/omMaintenanceReminders.js";
import { registerRfiRoutes } from "./rfiRoutes.js";
import { registerTakeoffRoutes } from "./takeoffRoutes.js";
import { registerProposalRoutes } from "./proposalRoutes.js";
import { registerSheetAiRoutes } from "./sheetAiRoutes.js";
import { registerCloudRoutes } from "./cloudRoutes.js";
import { registerPunchRoutes } from "./punchRoutes.js";
import { registerScheduleRoutes } from "./scheduleRoutes.js";
import {
  auditLogsToRows,
  buildAuditPdfBuffer,
  buildAuditXlsxBuffer,
} from "../../lib/projectAuditExport.js";
import { formatAuditPresentation } from "../../lib/auditFormat.js";
import { fetchProjectAuditLogs } from "../../lib/projectAuditQuery.js";
import { createNodeWebSocket } from "@hono/node-ws";
import {
  allowSseConnect,
  broadcastIssuesChanged,
  broadcastViewerState,
  buildViewerCollabWsHandler,
  collabMetrics,
  disconnectViewerCollabSse,
  endViewerCollabSession,
  getCollabMetricsSnapshot,
  registerSseConnection,
  touchHeartbeat,
  unregisterSseConnection,
} from "../../lib/viewerCollabHub.js";
import {
  collaborationEnabledForWorkspace,
  collaborationGloballyEnabled,
} from "../../lib/viewerCollabPolicy.js";
import { loadProjectForMember, isProjectScopedMember } from "../../lib/projectAccess.js";
import {
  applyFolderStructureFromTemplate,
  copyFolderStructureBetweenProjects,
} from "../../lib/applyFolderStructure.js";
import { parseFolderTreeFromJson } from "../../lib/folderStructureTemplate.js";
import { buildProjectTeamMembers } from "../../lib/projectTeamMembers.js";

type ViewerCollabUpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];
import {
  buildProjectInviteEmailHtml,
  buildProjectInviteEmailText,
  inviteFromAddress,
  resolveWorkspaceEmailLogoUrl,
  type InviteEmailKind,
} from "../../lib/inviteEmail.js";

function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

function requirePro(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspacePro(workspace)) {
    return { error: "Pro subscription required", status: 402 as const };
  }
  return null;
}

/** Unaccepted invites block `POST .../email-invites`; revoke when membership ends or user is added another way. */
async function revokePendingEmailInvitesForWorkspaceEmail(
  db: Pick<typeof prisma, "emailInvite">,
  workspaceId: string,
  rawEmail: string,
) {
  const email = rawEmail.toLowerCase().trim();
  await db.emailInvite.updateMany({
    where: {
      workspaceId,
      email,
      revokedAt: null,
      acceptedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

async function logFileOpenedActivity(
  file: {
    id: string;
    name: string;
    projectId: string;
    project: {
      workspaceId: string;
      workspace: { subscriptionStatus: string | null };
    };
  },
  userId: string,
  parsed: { fileVersionId?: string; version?: number },
): Promise<{ ok: true } | { error: string; status: number }> {
  const access = await loadProjectForMember(file.projectId, userId);
  if ("error" in access) return { error: access.error, status: access.status };
  const gate = requirePro(access.project.workspace);
  if (gate) return { error: gate.error, status: gate.status };
  await logActivitySafe(access.project.workspaceId, ActivityType.FILE_OPENED, {
    actorUserId: userId,
    entityId: file.id,
    projectId: file.projectId,
    metadata: {
      fileId: file.id,
      fileName: file.name,
      ...(parsed.version != null ? { version: parsed.version } : {}),
      ...(parsed.fileVersionId ? { fileVersionId: parsed.fileVersionId } : {}),
    },
  });
  await prisma.file.update({
    where: { id: file.id },
    data: { lastOpenedAt: new Date() },
  });
  return { ok: true };
}

async function countSeatPressure(workspaceId: string): Promise<number> {
  const now = new Date();
  const [members, linkInvites, emailInvites] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId, isExternal: false } }),
    prisma.workspaceInvite.count({
      where: { workspaceId, revokedAt: null, expiresAt: { gt: now } },
    }),
    prisma.emailInvite.count({
      where: { workspaceId, revokedAt: null, acceptedAt: null, expiresAt: { gt: now } },
    }),
  ]);
  return members + linkInvites + emailInvites;
}

export function v1Routes(
  auth: {
    api: {
      getSession: (o: {
        headers: Headers;
        query?: { disableCookieCache?: boolean };
      }) => Promise<unknown>;
    };
  },
  env: Env,
  deps?: {
    upgradeWebSocket?: ViewerCollabUpgradeWebSocket;
  },
) {
  const r = new Hono();
  const needUser = sessionMiddleware(auth);
  /** Invite accept must run before `emailVerified` is flipped; all other routes use `needUser`. */
  const needUserForInviteAccept = sessionMiddleware(auth, { requireEmailVerified: false });

  r.get("/health", (c) => c.json({ ok: true }));

  /** Public: workspace logo (S3 upload or redirect to external `logoUrl`). Cached briefly for proposals / emails. */
  r.get("/public/workspaces/:workspaceId/logo", async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { logoS3Key: true, logoUrl: true },
    });
    if (!ws) return c.body(null, 404);
    if (ws.logoS3Key) {
      const st = await getObjectStream(env, ws.logoS3Key);
      if (!st.ok) return c.body(null, 404);
      const ext = ws.logoS3Key.split(".").pop()?.toLowerCase();
      const fallbackCt =
        ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "webp"
              ? "image/webp"
              : ext === "gif"
                ? "image/gif"
                : "application/octet-stream";
      return new Response(st.stream, {
        headers: {
          "Content-Type": st.contentType || fallbackCt,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
    const ext = ws.logoUrl?.trim();
    if (ext?.startsWith("http")) return c.redirect(ext, 302);
    return c.body(null, 404);
  });

  /** Public: PlanSync mark (PNG). Prefer `PUBLIC_APP_URL/icons/icon-180.png` in new email HTML. */
  r.get("/public/brand/email-icon.png", (c) => {
    const buf = getEmailBrandIconPngBytes();
    if (!buf?.length) return c.body(null, 404);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800",
      },
    });
  });

  /** Public: validate invite token for join page (no auth). */
  r.get("/invites/:token", async (c) => {
    const token = c.req.param("token")!;
    const inv = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });
    if (!inv || inv.revokedAt) {
      return c.json({ valid: false, reason: "invalid" as const });
    }
    if (inv.expiresAt < /* @__PURE__ */ new Date()) {
      return c.json({ valid: false, reason: "expired" as const });
    }
    const ws = inv.workspace;
    return c.json({
      valid: true,
      workspace: {
        name: ws.name,
        slug: ws.slug,
        logoUrl: workspaceLogoUrlForClients(env, {
          id: ws.id,
          logoS3Key: ws.logoS3Key,
          logoUrl: ws.logoUrl,
        }),
        description: ws.description,
        website: ws.website,
      },
    });
  });

  /** Public: validate email invite token (join page). */
  r.get("/email-invites/:token", async (c) => {
    const token = c.req.param("token")!;
    const inv = await prisma.emailInvite.findUnique({
      where: { token },
      include: {
        workspace: true,
        invitedBy: { select: { name: true, image: true, email: true } },
        projects: { include: { project: { select: { id: true, name: true } } } },
      },
    });
    if (!inv || inv.revokedAt) {
      return c.json({ valid: false, reason: "invalid" as const });
    }
    if (inv.expiresAt < /* @__PURE__ */ new Date()) {
      return c.json({ valid: false, reason: "expired" as const });
    }
    if (inv.acceptedAt) {
      return c.json({ valid: false, reason: "used" as const });
    }
    const ws = inv.workspace;
    return c.json({
      valid: true,
      kind: "email" as const,
      inviteEmail: inv.email,
      role: inv.role,
      workspace: {
        name: ws.name,
        slug: ws.slug,
        logoUrl: workspaceLogoUrlForClients(env, {
          id: ws.id,
          logoS3Key: ws.logoS3Key,
          logoUrl: ws.logoUrl,
        }),
        description: ws.description,
        website: ws.website,
      },
      inviter: {
        name: inv.invitedBy.name,
        image: inv.invitedBy.image,
        email: inv.invitedBy.email,
      },
      projects: inv.projects.map((p) => p.project),
    });
  });

  r.post("/invites/:token/accept", needUserForInviteAccept, async (c) => {
    const token = c.req.param("token")!;
    const userId = c.get("user").id;
    const inv = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });
    if (!inv || inv.revokedAt) return c.json({ error: "Invalid invite" }, 400);
    if (inv.expiresAt < /* @__PURE__ */ new Date()) return c.json({ error: "Invite expired" }, 400);

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    const gate = requirePro(inv.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
    });
    if (existing) {
      return c.json({
        ok: true,
        alreadyMember: true,
        workspace: workspaceJson(inv.workspace, env),
      });
    }

    const count = await prisma.workspaceMember.count({ where: { workspaceId: inv.workspaceId } });
    if (count >= MAX_WORKSPACE_MEMBERS) {
      return c.json({ error: "Workspace is full" }, 400);
    }

    await prisma.workspaceMember.create({
      data: {
        workspaceId: inv.workspaceId,
        userId,
        role: WorkspaceRole.MEMBER,
      },
    });
    await logActivity(inv.workspaceId, ActivityType.MEMBER_INVITED, {
      actorUserId: userId,
      entityId: userId,
      metadata: { via: "invite_link" },
    });
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: inv.workspaceId } });
    return c.json({ ok: true, workspace: workspaceJson(ws, env) });
  });

  r.post("/email-invites/:token/accept", needUserForInviteAccept, async (c) => {
    const token = c.req.param("token")!;
    const userId = c.get("user").id;
    const user = c.get("user");
    const inv = await prisma.emailInvite.findUnique({
      where: { token },
      include: {
        workspace: true,
        projects: { select: { projectId: true } },
      },
    });
    if (!inv || inv.revokedAt) return c.json({ error: "Invalid invite" }, 400);
    if (inv.expiresAt < /* @__PURE__ */ new Date()) return c.json({ error: "Invite expired" }, 400);
    if (inv.acceptedAt) return c.json({ error: "Invite already used" }, 400);

    const gate = requirePro(inv.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (user.email.toLowerCase().trim() !== inv.email.toLowerCase().trim()) {
      return c.json({ error: `Sign in as ${inv.email} to accept this invite.` }, 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
    });

    const ext = inv.inviteKind !== EmailInviteKind.INTERNAL;
    const pr = projectRoleFromInviteKind(inv.inviteKind);

    if (existing) {
      if (inv.projects.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const p of inv.projects) {
            await tx.projectMember.upsert({
              where: {
                projectId_userId: { projectId: p.projectId, userId },
              },
              create: {
                projectId: p.projectId,
                userId,
                projectRole: pr,
                trade: inv.trade,
              },
              update: { projectRole: pr, trade: inv.trade },
            });
          }
          if (ext) {
            await tx.workspaceMember.update({
              where: { id: existing.id },
              data: { isExternal: true },
            });
          }
          await tx.emailInvite.update({
            where: { id: inv.id },
            data: { acceptedAt: /* @__PURE__ */ new Date() },
          });
        });
      } else {
        await prisma.emailInvite.update({
          where: { id: inv.id },
          data: { acceptedAt: /* @__PURE__ */ new Date() },
        });
      }
      const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: inv.workspaceId } });
      return c.json({ ok: true, alreadyMember: true, workspace: workspaceJson(ws, env) });
    }

    if (!ext) {
      const count = await prisma.workspaceMember.count({
        where: { workspaceId: inv.workspaceId, isExternal: false },
      });
      if (count >= MAX_WORKSPACE_MEMBERS) {
        return c.json({ error: "Workspace is full" }, 400);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data: {
          workspaceId: inv.workspaceId,
          userId,
          role: inv.role,
          isExternal: ext,
        },
      });
      if (inv.projects.length > 0) {
        await tx.projectMember.createMany({
          data: inv.projects.map((p) => ({
            projectId: p.projectId,
            userId,
            projectRole: pr,
            trade: inv.trade,
          })),
          skipDuplicates: true,
        });
      }
      await tx.emailInvite.update({
        where: { id: inv.id },
        data: { acceptedAt: /* @__PURE__ */ new Date() },
      });
    });

    await logActivity(inv.workspaceId, ActivityType.MEMBER_INVITED, {
      actorUserId: userId,
      entityId: userId,
      metadata: { via: "email_invite", email: inv.email },
    });
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: inv.workspaceId } });
    return c.json({ ok: true, workspace: workspaceJson(ws, env) });
  });

  r.get("/me", needUser, async (c) => {
    const user = c.get("user");
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { hideViewerPresence: true },
    });
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);
    const projectCounts =
      workspaceIds.length > 0
        ? await prisma.project.groupBy({
            by: ["workspaceId"],
            where: { workspaceId: { in: workspaceIds } },
            _count: { _all: true },
          })
        : [];
    const projectCountByWorkspace = new Map(
      projectCounts.map((row) => [row.workspaceId, row._count._all]),
    );
    return c.json({
      user: { ...user, hideViewerPresence: dbUser?.hideViewerPresence ?? false },
      workspaces: memberships.map((m) => ({
        workspaceId: m.workspaceId,
        role: m.role,
        isExternal: m.isExternal,
        seatEligible: !m.isExternal,
        workspace: workspaceJson(m.workspace, env),
        projectCount: projectCountByWorkspace.get(m.workspaceId) ?? 0,
        maxProjects: MAX_WORKSPACE_PROJECTS,
      })),
    });
  });

  r.get("/me/notifications", needUser, async (c) => {
    const userId = c.get("user").id;
    const limitRaw = c.req.query("limit");
    const limit = Math.min(50, Math.max(1, limitRaw ? Number(limitRaw) || 30 : 30));
    const [items, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { actor: { select: { id: true, name: true, email: true, image: true } } },
      }),
      prisma.userNotification.count({ where: { userId, readAt: null } }),
    ]);
    return c.json({
      unreadCount,
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
        actor: n.actor,
      })),
    });
  });

  r.patch("/me/notifications/read", needUser, async (c) => {
    const body = z
      .object({ ids: z.array(z.string()).min(1).max(100) })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const userId = c.get("user").id;
    const result = await prisma.userNotification.updateMany({
      where: { userId, id: { in: body.data.ids }, readAt: null },
      data: { readAt: new Date() },
    });
    return c.json({ updated: result.count });
  });

  r.post("/me/notifications/read-all", needUser, async (c) => {
    const userId = c.get("user").id;
    await prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return c.json({ ok: true });
  });

  r.patch("/me/viewer-presence", needUser, async (c) => {
    const body = z
      .object({ hideViewerPresence: z.boolean() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const userId = c.get("user").id;
    await prisma.user.update({
      where: { id: userId },
      data: { hideViewerPresence: body.data.hideViewerPresence },
    });
    return c.json({ ok: true as const, hideViewerPresence: body.data.hideViewerPresence });
  });

  r.post("/workspaces", needUser, async (c) => {
    const body = z
      .object({ name: z.string().min(1), slug: z.string().min(2) })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const baseSlug = body.data.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    const fallbackSlug = `workspace-${randomBytes(3).toString("hex")}`;
    let candidate = baseSlug || fallbackSlug;
    let ws: Awaited<ReturnType<typeof prisma.workspace.create>> | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const slug =
        attempt === 0 ? candidate : `${candidate}-${randomBytes(2).toString("hex")}`.slice(0, 60);
      try {
        ws = await prisma.workspace.create({
          data: {
            name: body.data.name,
            slug,
            storageQuotaBytes: DEFAULT_STORAGE_QUOTA_BYTES,
            // Every new workspace starts with a 14-day full Pro trial.
            subscriptionStatus: "trialing",
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            members: {
              create: { userId: c.get("user").id, role: WorkspaceRole.SUPER_ADMIN },
            },
          },
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          Array.isArray(err.meta?.target) &&
          err.meta.target.includes("slug")
        ) {
          continue;
        }
        throw err;
      }
    }
    if (!ws) return c.json({ error: "Could not create workspace slug. Try again." }, 409);
    await logActivity(ws.id, ActivityType.WORKSPACE_CREATED, {
      actorUserId: c.get("user").id,
      entityId: ws.id,
    });
    return c.json(workspaceJson(ws, env));
  });

  r.get("/workspaces/:workspaceId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id },
      include: { workspace: true },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    return c.json(workspaceJson(m.workspace, env));
  });

  r.patch("/workspaces/:workspaceId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: WorkspaceRole.SUPER_ADMIN },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);

    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        slug: z.string().min(2).max(64).optional(),
        logoUrl: z
          .union([z.string().max(65535), z.literal("")])
          .nullable()
          .optional(),
        description: z
          .union([z.string().max(2000), z.literal("")])
          .nullable()
          .optional(),
        website: z
          .union([z.string().max(2048), z.literal("")])
          .nullable()
          .optional(),
        primaryColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        viewerCollaborationEnabled: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const p = body.data;
    const prev = admin.workspace;

    let nextWebsite: string | null | undefined;
    if (p.website !== undefined) {
      const raw = p.website;
      if (raw === null || raw === "") {
        nextWebsite = null;
      } else {
        const n = normalizeWorkspaceWebsite(String(raw));
        if (!n.ok) return c.json({ error: n.message }, 400);
        nextWebsite = n.url;
      }
    }

    let nextLogo: string | null | undefined;
    if (p.logoUrl !== undefined) {
      nextLogo = p.logoUrl === "" || p.logoUrl === null ? null : p.logoUrl.trim();
    }

    const data: {
      name?: string;
      slug?: string;
      logoUrl?: string | null;
      logoS3Key?: string | null;
      description?: string | null;
      website?: string | null;
      primaryColor?: string;
      viewerCollaborationEnabled?: boolean;
    } = {};
    if (p.name !== undefined) data.name = p.name;
    if (p.slug !== undefined) {
      const slug = p.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const clash = await prisma.workspace.findFirst({
        where: { slug, NOT: { id: workspaceId } },
      });
      if (clash) return c.json({ error: "Slug already taken" }, 400);
      data.slug = slug;
    }
    if (p.description !== undefined) data.description = p.description === "" ? null : p.description;
    if (nextWebsite !== undefined) data.website = nextWebsite;
    if (p.primaryColor !== undefined) data.primaryColor = p.primaryColor;
    if (p.viewerCollaborationEnabled !== undefined) {
      data.viewerCollaborationEnabled = p.viewerCollaborationEnabled;
    }

    const shouldSyncLogo = p.website !== undefined || p.logoUrl !== undefined;
    if (shouldSyncLogo) {
      const finalWebsite = nextWebsite !== undefined ? nextWebsite : prev.website;
      const finalLogoCandidate = nextLogo !== undefined ? nextLogo : prev.logoUrl;
      if (finalWebsite) {
        const host = new URL(finalWebsite).hostname;
        const derived = faviconUrlFromHostname(host);
        if (!finalLogoCandidate) {
          data.logoUrl = derived;
          data.logoS3Key = null;
        } else if (isGoogleFaviconUrl(finalLogoCandidate)) {
          data.logoUrl = derived;
          data.logoS3Key = null;
        } else {
          data.logoUrl = finalLogoCandidate;
          data.logoS3Key = null;
        }
      } else if (nextLogo !== undefined) {
        data.logoUrl = nextLogo;
        data.logoS3Key = null;
      }
    }

    if (Object.keys(data).length === 0) return c.json({ error: "No changes" }, 400);

    const ws = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
    return c.json(workspaceJson(ws, env));
  });

  r.delete("/workspaces/:workspaceId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: WorkspaceRole.SUPER_ADMIN },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);

    const body = z
      .object({ confirmWorkspaceName: z.string().min(1).max(200) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    if (body.data.confirmWorkspaceName.trim() !== admin.workspace.name.trim()) {
      return c.json({ error: "Confirmation name must match the workspace name exactly." }, 400);
    }

    if (env.STRIPE_SECRET_KEY && admin.workspace.stripeSubscriptionId) {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      try {
        await stripe.subscriptions.cancel(admin.workspace.stripeSubscriptionId);
      } catch (e: unknown) {
        const code =
          e &&
          typeof e === "object" &&
          "code" in e &&
          typeof (e as { code: unknown }).code === "string"
            ? (e as { code: string }).code
            : "";
        const msg =
          e &&
          typeof e === "object" &&
          "message" in e &&
          typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "";
        if (code !== "resource_missing" && !/canceled|cancelled/i.test(msg)) {
          console.error("[workspaces] Stripe subscription cancel before delete", e);
          return c.json(
            {
              error:
                "Could not cancel the Stripe subscription. Cancel billing in Stripe first, then try again.",
            },
            502,
          );
        }
      }
    }

    try {
      await deleteAllWorkspaceS3Objects(env, workspaceId);
    } catch (e) {
      console.error("[workspaces] S3 cleanup before delete", e);
      return c.json({ error: "Could not remove stored files for this workspace." }, 500);
    }

    try {
      await prisma.workspace.delete({ where: { id: workspaceId } });
    } catch (e) {
      console.error("[workspaces] delete", e);
      return c.json({ error: "Could not delete workspace." }, 500);
    }

    return c.json({ ok: true as const });
  });

  r.post(
    "/workspaces/:workspaceId/logo",
    needUser,
    bodyLimit({
      maxSize: 3 * 1024 * 1024,
      onError: (c) => c.json({ error: "Payload too large" }, 413),
    }),
    async (c) => {
      const workspaceId = c.req.param("workspaceId")!;
      const admin = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: c.get("user").id, role: WorkspaceRole.SUPER_ADMIN },
      });
      if (!admin) return c.json({ error: "Forbidden" }, 403);
      let parsed: Record<string, string | File>;
      try {
        parsed = await c.req.parseBody();
      } catch {
        return c.json({ error: "Invalid multipart body" }, 400);
      }
      const raw = parsed["file"];
      const file = Array.isArray(raw) ? raw[0] : raw;
      if (!file || typeof file === "string" || !(file instanceof File)) {
        return c.json({ error: "Missing file" }, 400);
      }
      if (file.size > 2 * 1024 * 1024) {
        return c.json({ error: "Logo must be 2 MB or smaller" }, 413);
      }
      const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
      let ct = (file.type || "").trim().toLowerCase();
      if (ct === "image/jpg") ct = "image/jpeg";
      if (!ct || ct === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "png") ct = "image/png";
        else if (ext === "jpg" || ext === "jpeg") ct = "image/jpeg";
        else if (ext === "webp") ct = "image/webp";
        else if (ext === "gif") ct = "image/gif";
        else ct = "";
      }
      if (!allowed.includes(ct as (typeof allowed)[number])) {
        return c.json(
          {
            error:
              "Use PNG, JPEG, WebP, or GIF (2 MB max). If the type is missing, name the file with a .png / .jpg / .webp / .gif extension.",
          },
          400,
        );
      }
      const ext =
        ct === "image/png"
          ? "png"
          : ct === "image/jpeg"
            ? "jpg"
            : ct === "image/webp"
              ? "webp"
              : "gif";
      const key = `ws/${workspaceId}/branding/logo.${ext}`;
      const existing = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { logoS3Key: true },
      });
      if (existing?.logoS3Key && existing.logoS3Key !== key) {
        await deleteObject(env, existing.logoS3Key);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const put = await putObjectBuffer(env, key, buf, ct);
      if (!put.ok) {
        if (put.error === "S3 not configured") {
          return c.json({ error: "File storage is not configured" }, 503);
        }
        return c.json({ error: put.error }, 502);
      }
      const ws = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { logoS3Key: key, logoUrl: null },
      });
      return c.json(workspaceJson(ws, env));
    },
  );

  r.get("/workspaces/:workspaceId/invites", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const list = await prisma.workspaceInvite.findMany({
      where: { workspaceId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    return c.json({
      invites: list.map((inv) => ({
        id: inv.id,
        token: inv.token,
        inviteUrl: `${base}/join/${inv.token}`,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  });

  r.post("/workspaces/:workspaceId/invites", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const ws = admin.workspace;
    const gate = requirePro(ws);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const raw = await c.req.json().catch(() => ({}));
    const body = z.object({ expiresInDays: z.number().min(1).max(90).optional() }).safeParse(raw);
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const days = body.data.expiresInDays ?? 14;
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const token = newInviteToken();
    const inv = await prisma.workspaceInvite.create({
      data: {
        token,
        workspaceId,
        createdById: c.get("user").id,
        expiresAt,
      },
    });
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const inviteUrl = `${base}/join/${inv.token}`;
    return c.json({
      id: inv.id,
      token: inv.token,
      inviteUrl,
      expiresAt: inv.expiresAt,
    });
  });

  r.delete("/workspaces/:workspaceId/invites/:inviteId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const inviteId = c.req.param("inviteId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const inv = await prisma.workspaceInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });
    if (!inv) return c.json({ error: "Not found" }, 404);
    await prisma.workspaceInvite.update({
      where: { id: inv.id },
      data: { revokedAt: /* @__PURE__ */ new Date() },
    });
    return c.json({ ok: true });
  });

  r.get("/workspaces/:workspaceId/email-invites", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const forProjectId = c.req.query("forProjectId")?.trim() || undefined;
    if (forProjectId) {
      const ok = await prisma.project.findFirst({
        where: { id: forProjectId, workspaceId },
        select: { id: true },
      });
      if (!ok) return c.json({ error: "Invalid project" }, 400);
    }
    const list = await prisma.emailInvite.findMany({
      where: {
        workspaceId,
        revokedAt: null,
        ...(forProjectId
          ? {
              OR: [{ projects: { none: {} } }, { projects: { some: { projectId: forProjectId } } }],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        projects: { include: { project: { select: { id: true, name: true } } } },
      },
    });
    return c.json({
      invites: list.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        inviteKind: inv.inviteKind,
        trade: inv.trade,
        inviteeName: inv.inviteeName,
        inviteeCompany: inv.inviteeCompany,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        createdAt: inv.createdAt,
        projects: inv.projects.map((p) => p.project),
      })),
    });
  });

  r.post("/workspaces/:workspaceId/email-invites", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const ws = admin.workspace;
    const gate = requirePro(ws);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        email: z.string().email(),
        projectIds: z.array(z.string()).max(50).optional().default([]),
        role: z.nativeEnum(WorkspaceRole).optional(),
        inviteKind: z.nativeEnum(EmailInviteKind).optional(),
        trade: z.string().max(120).optional(),
        inviteeName: z.string().max(200).optional(),
        inviteeCompany: z.string().max(200).optional(),
        expiresInDays: z.number().min(1).max(90).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const emailNorm = body.data.email.toLowerCase().trim();
    const projectIds = [...new Set(body.data.projectIds)];
    const inviteKind = body.data.inviteKind ?? EmailInviteKind.INTERNAL;

    if (inviteKind !== EmailInviteKind.INTERNAL && projectIds.length === 0) {
      return c.json({ error: "External invites require at least one project." }, 400);
    }

    if (projectIds.length > 0) {
      const projCount = await prisma.project.count({
        where: { workspaceId, id: { in: projectIds } },
      });
      if (projCount !== projectIds.length) {
        return c.json({ error: "Invalid project selection" }, 400);
      }
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: emailNorm },
    });
    if (existingUser) {
      const already = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: existingUser.id },
      });
      if (already) {
        return c.json({ error: "User is already a member of this workspace." }, 400);
      }
    }

    const dup = await prisma.emailInvite.findFirst({
      where: {
        workspaceId,
        email: emailNorm,
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: /* @__PURE__ */ new Date() },
      },
    });
    if (dup) {
      return c.json({ error: "An active invite already exists for this email." }, 400);
    }

    if (inviteKind === EmailInviteKind.INTERNAL) {
      const pressure = await countSeatPressure(workspaceId);
      if (pressure >= MAX_WORKSPACE_MEMBERS) {
        return c.json({ error: "Workspace is full" }, 400);
      }
    }

    const days = body.data.expiresInDays ?? 14;
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const token = newInviteToken();
    const inviter = await prisma.user.findUniqueOrThrow({
      where: { id: c.get("user").id },
      select: { name: true, image: true, email: true },
    });

    const from = inviteFromAddress(env);
    if (!env.RESEND_API_KEY || !from) {
      return c.json(
        { error: "Email is not configured (set RESEND_API_KEY and RESEND_FROM)." },
        503,
      );
    }

    const invite = await prisma.emailInvite.create({
      data: {
        token,
        workspaceId,
        email: emailNorm,
        invitedById: c.get("user").id,
        role: body.data.role ?? WorkspaceRole.MEMBER,
        inviteKind,
        trade: body.data.trade?.trim() || null,
        inviteeName: body.data.inviteeName?.trim() || null,
        inviteeCompany: body.data.inviteeCompany?.trim() || null,
        expiresAt,
        projects: {
          create: projectIds.map((projectId) => ({ projectId })),
        },
      },
      include: {
        workspace: true,
        projects: { include: { project: { select: { name: true } } } },
      },
    });

    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const joinUrl = `${base}/join/email/${invite.token}`;
    const projectNames = invite.projects.map((p) => p.project.name);
    const expiresLabel = expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const apiOrigin = apiPublicOrigin(env);
    const emailInput = {
      to: emailNorm,
      inviterName: inviter.name,
      inviterImage: inviter.image,
      workspaceName: invite.workspace.name,
      workspaceLogoUrl: resolveWorkspaceEmailLogoUrl(
        base,
        invite.workspace.logoUrl,
        invite.workspace.website,
        {
          workspaceId: invite.workspace.id,
          logoS3Key: invite.workspace.logoS3Key,
          publicApiUrl: apiOrigin,
        },
      ),
      publicAppUrl: base,
      publicApiUrl: apiOrigin,
      projectNames,
      joinUrl,
      expiresLabel,
      inviteKind: inviteKind as InviteEmailKind,
      trade: invite.trade,
      inviteeName: invite.inviteeName,
      inviteeCompany: invite.inviteeCompany,
    };

    const resend = new Resend(env.RESEND_API_KEY);
    const subjectTag =
      inviteKind === EmailInviteKind.CLIENT
        ? " (Client portal)"
        : inviteKind === EmailInviteKind.CONTRACTOR || inviteKind === EmailInviteKind.SUBCONTRACTOR
          ? " (Project collaboration)"
          : "";
    const sendResult = await resend.emails.send({
      from,
      to: emailNorm,
      subject: `${inviter.name} invited you to ${invite.workspace.name} on PlanSync${subjectTag}`,
      html: buildProjectInviteEmailHtml(emailInput),
      text: buildProjectInviteEmailText(emailInput),
    });

    if (sendResult.error) {
      console.error("[email-invite] send failed", {
        workspaceId,
        inviteId: invite.id,
        email: emailNorm,
        resendError: sendResult.error.message,
      });
      await prisma.emailInvite.delete({ where: { id: invite.id } });
      return c.json({ error: sendResult.error.message ?? "Could not send email" }, 502);
    }

    return c.json({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
    });
  });

  r.post("/workspaces/:workspaceId/email-invites/:inviteId/resend", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const inviteId = c.req.param("inviteId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const gate = requirePro(admin.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const invite = await prisma.emailInvite.findFirst({
      where: { id: inviteId, workspaceId },
      include: {
        workspace: true,
        invitedBy: { select: { name: true, image: true, email: true } },
        projects: { include: { project: { select: { name: true } } } },
      },
    });
    if (!invite || invite.revokedAt) return c.json({ error: "Not found" }, 404);
    if (invite.acceptedAt) return c.json({ error: "Already accepted" }, 400);
    if (invite.expiresAt < /* @__PURE__ */ new Date()) {
      return c.json({ error: "Invite expired — send a new invite" }, 400);
    }

    const from = inviteFromAddress(env);
    if (!env.RESEND_API_KEY || !from) {
      return c.json(
        { error: "Email is not configured (set RESEND_API_KEY and RESEND_FROM)." },
        503,
      );
    }

    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const joinUrl = `${base}/join/email/${invite.token}`;
    const projectNames = invite.projects.map((p) => p.project.name);
    const expiresLabel = invite.expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const apiOrigin = apiPublicOrigin(env);
    const emailInput = {
      to: invite.email,
      inviterName: invite.invitedBy.name,
      inviterImage: invite.invitedBy.image,
      workspaceName: invite.workspace.name,
      workspaceLogoUrl: resolveWorkspaceEmailLogoUrl(
        base,
        invite.workspace.logoUrl,
        invite.workspace.website,
        {
          workspaceId: invite.workspace.id,
          logoS3Key: invite.workspace.logoS3Key,
          publicApiUrl: apiOrigin,
        },
      ),
      publicAppUrl: base,
      publicApiUrl: apiOrigin,
      projectNames,
      joinUrl,
      expiresLabel,
      inviteKind: invite.inviteKind as InviteEmailKind,
      trade: invite.trade,
      inviteeName: invite.inviteeName,
      inviteeCompany: invite.inviteeCompany,
    };

    const resendClient = new Resend(env.RESEND_API_KEY);
    const subjectTag =
      invite.inviteKind === EmailInviteKind.CLIENT
        ? " (Client portal)"
        : invite.inviteKind === EmailInviteKind.CONTRACTOR ||
            invite.inviteKind === EmailInviteKind.SUBCONTRACTOR
          ? " (Project collaboration)"
          : "";
    const sendResult = await resendClient.emails.send({
      from,
      to: invite.email,
      subject: `${invite.invitedBy.name} invited you to ${invite.workspace.name} on PlanSync${subjectTag}`,
      html: buildProjectInviteEmailHtml(emailInput),
      text: buildProjectInviteEmailText(emailInput),
    });

    if (sendResult.error) {
      console.error("[email-invite] resend failed", {
        workspaceId,
        inviteId,
        email: invite.email,
        resendError: sendResult.error.message,
      });
      return c.json({ error: sendResult.error.message ?? "Could not send email" }, 502);
    }
    return c.json({ ok: true });
  });

  r.patch("/workspaces/:workspaceId/email-invites/:inviteId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const inviteId = c.req.param("inviteId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const gate = requirePro(admin.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({ projectIds: z.array(z.string()).max(50) })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const invite = await prisma.emailInvite.findFirst({
      where: { id: inviteId, workspaceId, revokedAt: null },
      include: { projects: true },
    });
    if (!invite) return c.json({ error: "Not found" }, 404);
    if (invite.acceptedAt) return c.json({ error: "Invite already accepted" }, 400);
    if (invite.expiresAt < /* @__PURE__ */ new Date()) {
      return c.json({ error: "Invite expired" }, 400);
    }

    const projectIds = [...new Set(body.data.projectIds)];
    if (projectIds.length > 0) {
      const projCount = await prisma.project.count({
        where: { workspaceId, id: { in: projectIds } },
      });
      if (projCount !== projectIds.length) {
        return c.json({ error: "Invalid project selection" }, 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.emailInviteProject.deleteMany({ where: { emailInviteId: invite.id } });
      if (projectIds.length > 0) {
        await tx.emailInviteProject.createMany({
          data: projectIds.map((projectId) => ({ emailInviteId: invite.id, projectId })),
          skipDuplicates: true,
        });
      }
      return tx.emailInvite.findUniqueOrThrow({
        where: { id: invite.id },
        include: { projects: { include: { project: { select: { id: true, name: true } } } } },
      });
    });

    return c.json({
      ok: true,
      invite: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        expiresAt: updated.expiresAt,
        acceptedAt: updated.acceptedAt,
        createdAt: updated.createdAt,
        projects: updated.projects.map((p) => p.project),
      },
    });
  });

  r.delete("/workspaces/:workspaceId/email-invites/:inviteId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const inviteId = c.req.param("inviteId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const inv = await prisma.emailInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });
    if (!inv) return c.json({ error: "Not found" }, 404);
    await prisma.emailInvite.update({
      where: { id: inv.id },
      data: { revokedAt: /* @__PURE__ */ new Date() },
    });
    return c.json({ ok: true });
  });

  r.get("/workspaces/:workspaceId/members", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    const [list, pressure] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      }),
      countSeatPressure(workspaceId),
    ]);

    const scopedByUser = new Map<string, { id: string; name: string }[]>();
    if (isWorkspaceManagerRole(m.role)) {
      const userIds = list.map((x) => x.userId);
      const pmRows =
        userIds.length > 0
          ? await prisma.projectMember.findMany({
              where: { userId: { in: userIds }, project: { workspaceId } },
              include: { project: { select: { id: true, name: true } } },
            })
          : [];
      for (const row of pmRows) {
        const arr = scopedByUser.get(row.userId) ?? [];
        arr.push({ id: row.project.id, name: row.project.name });
        scopedByUser.set(row.userId, arr);
      }
    }

    return c.json({
      maxSeats: MAX_WORKSPACE_MEMBERS,
      seatPressure: pressure,
      members: list.map((x) => ({
        id: x.id,
        userId: x.userId,
        name: x.user.name,
        email: x.user.email,
        image: x.user.image,
        role: x.role,
        ...(isWorkspaceManagerRole(m.role)
          ? { scopedProjects: scopedByUser.get(x.userId) ?? [] }
          : {}),
      })),
    });
  });

  r.patch("/workspaces/:workspaceId/members/:userId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const targetUserId = c.req.param("userId")!;
    const actorUserId = c.get("user").id;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: actorUserId, role: { in: WORKSPACE_MANAGER_ROLES } },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const body = z.object({ role: z.nativeEnum(WorkspaceRole) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const newRole = body.data.role;
    const target = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) return c.json({ error: "Not found" }, 404);

    const superAdminCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: WorkspaceRole.SUPER_ADMIN },
    });

    if (newRole === WorkspaceRole.SUPER_ADMIN) {
      if (admin.role !== WorkspaceRole.SUPER_ADMIN && superAdminCount > 0) {
        return c.json({ error: "Only a Super Admin can assign the Super Admin role" }, 403);
      }
    }

    if (
      target.role === WorkspaceRole.SUPER_ADMIN &&
      newRole !== WorkspaceRole.SUPER_ADMIN &&
      admin.role !== WorkspaceRole.SUPER_ADMIN
    ) {
      return c.json({ error: "Only a Super Admin can change another Super Admin's role" }, 403);
    }

    if (
      target.role === WorkspaceRole.SUPER_ADMIN &&
      newRole !== WorkspaceRole.SUPER_ADMIN &&
      superAdminCount <= 1
    ) {
      return c.json(
        {
          error: "Cannot remove the last Super Admin. Promote another member to Super Admin first.",
        },
        400,
      );
    }

    if (newRole === WorkspaceRole.MEMBER && isWorkspaceManagerRole(target.role)) {
      const otherManagers = await prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: { in: WORKSPACE_MANAGER_ROLES },
          NOT: { userId: targetUserId },
        },
      });
      if (otherManagers === 0) {
        return c.json({ error: "Cannot remove the last workspace admin" }, 400);
      }
    }
    await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: newRole },
    });
    return c.json({ ok: true });
  });

  r.patch("/workspaces/:workspaceId/members/:userId/project-access", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const targetUserId = c.req.param("userId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const gate = requirePro(admin.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({ projectIds: z.array(z.string()).max(50) })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const target = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) return c.json({ error: "Not found" }, 404);

    const projectIds = [...new Set(body.data.projectIds)];
    if (projectIds.length > 0) {
      const projCount = await prisma.project.count({
        where: { workspaceId, id: { in: projectIds } },
      });
      if (projCount !== projectIds.length) {
        return c.json({ error: "Invalid project selection" }, 400);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({
        where: { userId: targetUserId, project: { workspaceId } },
      });
      if (projectIds.length > 0) {
        await tx.projectMember.createMany({
          data: projectIds.map((projectId) => ({
            projectId,
            userId: targetUserId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return c.json({ ok: true });
  });

  r.delete("/workspaces/:workspaceId/members/:userId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const targetUserId = c.req.param("userId")!;
    const actorId = c.get("user").id;

    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: actorId, role: { in: WORKSPACE_MANAGER_ROLES } },
      include: { workspace: true },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const gate = requirePro(admin.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (targetUserId === actorId) {
      return c.json({ error: "You cannot remove yourself from the workspace here." }, 400);
    }

    const target = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) return c.json({ error: "Not found" }, 404);

    if (isWorkspaceManagerRole(target.role)) {
      const otherManagers = await prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: { in: WORKSPACE_MANAGER_ROLES },
          NOT: { userId: targetUserId },
        },
      });
      if (otherManagers === 0) {
        return c.json({ error: "Cannot remove the last workspace admin" }, 400);
      }
    }

    const removedUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true },
    });

    const otherWorkspaceMemberships = await prisma.workspaceMember.count({
      where: { userId: targetUserId, workspaceId: { not: workspaceId } },
    });
    const deleteAccountAfterRemoval = otherWorkspaceMemberships === 0;

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({
        where: { userId: targetUserId, project: { workspaceId } },
      });
      await tx.workspaceMember.delete({ where: { id: target.id } });
      if (removedUser?.email) {
        await revokePendingEmailInvitesForWorkspaceEmail(tx, workspaceId, removedUser.email);
      }
      if (deleteAccountAfterRemoval) {
        await tx.user.delete({ where: { id: targetUserId } });
      }
    });

    await logActivity(workspaceId, ActivityType.MEMBER_REMOVED, {
      actorUserId: actorId,
      entityId: targetUserId,
      metadata: deleteAccountAfterRemoval ? { accountDeleted: true } : undefined,
    });

    return c.json({ ok: true, accountDeleted: deleteAccountAfterRemoval });
  });

  r.post("/workspaces/:workspaceId/members", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const admin = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id, role: { in: WORKSPACE_MANAGER_ROLES } },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) return c.json({ error: "Not found" }, 404);
    const gate = requirePro(ws);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z.object({ email: z.string().email() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const count = await prisma.workspaceMember.count({ where: { workspaceId } });
    if (count >= MAX_WORKSPACE_MEMBERS) {
      return c.json({ error: "Workspace member limit reached" }, 400);
    }

    const invitee = await prisma.user.findFirst({
      where: { email: body.data.email },
    });
    if (!invitee) {
      return c.json(
        { error: "User must register first; invite by email after they sign up." },
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await revokePendingEmailInvitesForWorkspaceEmail(tx, workspaceId, invitee.email);
      await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: invitee.id,
          role: WorkspaceRole.MEMBER,
        },
      });
    });
    await logActivity(workspaceId, ActivityType.MEMBER_INVITED, {
      actorUserId: c.get("user").id,
      entityId: invitee.id,
      metadata: { email: body.data.email },
    });
    return c.json({ ok: true });
  });

  r.post("/workspaces/:workspaceId/projects", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id },
      include: { workspace: true },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    const gate = requirePro(m.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (await isProjectScopedMember(c.get("user").id, workspaceId)) {
      return c.json({ error: "Project-scoped members cannot create projects" }, 403);
    }

    const projectCount = await prisma.project.count({ where: { workspaceId } });
    if (projectCount >= MAX_WORKSPACE_PROJECTS) {
      return c.json(
        {
          error: `This workspace can have at most ${MAX_WORKSPACE_PROJECTS} projects on your plan.`,
        },
        400,
      );
    }

    const body = z
      .object({
        name: z.string().min(1),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        projectNumber: z.string().max(120).optional(),
        localBudget: z.union([z.number(), z.string()]).optional().nullable(),
        projectSize: z.string().max(500).optional(),
        projectType: z.string().max(120).optional(),
        location: z.string().max(500).optional(),
        websiteUrl: z.string().max(2000).optional(),
        stage: z.nativeEnum(ProjectStage).optional(),
        progressPercent: z.number().int().min(0).max(100).optional(),
        currency: z.string().length(3).optional(),
        measurementSystem: z.nativeEnum(ProjectMeasurementSystem).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    if (body.data.endDate < body.data.startDate) {
      return c.json({ error: "End date must be on or after start date" }, 400);
    }

    const currency = parseProjectCurrency(body.data.currency ?? "USD");
    if (!currency) {
      return c.json({ error: "Invalid currency" }, 400);
    }

    const websiteRaw = body.data.websiteUrl?.trim() ?? "";
    const websiteUrl = normalizeWebsiteUrl(websiteRaw);
    if (websiteRaw && !websiteUrl) {
      return c.json({ error: "Invalid website URL" }, 400);
    }
    const logoUrl = logoUrlFromWebsiteUrl(websiteUrl);

    let localBudget: Prisma.Decimal | null = null;
    if (
      body.data.localBudget != null &&
      body.data.localBudget !== "" &&
      !(typeof body.data.localBudget === "number" && Number.isNaN(body.data.localBudget))
    ) {
      const raw =
        typeof body.data.localBudget === "number"
          ? body.data.localBudget
          : Number(String(body.data.localBudget).replace(/,/g, ""));
      if (!Number.isFinite(raw) || raw < 0) {
        return c.json({ error: "Invalid local budget" }, 400);
      }
      localBudget = new Prisma.Decimal(raw);
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: body.data.name,
        startDate: dateFromYmd(body.data.startDate),
        endDate: dateFromYmd(body.data.endDate),
        projectNumber: body.data.projectNumber?.trim() || null,
        currency,
        measurementSystem: body.data.measurementSystem ?? ProjectMeasurementSystem.METRIC,
        localBudget,
        projectSize: body.data.projectSize?.trim() || null,
        projectType: body.data.projectType?.trim() || null,
        location: body.data.location?.trim() || null,
        websiteUrl,
        logoUrl,
        stage: body.data.stage ?? ProjectStage.NOT_STARTED,
        progressPercent: body.data.progressPercent ?? 0,
      },
    });
    await logActivity(workspaceId, ActivityType.PROJECT_CREATED, {
      actorUserId: c.get("user").id,
      entityId: project.id,
      projectId: project.id,
      metadata: { name: project.name },
    });
    return c.json(projectRowJson(project));
  });

  r.get("/workspaces/:workspaceId/projects", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    const limited = await prisma.projectMember.findMany({
      where: { userId: c.get("user").id, project: { workspaceId } },
      select: { projectId: true },
    });
    const projectWhere =
      limited.length > 0
        ? { workspaceId, id: { in: limited.map((r) => r.projectId) } }
        : { workspaceId };
    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        folders: true,
        files: {
          include: {
            versions: {
              orderBy: { version: "desc" },
              select: fileVersionPublicSelect,
            },
          },
        },
      },
    });
    return c.json(projects.map(projectTreeJson));
  });

  /** Auth session for this project: role, module toggles, and UI mode (internal vs client vs contractor). */
  r.get("/projects/:projectId/session", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const { ctx } = res;
    return c.json({
      projectId: ctx.project.id,
      projectName: ctx.project.name,
      workspaceId: ctx.project.workspaceId,
      workspaceRole: ctx.workspaceMember.role,
      isExternal: ctx.workspaceMember.isExternal,
      projectRole: ctx.projectMember?.projectRole ?? null,
      trade: ctx.projectMember?.trade ?? null,
      operationsMode: ctx.project.operationsMode,
      settings: ctx.settings,
      uiMode: ctx.uiMode,
    });
  });

  /** Super Admin only: project module + client visibility toggles. */
  r.patch("/projects/:projectId/settings", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const { ctx } = res;
    if (ctx.workspaceMember.role !== WorkspaceRole.SUPER_ADMIN) {
      return c.json({ error: "Super Admin only" }, 403);
    }
    const body = z
      .object({
        modules: z
          .object({
            issues: z.boolean().optional(),
            rfis: z.boolean().optional(),
            takeoff: z.boolean().optional(),
            proposals: z.boolean().optional(),
            punch: z.boolean().optional(),
            fieldReports: z.boolean().optional(),
            omAssets: z.boolean().optional(),
            omMaintenance: z.boolean().optional(),
            omInspections: z.boolean().optional(),
            omTenantPortal: z.boolean().optional(),
            schedule: z.boolean().optional(),
          })
          .optional(),
        clientVisibility: z
          .object({
            showIssues: z.boolean().optional(),
            showRfis: z.boolean().optional(),
            showFieldReports: z.boolean().optional(),
            showPunchList: z.boolean().optional(),
            allowClientComment: z.boolean().optional(),
          })
          .optional(),
        omHandover: z
          .object({
            notes: z.string().max(20000).optional(),
            handoverCompletedAt: z.string().datetime().nullable().optional(),
            buildingLabel: z.string().max(500).nullable().optional(),
            facilityManagerUserId: z.string().nullable().optional(),
            handoverDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .nullable()
              .optional(),
            transferAsBuilt: z.boolean().optional(),
            transferClosedIssues: z.boolean().optional(),
            transferPunch: z.boolean().optional(),
            transferTeamAccess: z.boolean().optional(),
            handoverWizardCompletedAt: z.string().datetime().nullable().optional(),
            buildingOwnerEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
          })
          .optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const current = parseProjectSettingsJson(ctx.project.settingsJson);
    const merged = mergeProjectSettingsPatch(current, body.data);
    const raw = cloneSettingsJson(ctx.project.settingsJson);
    raw.modules = merged.modules;
    raw.clientVisibility = merged.clientVisibility;
    raw.omHandover = merged.omHandover;
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { settingsJson: raw as Prisma.InputJsonValue },
    });
    return c.json({
      projectId: updated.id,
      settings: parseProjectSettingsJson(updated.settingsJson),
    });
  });

  /** Folder tree presets from DB (`FolderStructureTemplate`); list updates when rows change. */
  r.get("/workspaces/:workspaceId/folder-structure-templates", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    const rows = await prisma.folderStructureTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      select: { slug: true, name: true, description: true, tree: true },
    });
    return c.json(
      rows.map((r) => {
        let tree: ReturnType<typeof parseFolderTreeFromJson>;
        try {
          tree = parseFolderTreeFromJson(r.tree);
        } catch {
          tree = [];
        }
        return {
          id: r.slug,
          name: r.name,
          description: r.description,
          tree,
        };
      }),
    );
  });

  r.get("/projects/:projectId/audit-logs", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const project = res.project;
    const gate = requirePro(project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit")) || 80));
    const logs = await fetchProjectAuditLogs({
      workspaceId: project.workspaceId,
      projectId,
      limit,
    });
    return c.json({
      projectId,
      projectName: project.name,
      items: logs.map((a) => {
        const fmt = formatAuditPresentation(a.type, a.metadata);
        return {
          id: a.id,
          type: a.type,
          createdAt: a.createdAt.toISOString(),
          actor: a.actor
            ? {
                id: a.actor.id,
                name: a.actor.name,
                email: a.actor.email,
                image: a.actor.image,
              }
            : null,
          metadata: a.metadata,
          actionLabel: fmt.actionLabel,
          summary: fmt.summary,
          detail: fmt.detail,
        };
      }),
    });
  });

  /** Log viewer open (PDF) for project audit — optional; prefer `POST /files/:fileId/open` (no projectId in URL). */
  r.post("/projects/:projectId/files/:fileId/open", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const fileId = c.req.param("fileId")!;
    const body = z
      .object({
        fileVersionId: z.string().optional(),
        version: z.coerce.number().int().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));

    const file = await prisma.file.findFirst({
      where: { id: fileId, projectId },
      include: { project: { include: { workspace: true } } },
    });
    if (!file) return c.json({ error: "Not found" }, 404);
    const parsed = body.success ? body.data : {};
    const result = await logFileOpenedActivity(file, c.get("user").id, parsed);
    if ("error" in result) return c.json({ error: result.error }, result.status as 402 | 403);
    return c.json({ ok: true });
  });

  r.get("/projects/:projectId/audit-logs/export", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const fmt = (c.req.query("format") || "xlsx").toLowerCase();
    if (fmt !== "xlsx" && fmt !== "pdf") {
      return c.json({ error: "Invalid format (use xlsx or pdf)" }, 400);
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });
    if (!project) return c.json({ error: "Not found" }, 404);
    const admin = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId,
        userId: c.get("user").id,
        role: { in: WORKSPACE_MANAGER_ROLES },
      },
    });
    if (!admin) return c.json({ error: "Admin only" }, 403);
    const gate = requirePro(project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const logs = await fetchProjectAuditLogs({
      workspaceId: project.workspaceId,
      projectId,
      limit: 5000,
    });
    const rows = auditLogsToRows(logs);
    const title = `Audit — ${project.name}`;
    const safeName = project.name.replace(/[^\w\- ]+/g, "").slice(0, 60) || "project";

    if (fmt === "xlsx") {
      const buf = buildAuditXlsxBuffer(rows);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${safeName}-audit.xlsx"`,
        },
      });
    }
    const buf = await buildAuditPdfBuffer(rows, title);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-audit.pdf"`,
      },
    });
  });

  r.post("/projects/:projectId/folders", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const project = access.project;
    const gate = requirePro(project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({ name: z.string().min(1), parentId: z.string().optional() })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const folder = await prisma.folder.create({
      data: {
        projectId,
        name: body.data.name,
        parentId: body.data.parentId,
      },
    });
    await logActivity(project.workspaceId, ActivityType.FOLDER_CREATED, {
      actorUserId: c.get("user").id,
      entityId: folder.id,
      projectId,
      metadata: { name: folder.name },
    });
    return c.json(folder);
  });

  /**
   * Apply a built-in template or copy folder names only from another project (no files).
   * Existing folders with the same name under the same parent are reused.
   */
  r.post("/projects/:projectId/folders/apply-structure", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const project = access.project;
    const gate = requirePro(project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        targetParentId: z.string().nullable().optional(),
        source: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("template"), templateId: z.string().min(1) }),
          z.object({ kind: z.literal("project"), sourceProjectId: z.string().min(1) }),
        ]),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const targetParentId = body.data.targetParentId ?? null;
    if (targetParentId) {
      const dest = await prisma.folder.findFirst({
        where: { id: targetParentId, projectId },
      });
      if (!dest) return c.json({ error: "Destination folder not found" }, 404);
    }

    const userId = c.get("user").id;
    const wsId = project.workspaceId;

    try {
      if (body.data.source.kind === "template") {
        const result = await applyFolderStructureFromTemplate({
          projectId,
          workspaceId: wsId,
          actorUserId: userId,
          targetParentId,
          templateId: body.data.source.templateId,
        });
        return c.json(result);
      }

      const srcAccess = await loadProjectForMember(body.data.source.sourceProjectId, userId);
      if ("error" in srcAccess) return c.json({ error: srcAccess.error }, srcAccess.status);
      if (srcAccess.project.workspaceId !== project.workspaceId) {
        return c.json({ error: "Source project must be in the same workspace." }, 400);
      }

      const result = await copyFolderStructureBetweenProjects({
        targetProjectId: projectId,
        sourceProjectId: body.data.source.sourceProjectId,
        workspaceId: wsId,
        actorUserId: userId,
        targetParentId,
      });
      return c.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not apply folder structure.";
      if (
        msg === "Unknown folder template." ||
        msg === "Invalid folder template data." ||
        msg === "Folder template is empty."
      )
        return c.json({ error: msg }, 400);
      if (msg === "Choose a different source project.") return c.json({ error: msg }, 400);
      return c.json({ error: msg }, 400);
    }
  });

  r.delete("/projects/:projectId/folders/:folderId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const folderId = c.req.param("folderId")!;
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { project: { include: { workspace: true } } },
    });
    if (!folder || folder.projectId !== projectId) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const beforeUsed = access.project.workspace.storageUsedBytes;
    const result = await deleteFolderTreeFromDbAndS3(env, folderId);
    if (!result.ok) return c.json({ error: result.error }, 500);

    const ws = await prisma.workspace.update({
      where: { id: folder.project.workspaceId },
      data: { storageUsedBytes: { decrement: result.bytesFreed } },
    });
    await logActivitySafe(folder.project.workspaceId, ActivityType.FOLDER_DELETED, {
      actorUserId: c.get("user").id,
      entityId: folderId,
      projectId,
      metadata: { name: folder.name },
    });
    await maybeSendStorageAlerts(env, ws.id, beforeUsed, ws.storageUsedBytes, ws.storageQuotaBytes);
    return c.json({ ok: true, bytesFreed: result.bytesFreed.toString() });
  });

  r.delete("/projects/:projectId/files/:fileId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const fileId = c.req.param("fileId")!;
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { project: { include: { workspace: true } } },
    });
    if (!file || file.projectId !== projectId) return c.json({ error: "Not found" }, 404);
    const delAccess = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in delAccess) return c.json({ error: delAccess.error }, delAccess.status);
    const gate = requirePro(file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const beforeUsed = delAccess.project.workspace.storageUsedBytes;
    const result = await deleteFileFromS3AndDb(env, fileId);
    if (!result.ok) return c.json({ error: result.error }, 500);

    const ws = await prisma.workspace.update({
      where: { id: file.project.workspaceId },
      data: { storageUsedBytes: { decrement: result.bytesFreed } },
    });
    await logActivitySafe(file.project.workspaceId, ActivityType.FILE_DELETED, {
      actorUserId: c.get("user").id,
      entityId: fileId,
      projectId,
      metadata: { name: file.name },
    });
    await maybeSendStorageAlerts(env, ws.id, beforeUsed, ws.storageUsedBytes, ws.storageQuotaBytes);
    return c.json({ ok: true, bytesFreed: result.bytesFreed.toString() });
  });

  /** Move a file to another folder (or project root when `folderId` is null). */
  r.patch("/projects/:projectId/files/:fileId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const fileId = c.req.param("fileId")!;
    const body = z
      .object({ folderId: z.string().nullable() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { project: { include: { workspace: true } } },
    });
    if (!file || file.projectId !== projectId) return c.json({ error: "Not found" }, 404);
    const moveFileAccess = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in moveFileAccess)
      return c.json({ error: moveFileAccess.error }, moveFileAccess.status);
    const gate = requirePro(file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const newFolderId = body.data.folderId;
    if (newFolderId) {
      const destFolder = await prisma.folder.findFirst({
        where: { id: newFolderId, projectId },
      });
      if (!destFolder) return c.json({ error: "Destination folder not found" }, 404);
    }

    const fk = folderKeyFromFolderId(newFolderId);
    const conflict = await prisma.file.findFirst({
      where: {
        projectId,
        name: file.name,
        folderKey: fk,
        NOT: { id: fileId },
      },
    });
    if (conflict) {
      return c.json(
        { error: "A file with this name already exists in the destination folder." },
        409,
      );
    }

    const fromFolderId = file.folderId;
    const updated = await prisma.file.update({
      where: { id: fileId },
      data: {
        folderId: newFolderId,
        folderKey: fk,
        updatedAt: new Date(),
      },
    });
    if (fromFolderId !== newFolderId) {
      await logActivitySafe(file.project.workspaceId, ActivityType.FILE_MOVED, {
        actorUserId: c.get("user").id,
        entityId: fileId,
        projectId,
        metadata: {
          fileName: file.name,
          fromFolderId,
          toFolderId: newFolderId,
        },
      });
    }
    return c.json(updated);
  });

  /** Move a folder under another parent (or project root when `parentId` is null). */
  r.patch("/projects/:projectId/folders/:folderId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const folderId = c.req.param("folderId")!;
    const body = z
      .object({ parentId: z.string().nullable() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { project: { include: { workspace: true } } },
    });
    if (!folder || folder.projectId !== projectId) return c.json({ error: "Not found" }, 404);
    const moveFolderAccess = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in moveFolderAccess)
      return c.json({ error: moveFolderAccess.error }, moveFolderAccess.status);
    const gate = requirePro(folder.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const newParentId = body.data.parentId;
    if (newParentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: newParentId, projectId },
      });
      if (!parent) return c.json({ error: "Destination folder not found" }, 404);
    }

    const allFolders = await prisma.folder.findMany({ where: { projectId } });
    const subtreeIds = new Set<string>();
    const walk = (id: string) => {
      subtreeIds.add(id);
      for (const f of allFolders) {
        if (f.parentId === id) walk(f.id);
      }
    };
    walk(folderId);
    if (newParentId !== null && subtreeIds.has(newParentId)) {
      return c.json({ error: "Cannot move a folder into itself or one of its subfolders." }, 400);
    }

    const fromParentId = folder.parentId;
    const updated = await prisma.folder.update({
      where: { id: folderId },
      data: { parentId: newParentId, updatedAt: new Date() },
    });
    if (fromParentId !== newParentId) {
      await logActivitySafe(folder.project.workspaceId, ActivityType.FOLDER_MOVED, {
        actorUserId: c.get("user").id,
        entityId: folderId,
        projectId,
        metadata: {
          folderName: folder.name,
          fromParentId,
          toParentId: newParentId,
        },
      });
    }
    return c.json(updated);
  });

  r.post("/projects/:projectId/uploads/preview", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const body = z
      .object({
        folderId: z.string().nullable().optional(),
        candidates: z
          .array(z.object({ clientName: z.string().min(1) }))
          .min(1)
          .max(100),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const folderKey = folderKeyFromFolderId(body.data.folderId ?? undefined);
    const files = await prisma.file.findMany({
      where: { projectId, folderKey },
      select: {
        id: true,
        name: true,
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true },
        },
      },
    });
    const latestIds = files.map((f) => f.versions[0]?.id).filter((id): id is string => Boolean(id));
    const grouped =
      latestIds.length > 0
        ? await prisma.issue.groupBy({
            by: ["fileVersionId"],
            where: { fileVersionId: { in: latestIds } },
            _count: { _all: true },
          })
        : [];
    const issueCountByVersionId = new Map(
      grouped.map((row) => [row.fileVersionId, row._count._all]),
    );

    const existing = files.map((f) => ({ id: f.id, name: f.name }));
    const rows = body.data.candidates.map((candidate) => {
      const match = findBestUploadMatch(candidate.clientName, existing);
      const matchedFile = match.matched
        ? (files.find((f) => f.id === match.matched?.id) ?? null)
        : null;
      const latest = matchedFile?.versions[0];
      const isNewVersion = match.kind === "new_version" && Boolean(matchedFile && latest);
      return {
        clientName: candidate.clientName,
        kind: isNewVersion ? ("new_version" as const) : ("new_sheet" as const),
        score: Number(match.score.toFixed(4)),
        matchedFile: matchedFile ? { id: matchedFile.id, name: matchedFile.name } : null,
        fromFileVersionId: isNewVersion && latest ? latest.id : null,
        currentMaxVersion: latest?.version ?? null,
        nextVersion: latest ? latest.version + 1 : 1,
        issueCountOnLatestVersion:
          latest && isNewVersion ? (issueCountByVersionId.get(latest.id) ?? 0) : 0,
      };
    });

    return c.json({ rows });
  });

  r.post("/files/presign-upload", needUser, async (c) => {
    const body = z
      .object({
        workspaceId: z.string(),
        projectId: z.string(),
        folderId: z.string().optional(),
        fileName: z.string().min(1),
        contentType: z.string().default("application/octet-stream"),
        sizeBytes: z.coerce.bigint(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const presignProj = await loadProjectForMember(body.data.projectId, c.get("user").id);
    if ("error" in presignProj) return c.json({ error: presignProj.error }, presignProj.status);
    if (presignProj.project.workspaceId !== body.data.workspaceId) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const gate = requirePro(presignProj.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const ws = presignProj.project.workspace;
    const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
    if (newUsed > ws.storageQuotaBytes) {
      return c.json({ error: "Storage quota exceeded" }, 400);
    }

    const file = await upsertFileForUpload({
      projectId: body.data.projectId,
      folderId: body.data.folderId,
      name: body.data.fileName,
    });
    const uploadId = newUploadId();
    const key = buildUploadObjectKey(body.data.workspaceId, body.data.projectId, file.id, uploadId);

    const url = await presignPut(env, key, body.data.contentType);
    if (!url) {
      return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
    }

    return c.json({
      uploadUrl: url,
      key,
      fileId: file.id,
      workspaceId: body.data.workspaceId,
    });
  });

  /** Same-origin multipart upload: browser → API → S3 (no S3 CORS for PUT). */
  r.post(
    "/files/upload",
    needUser,
    bodyLimit({
      maxSize: Number(env.MAX_DIRECT_UPLOAD_BYTES) + 1024 * 1024,
      onError: (c) => c.json({ error: "Payload too large" }, 413),
    }),
    async (c) => {
      let parsed: Record<string, string | File>;
      try {
        parsed = await c.req.parseBody();
      } catch {
        return c.json({ error: "Invalid multipart body" }, 400);
      }
      const rawFile = parsed["file"];
      const uploaded = Array.isArray(rawFile) ? rawFile[0] : rawFile;
      if (!uploaded || typeof uploaded === "string" || !(uploaded instanceof File)) {
        return c.json({ error: "Missing file" }, 400);
      }
      const workspaceId = typeof parsed["workspaceId"] === "string" ? parsed["workspaceId"] : "";
      const projectId = typeof parsed["projectId"] === "string" ? parsed["projectId"] : "";
      const folderId =
        typeof parsed["folderId"] === "string" && parsed["folderId"].length > 0
          ? parsed["folderId"]
          : undefined;
      const fileName =
        typeof parsed["fileName"] === "string" && parsed["fileName"].length > 0
          ? parsed["fileName"]
          : uploaded.name;

      const fields = z
        .object({
          workspaceId: z.string().min(1),
          projectId: z.string().min(1),
          folderId: z.string().optional(),
          fileName: z.string().min(1),
        })
        .safeParse({ workspaceId, projectId, folderId, fileName });
      if (!fields.success) return c.json({ error: fields.error.flatten() }, 400);

      if (BigInt(uploaded.size) > env.MAX_DIRECT_UPLOAD_BYTES) {
        return c.json({ error: "File too large for direct upload" }, 413);
      }

      const directUp = await loadProjectForMember(fields.data.projectId, c.get("user").id);
      if ("error" in directUp) return c.json({ error: directUp.error }, directUp.status);
      if (directUp.project.workspaceId !== fields.data.workspaceId) {
        return c.json({ error: "Forbidden" }, 403);
      }
      const gate = requirePro(directUp.project.workspace);
      if (gate) return c.json({ error: gate.error }, gate.status);

      const ws = directUp.project.workspace;
      const sizeBytes = BigInt(uploaded.size);
      const newUsed = ws.storageUsedBytes + sizeBytes;
      if (newUsed > ws.storageQuotaBytes) {
        return c.json({ error: "Storage quota exceeded" }, 400);
      }

      const file = await upsertFileForUpload({
        projectId: fields.data.projectId,
        folderId: fields.data.folderId,
        name: fields.data.fileName,
      });
      const uploadId = newUploadId();
      const key = buildUploadObjectKey(
        fields.data.workspaceId,
        fields.data.projectId,
        file.id,
        uploadId,
      );
      const contentType = resolvedMimeType(uploaded.type, fields.data.fileName);

      const buf = Buffer.from(await uploaded.arrayBuffer());
      const put = await putObjectBuffer(env, key, buf, contentType);
      if (!put.ok) {
        if (put.error === "S3 not configured") {
          return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
        }
        return c.json({ error: put.error }, 502);
      }

      const beforeUsed = ws.storageUsedBytes;
      const { fv, updatedWs } = await prisma.$transaction(async (tx) => {
        const agg = await tx.fileVersion.aggregate({
          where: { fileId: file.id },
          _max: { version: true },
        });
        const nextVersion = (agg._max.version ?? 0) + 1;
        const fv = await tx.fileVersion.create({
          data: {
            fileId: file.id,
            version: nextVersion,
            s3Key: key,
            sizeBytes,
            uploadedById: c.get("user").id,
          },
        });
        await tx.file.update({
          where: { id: file.id },
          data: { mimeType: contentType },
        });
        const updatedWs = await tx.workspace.update({
          where: { id: fields.data.workspaceId },
          data: { storageUsedBytes: { increment: sizeBytes } },
        });
        return { fv, updatedWs };
      });

      const fileRow = await prisma.file.findUniqueOrThrow({ where: { id: file.id } });

      await logActivitySafe(fields.data.workspaceId, ActivityType.FILE_VERSION_ADDED, {
        actorUserId: c.get("user").id,
        entityId: fv.id,
        projectId: fields.data.projectId,
        metadata: { fileId: file.id, fileName: file.name, version: fv.version },
      });

      await maybeSendStorageAlerts(
        env,
        updatedWs.id,
        beforeUsed,
        updatedWs.storageUsedBytes,
        updatedWs.storageQuotaBytes,
      );

      return c.json({ file: fileRow, fileVersion: fileVersionJson(fv) });
    },
  );

  r.post("/files/complete-upload", needUser, async (c) => {
    const body = z
      .object({
        workspaceId: z.string(),
        projectId: z.string(),
        folderId: z.string().optional(),
        fileName: z.string(),
        fileId: z.string().min(1),
        s3Key: z.string(),
        sizeBytes: z.coerce.bigint(),
        sha256: z.string().optional(),
        mimeType: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const uploadAccess = await loadProjectForMember(body.data.projectId, c.get("user").id);
    if ("error" in uploadAccess) return c.json({ error: uploadAccess.error }, uploadAccess.status);
    if (uploadAccess.project.workspaceId !== body.data.workspaceId) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const gate = requirePro(uploadAccess.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const ws = uploadAccess.project.workspace;
    const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
    if (newUsed > ws.storageQuotaBytes) {
      return c.json({ error: "Storage quota exceeded" }, 400);
    }

    const fk = folderKeyFromFolderId(body.data.folderId);
    const file = await prisma.file.findFirst({
      where: {
        id: body.data.fileId,
        projectId: body.data.projectId,
        name: body.data.fileName,
        folderKey: fk,
      },
      include: { project: true },
    });
    if (!file) return c.json({ error: "File not found" }, 404);
    if (file.project.workspaceId !== body.data.workspaceId) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (
      !s3KeyMatchesFileUpload(body.data.s3Key, body.data.workspaceId, body.data.projectId, file.id)
    ) {
      return c.json({ error: "Invalid upload key" }, 400);
    }

    const beforeUsed = ws.storageUsedBytes;
    const { fv, updatedWs } = await prisma.$transaction(async (tx) => {
      const agg = await tx.fileVersion.aggregate({
        where: { fileId: file.id },
        _max: { version: true },
      });
      const nextVersion = (agg._max.version ?? 0) + 1;
      const fv = await tx.fileVersion.create({
        data: {
          fileId: file.id,
          version: nextVersion,
          s3Key: body.data.s3Key,
          sizeBytes: body.data.sizeBytes,
          sha256: body.data.sha256,
          uploadedById: c.get("user").id,
        },
      });
      const updatedWs = await tx.workspace.update({
        where: { id: body.data.workspaceId },
        data: { storageUsedBytes: { increment: body.data.sizeBytes } },
      });
      return { fv, updatedWs };
    });

    await logActivitySafe(body.data.workspaceId, ActivityType.FILE_VERSION_ADDED, {
      actorUserId: c.get("user").id,
      entityId: fv.id,
      projectId: body.data.projectId,
      metadata: { fileId: file.id, fileName: file.name, version: fv.version },
    });

    await maybeSendStorageAlerts(
      env,
      updatedWs.id,
      beforeUsed,
      updatedWs.storageUsedBytes,
      updatedWs.storageQuotaBytes,
    );

    const mt = resolvedMimeType(body.data.mimeType, file.name);
    const fileOut = await prisma.file.update({
      where: { id: file.id },
      data: { mimeType: mt },
    });

    return c.json({ file: fileOut, fileVersion: fileVersionJson(fv) });
  });

  r.get("/files/:fileId/presign-read", needUser, async (c) => {
    const file = await prisma.file.findUnique({
      where: { id: c.req.param("fileId") },
      include: {
        project: { include: { workspace: true } },
        versions: {
          orderBy: { version: "desc" },
          select: fileVersionPublicSelect,
        },
      },
    });
    if (!file || file.versions.length === 0) return c.json({ error: "Not found" }, 404);
    const presignAccess = await loadProjectForMember(file.projectId, c.get("user").id);
    if ("error" in presignAccess)
      return c.json({ error: presignAccess.error }, presignAccess.status);
    const gate = requirePro(file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const vParam = c.req.query("version");
    const fv =
      vParam != null && vParam !== ""
        ? file.versions.find((x) => x.version === Number(vParam))
        : file.versions[0];
    if (!fv) return c.json({ error: "Version not found" }, 404);

    const url = await presignGet(env, fv.s3Key);
    if (!url) return c.json({ error: "S3 not configured" }, 503);
    return c.json({ url });
  });

  /**
   * Resolve `fileVersionId` for the revision selected by `?version=` (or latest).
   * `/viewer` historically used `fileId` + `version` only; takeoff publish and viewer-state need the version row id.
   */
  r.get("/files/:fileId/resolved-revision", needUser, async (c) => {
    const file = await prisma.file.findUnique({
      where: { id: c.req.param("fileId") },
      include: {
        project: { include: { workspace: true } },
        versions: {
          orderBy: { version: "desc" },
          select: { id: true, version: true },
        },
      },
    });
    if (!file || file.versions.length === 0) return c.json({ error: "Not found" }, 404);
    const rrAccess = await loadProjectForMember(file.projectId, c.get("user").id);
    if ("error" in rrAccess) return c.json({ error: rrAccess.error }, rrAccess.status);
    const gate = requirePro(file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const vParam = c.req.query("version");
    const fv =
      vParam != null && vParam !== ""
        ? file.versions.find((x) => x.version === Number(vParam))
        : file.versions[0];
    if (!fv) return c.json({ error: "Version not found" }, 404);

    return c.json({
      fileVersionId: fv.id,
      version: fv.version,
      projectId: file.projectId,
    });
  });

  /** Same-origin PDF bytes for the viewer (pdf.js); streams from S3 — no bucket GET CORS in the browser. */
  r.get("/files/:fileId/content", needUser, async (c) => {
    const file = await prisma.file.findUnique({
      where: { id: c.req.param("fileId") },
      include: {
        project: { include: { workspace: true } },
        versions: {
          orderBy: { version: "desc" },
          select: fileVersionPublicSelect,
        },
      },
    });
    if (!file || file.versions.length === 0) return c.json({ error: "Not found" }, 404);
    const contentAccess = await loadProjectForMember(file.projectId, c.get("user").id);
    if ("error" in contentAccess)
      return c.json({ error: contentAccess.error }, contentAccess.status);
    const gate = requirePro(file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const vParam = c.req.query("version");
    const fv =
      vParam != null && vParam !== ""
        ? file.versions.find((x) => x.version === Number(vParam))
        : file.versions[0];
    if (!fv) return c.json({ error: "Version not found" }, 404);

    const obj = await getObjectStream(env, fv.s3Key);
    if (!obj.ok) {
      if (obj.error === "S3 not configured") return c.json({ error: obj.error }, 503);
      return c.json({ error: obj.error }, 502);
    }
    const headers = new Headers();
    headers.set("Content-Type", obj.contentType);
    if (obj.contentLength != null) headers.set("Content-Length", String(obj.contentLength));
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    return new Response(obj.stream, { status: 200, headers });
  });

  /**
   * Log FILE_OPENED for project audit using the file’s `projectId` from the DB.
   * Use this from the viewer whenever `fileId` is known — no `projectId` query param required.
   */
  r.post("/files/:fileId/open", needUser, async (c) => {
    const fileId = c.req.param("fileId")!;
    const body = z
      .object({
        fileVersionId: z.string().optional(),
        version: z.coerce.number().int().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { project: { include: { workspace: true } } },
    });
    if (!file) return c.json({ error: "Not found" }, 404);
    const parsed = body.success ? body.data : {};
    const result = await logFileOpenedActivity(file, c.get("user").id, parsed);
    if ("error" in result) return c.json({ error: result.error }, result.status as 402 | 403);
    return c.json({ ok: true });
  });

  /** Pro: load markups, measurements, calibration, and viewer prefs for a file revision (same shape as localStorage session minus fingerprint). */
  r.get("/file-versions/:fileVersionId/viewer-state", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const fv = await prisma.fileVersion.findUnique({
      where: { id: fileVersionId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const vsAccess = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in vsAccess) return c.json({ error: vsAccess.error }, vsAccess.status);
    const gate = requirePro(fv.file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    return c.json({
      viewerState: fv.annotationBlob,
      revision: fv.annotationBlobRevision,
    });
  });

  /** Pro: persist viewer state for a file revision. */
  r.put(
    "/file-versions/:fileVersionId/viewer-state",
    needUser,
    bodyLimit({
      maxSize: 6 * 1024 * 1024,
      onError: (c) => c.json({ error: "Payload too large" }, 413),
    }),
    async (c) => {
      const fileVersionId = c.req.param("fileVersionId")!;
      const raw = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!raw || typeof raw !== "object") return c.json({ error: "Invalid JSON" }, 400);
      const baseRevisionRaw = raw.baseRevision;
      const baseRevision =
        typeof baseRevisionRaw === "number" && Number.isFinite(baseRevisionRaw)
          ? baseRevisionRaw
          : undefined;
      const { baseRevision: _br, ...rest } = raw;
      const body = viewerStatePutSchema.safeParse(rest);
      if (!body.success) return c.json({ error: body.error.flatten() }, 400);

      const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: { include: { workspace: true } } } } },
      });
      if (!fv) return c.json({ error: "Not found" }, 404);
      const vsPutAccess = await loadProjectForMember(fv.file.projectId, c.get("user").id);
      if ("error" in vsPutAccess) return c.json({ error: vsPutAccess.error }, vsPutAccess.status);
      const gate = requirePro(fv.file.project.workspace);
      if (gate) return c.json({ error: gate.error }, gate.status);

      if (baseRevision !== undefined && baseRevision !== fv.annotationBlobRevision) {
        collabMetrics.put409Count++;
        return c.json(
          {
            error: "revision_conflict",
            currentRevision: fv.annotationBlobRevision,
            viewerState: fv.annotationBlob,
          },
          409,
        );
      }

      const blob = { v: 1 as const, ...body.data };
      const updated = await prisma.fileVersion.update({
        where: { id: fv.id },
        data: {
          annotationBlob: blob,
          annotationBlobRevision: { increment: 1 },
        },
        select: { annotationBlobRevision: true },
      });
      const userId = c.get("user").id;
      if (collaborationGloballyEnabled(env)) {
        broadcastViewerState(fileVersionId, updated.annotationBlobRevision, userId);
      }
      void logActivitySafe(fv.file.project.workspaceId, ActivityType.VIEWER_MARKUP_SAVED, {
        actorUserId: userId,
        projectId: fv.file.projectId,
        entityType: "file_version",
        entityId: fv.id,
        metadata: {
          fileId: fv.fileId,
          version: fv.version,
          revision: updated.annotationBlobRevision,
        },
      });
      return c.json({ ok: true as const, revision: updated.annotationBlobRevision });
    },
  );

  /** SSE: viewer-state revision + presence (desktop collaboration). */
  r.get("/file-versions/:fileVersionId/viewer-collab/events", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const userId = c.get("user").id;
    const fv = await prisma.fileVersion.findUnique({
      where: { id: fileVersionId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(fv.file.projectId, userId);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(fv.file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (!collaborationEnabledForWorkspace(env, fv.file.project.workspace)) {
      return c.json({ error: "Collaboration disabled" }, 403);
    }
    if (!allowSseConnect(userId)) {
      return c.json({ error: "Too many connections" }, 429);
    }
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { hideViewerPresence: true },
    });
    const listInPresence = !userRow?.hideViewerPresence;

    let connectionId = "";
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        connectionId = registerSseConnection(fileVersionId, userId, controller, listInPresence);
      },
      cancel() {
        if (connectionId) unregisterSseConnection(fileVersionId, connectionId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  r.post("/file-versions/:fileVersionId/viewer-collab/heartbeat", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const parsed = z
      .object({ connectionId: z.string().min(1) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const fv = await prisma.fileVersion.findUnique({
      where: { id: fileVersionId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(fv.file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (!collaborationEnabledForWorkspace(env, fv.file.project.workspace)) {
      return c.json({ error: "Collaboration disabled" }, 403);
    }
    const ok = touchHeartbeat(fileVersionId, parsed.data.connectionId, c.get("user").id);
    if (!ok) return c.json({ error: "Unknown connection" }, 404);
    return c.json({ ok: true as const });
  });

  r.post("/file-versions/:fileVersionId/viewer-collab/leave", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const parsed = z
      .object({ connectionId: z.string().min(1) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const fv = await prisma.fileVersion.findUnique({
      where: { id: fileVersionId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(fv.file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (!collaborationEnabledForWorkspace(env, fv.file.project.workspace)) {
      return c.json({ error: "Collaboration disabled" }, 403);
    }
    disconnectViewerCollabSse(fileVersionId, parsed.data.connectionId, c.get("user").id);
    return c.json({ ok: true as const });
  });

  r.post("/file-versions/:fileVersionId/viewer-collab/end-session", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const fv = await prisma.fileVersion.findUnique({
      where: { id: fileVersionId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(fv.file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (!collaborationEnabledForWorkspace(env, fv.file.project.workspace)) {
      return c.json({ error: "Collaboration disabled" }, 403);
    }
    const ended = endViewerCollabSession(fileVersionId, c.get("user").id);
    if (!ended) {
      return c.json(
        { error: "Only the live session host can end the session for everyone on this sheet." },
        403,
      );
    }
    return c.json({ ok: true as const });
  });

  r.get("/internal/collab-metrics", async (c) => {
    const secret = env.INTERNAL_CRON_SECRET?.trim();
    const q = c.req.query("secret")?.trim();
    if (!secret || q !== secret) return c.json({ error: "Forbidden" }, 403);
    return c.json(getCollabMetricsSnapshot());
  });

  /** Daily cron: email workspace admins a digest of PPM items overdue or due within 7 days (UTC). Same auth as RFI overdue reminders. */
  r.post("/internal/om-maintenance-reminders", async (c) => {
    const secret = env.INTERNAL_CRON_SECRET?.trim();
    if (!secret) return c.json({ error: "Not configured" }, 503);
    const hdr = c.req.header("x-plansync-cron-secret");
    if (hdr !== secret) return c.json({ error: "Unauthorized" }, 401);
    try {
      const result = await runOmMaintenanceReminders(env);
      if (result.skippedNoResend) {
        return c.json({
          ok: true,
          skipped: true,
          reason: "RESEND not configured",
          dayKey: result.dayKey,
        });
      }
      return c.json({
        ok: true,
        dayKey: result.dayKey,
        workspacesEmailed: result.workspacesEmailed,
        workspacesSkipped: result.workspacesSkipped,
      });
    } catch (e) {
      console.error("[om-maintenance-reminders]", e);
      return c.json({ error: "Internal error" }, 500);
    }
  });

  r.get("/workspaces/:workspaceId/dashboard", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id },
      include: { workspace: true },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);

    const start14 = new Date();
    start14.setUTCDate(start14.getUTCDate() - 13);
    start14.setUTCHours(0, 0, 0, 0);

    const [openIssues, projects, recent, fileCount, memberCount, activityForTrend] =
      await Promise.all([
        prisma.issue.groupBy({
          by: ["status"],
          where: { workspaceId },
          _count: true,
        }),
        prisma.project.count({ where: { workspaceId } }),
        prisma.activityLog.findMany({
          where: { workspaceId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { actor: { select: { name: true, email: true } } },
        }),
        prisma.file.count({
          where: { project: { workspaceId } },
        }),
        prisma.workspaceMember.count({ where: { workspaceId } }),
        prisma.activityLog.findMany({
          where: { workspaceId, createdAt: { gte: start14 } },
          select: { createdAt: true },
        }),
      ]);

    const dayKeys: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      d.setUTCHours(0, 0, 0, 0);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const byDay = new Map(dayKeys.map((k) => [k, 0]));
    for (const row of activityForTrend) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const activityLast14Days = dayKeys.map((date) => ({
      date,
      count: byDay.get(date) ?? 0,
    }));

    return c.json({
      workspace: workspaceJson(m.workspace, env),
      projectCount: projects,
      fileCount,
      memberCount,
      issuesByStatus: openIssues.map((row) => ({
        status: row.status,
        _count: typeof row._count === "number" ? row._count : (row._count as { _all: number })._all,
      })),
      recentActivity: recent,
      activityLast14Days,
    });
  });

  /** Lightweight polling hint for clients (SSE can replace later). */
  r.get("/workspaces/:workspaceId/sync-hint", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: c.get("user").id },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    return c.json({
      serverTime: Date.now(),
      suggestedPollMs: 5000,
    });
  });

  r.post("/files/:fileVersionId/lock", needUser, async (c) => {
    const fv = await prisma.fileVersion.findUnique({
      where: { id: c.req.param("fileVersionId") },
      include: { file: { include: { project: true } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const lockAccess = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in lockAccess) return c.json({ error: lockAccess.error }, lockAccess.status);
    const gate = requirePro(lockAccess.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const expires = new Date(Date.now() + 5 * 60 * 1000);
    const updated = await prisma.fileVersion.update({
      where: { id: fv.id },
      data: {
        lockedByUserId: c.get("user").id,
        lockedAt: new Date(),
        lockExpiresAt: expires,
      },
    });
    return c.json(fileVersionJson(updated));
  });

  r.delete("/files/:fileVersionId/lock", needUser, async (c) => {
    const fv = await prisma.fileVersion.findUnique({
      where: { id: c.req.param("fileVersionId") },
      include: { file: { include: { project: true } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const lockDel = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in lockDel) return c.json({ error: lockDel.error }, lockDel.status);
    if (fv.lockedByUserId && fv.lockedByUserId !== c.get("user").id) {
      return c.json({ error: "Locked by another user" }, 409);
    }
    const updated = await prisma.fileVersion.update({
      where: { id: fv.id },
      data: {
        lockedByUserId: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    });
    return c.json(fileVersionJson(updated));
  });

  r.get("/projects/:projectId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const { project } = res;
    return c.json(projectDetailApiJson(project));
  });

  /** 14-day activity trend scoped to this project (`ActivityLog.projectId`). */
  r.get("/projects/:projectId/dashboard", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const workspaceId = access.project.workspaceId;

    const start14 = new Date();
    start14.setUTCDate(start14.getUTCDate() - 13);
    start14.setUTCHours(0, 0, 0, 0);

    const activityForTrend = await prisma.activityLog.findMany({
      where: { workspaceId, projectId, createdAt: { gte: start14 } },
      select: { createdAt: true },
    });

    const dayKeys: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      d.setUTCHours(0, 0, 0, 0);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const byDay = new Map(dayKeys.map((k) => [k, 0]));
    for (const row of activityForTrend) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const activityLast14Days = dayKeys.map((date) => ({
      date,
      count: byDay.get(date) ?? 0,
    }));

    return c.json({ activityLast14Days });
  });

  r.get("/projects/:projectId/team", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const { project } = res;
    const workspaceId = project.workspaceId;

    const [wsMembers, pmRows, pressure] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.projectMember.findMany({
        where: { project: { workspaceId } },
        select: { userId: true, projectId: true },
      }),
      countSeatPressure(workspaceId),
    ]);

    const rows = buildProjectTeamMembers(
      wsMembers.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        workspaceRole: m.role,
      })),
      pmRows,
      projectId,
    );

    return c.json({
      maxSeats: MAX_WORKSPACE_MEMBERS,
      seatPressure: pressure,
      members: rows.map((m) => ({
        userId: m.userId,
        name: m.name,
        email: m.email,
        image: m.image,
        workspaceRole: m.workspaceRole,
        access: m.access,
        canRemoveFromProject: m.canRemoveFromProject,
      })),
    });
  });

  r.delete("/projects/:projectId/members/:userId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const targetUserId = c.req.param("userId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const admin = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: access.project.workspaceId,
        userId: c.get("user").id,
        role: { in: WORKSPACE_MANAGER_ROLES },
      },
    });
    if (!admin) return c.json({ error: "Forbidden" }, 403);

    const pm = await prisma.projectMember.findFirst({
      where: { projectId, userId: targetUserId },
    });
    if (!pm) {
      return c.json(
        {
          error:
            "This user is not scoped to this project only — remove them from the workspace under Organization, or adjust project access.",
        },
        400,
      );
    }

    await prisma.projectMember.delete({ where: { id: pm.id } });
    return c.json({ ok: true });
  });

  r.patch("/projects/:projectId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const { project } = res;
    const gate = requirePro(project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        name: z.string().min(1).max(500).optional(),
        projectNumber: z.string().max(120).nullable().optional(),
        localBudget: z.union([z.number(), z.string(), z.null()]).optional(),
        projectSize: z.string().max(500).nullable().optional(),
        projectType: z.string().max(120).nullable().optional(),
        location: z.string().max(500).nullable().optional(),
        latitude: z.number().gte(-90).lte(90).nullable().optional(),
        longitude: z.number().gte(-180).lte(180).nullable().optional(),
        websiteUrl: z.union([z.string().max(2000), z.null()]).optional(),
        stage: z.nativeEnum(ProjectStage).optional(),
        progressPercent: z.number().int().min(0).max(100).optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        currency: z.string().length(3).optional(),
        measurementSystem: z.nativeEnum(ProjectMeasurementSystem).optional(),
        takeoffPricing: z
          .object({
            projectDiscountPct: z.union([z.string(), z.number()]).optional(),
            itemDiscountPctByKey: z.record(z.union([z.string(), z.number()])).optional(),
          })
          .optional(),
        /** Super Admin only — enables O&M building experience (sidebar, assets, etc.). */
        operationsMode: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const b = body.data;
    const data: Prisma.ProjectUpdateInput = {};

    if (b.operationsMode !== undefined) {
      const wm = await prisma.workspaceMember.findFirst({
        where: { workspaceId: project.workspaceId, userId: c.get("user").id },
      });
      if (!wm || wm.role !== WorkspaceRole.SUPER_ADMIN) {
        return c.json({ error: "Super Admin only" }, 403);
      }
      if (b.operationsMode === true && !isWorkspaceOmBilling(project.workspace)) {
        return c.json(
          {
            error:
              "Operations & Maintenance mode requires PlanSync Enterprise. Upgrade under Dashboard → Billing.",
          },
          402,
        );
      }
      data.operationsMode = b.operationsMode;
    }

    if (b.currency !== undefined) {
      const cur = parseProjectCurrency(b.currency);
      if (!cur) {
        return c.json({ error: "Invalid currency" }, 400);
      }
      data.currency = cur;
    }
    if (b.measurementSystem !== undefined) data.measurementSystem = b.measurementSystem;

    if (b.name !== undefined) data.name = b.name.trim();

    if (b.projectNumber !== undefined) {
      data.projectNumber = b.projectNumber?.trim() ? b.projectNumber.trim() : null;
    }

    if (b.projectSize !== undefined) {
      data.projectSize = b.projectSize?.trim() ? b.projectSize.trim() : null;
    }
    if (b.projectType !== undefined) {
      data.projectType = b.projectType?.trim() ? b.projectType.trim() : null;
    }
    if (b.location !== undefined) {
      data.location = b.location?.trim() ? b.location.trim() : null;
    }

    if (b.latitude !== undefined || b.longitude !== undefined) {
      if (b.latitude === undefined || b.longitude === undefined) {
        return c.json({ error: "latitude and longitude must be updated together" }, 400);
      }
      if (b.latitude === null && b.longitude === null) {
        data.latitude = null;
        data.longitude = null;
      } else if (b.latitude != null && b.longitude != null) {
        data.latitude = b.latitude;
        data.longitude = b.longitude;
      } else {
        return c.json({ error: "latitude and longitude must both be set or both cleared" }, 400);
      }
    }

    if (b.localBudget !== undefined) {
      if (b.localBudget === null || b.localBudget === "") {
        data.localBudget = null;
      } else {
        const raw =
          typeof b.localBudget === "number"
            ? b.localBudget
            : Number(String(b.localBudget).replace(/,/g, ""));
        if (!Number.isFinite(raw) || raw < 0) {
          return c.json({ error: "Invalid local budget" }, 400);
        }
        data.localBudget = new Prisma.Decimal(raw);
      }
    }

    if (b.websiteUrl !== undefined) {
      if (b.websiteUrl === null || b.websiteUrl === "") {
        data.websiteUrl = null;
        data.logoUrl = null;
      } else {
        const websiteUrl = normalizeWebsiteUrl(b.websiteUrl.trim());
        if (!websiteUrl) {
          return c.json({ error: "Invalid website URL" }, 400);
        }
        data.websiteUrl = websiteUrl;
        data.logoUrl = logoUrlFromWebsiteUrl(websiteUrl);
      }
    }

    if (b.stage !== undefined) data.stage = b.stage;
    if (b.progressPercent !== undefined) data.progressPercent = b.progressPercent;
    if (b.startDate !== undefined) {
      data.startDate = b.startDate ? dateFromYmd(b.startDate) : null;
    }
    if (b.endDate !== undefined) {
      data.endDate = b.endDate ? dateFromYmd(b.endDate) : null;
    }

    if (b.takeoffPricing !== undefined) {
      data.settingsJson = mergeTakeoffPricingIntoSettingsJson(
        project.settingsJson,
        b.takeoffPricing,
      );
    }

    const nextStartDate =
      b.startDate === undefined
        ? project.startDate
        : b.startDate === null
          ? null
          : dateFromYmd(b.startDate);
    const nextEndDate =
      b.endDate === undefined
        ? project.endDate
        : b.endDate === null
          ? null
          : dateFromYmd(b.endDate);
    if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
      return c.json({ error: "End date must be on or after start date" }, 400);
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data,
    });
    await logActivitySafe(project.workspaceId, ActivityType.PROJECT_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: projectId,
      projectId,
      metadata: { updatedFields: Object.keys(data) },
    });
    return c.json(projectDetailApiJson(updated));
  });

  registerCloudRoutes(r, needUser, env, auth);
  registerRfiRoutes(r, needUser, env);
  registerProposalRoutes(r, needUser, env);

  r.get("/projects/:projectId/field-reports", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const list = await prisma.fieldReport.findMany({
      where: { projectId },
      orderBy: { reportDate: "desc" },
    });
    return c.json(
      list.map((row) => ({
        ...row,
        reportDate: row.reportDate.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
  });

  r.post("/projects/:projectId/field-reports", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const body = z
      .object({
        reportDate: z.string().datetime(),
        weather: z.string().max(500).optional(),
        authorLabel: z.string().max(200).optional(),
        photoCount: z.number().int().min(0).optional(),
        issueCount: z.number().int().min(0).optional(),
        notes: z.string().max(10000).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const row = await prisma.fieldReport.create({
      data: {
        projectId,
        reportDate: new Date(body.data.reportDate),
        weather: body.data.weather,
        authorLabel: body.data.authorLabel,
        photoCount: body.data.photoCount ?? 0,
        issueCount: body.data.issueCount ?? 0,
        notes: body.data.notes,
      },
    });
    await logActivity(res.project.workspaceId, ActivityType.FIELD_REPORT_CREATED, {
      actorUserId: c.get("user").id,
      entityId: row.id,
      projectId,
      metadata: { reportDate: row.reportDate.toISOString() },
    });
    return c.json({
      ...row,
      reportDate: row.reportDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  r.patch("/projects/:projectId/field-reports/:reportId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const reportId = c.req.param("reportId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const existing = await prisma.fieldReport.findFirst({ where: { id: reportId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);
    const body = z
      .object({
        reportDate: z.string().datetime().optional(),
        weather: z.string().max(500).nullable().optional(),
        authorLabel: z.string().max(200).nullable().optional(),
        photoCount: z.number().int().min(0).optional(),
        issueCount: z.number().int().min(0).optional(),
        notes: z.string().max(10000).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const { reportDate, ...frRest } = body.data;
    const row = await prisma.fieldReport.update({
      where: { id: reportId },
      data: {
        ...frRest,
        reportDate: reportDate === undefined ? undefined : new Date(reportDate),
      },
    });
    await logActivity(res.project.workspaceId, ActivityType.FIELD_REPORT_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: row.id,
      projectId,
      metadata: { reportDate: row.reportDate.toISOString() },
    });
    return c.json({
      ...row,
      reportDate: row.reportDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  r.delete("/projects/:projectId/field-reports/:reportId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const reportId = c.req.param("reportId")!;
    const res = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const existing = await prisma.fieldReport.findFirst({ where: { id: reportId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);
    await logActivitySafe(res.project.workspaceId, ActivityType.FIELD_REPORT_DELETED, {
      actorUserId: c.get("user").id,
      entityId: existing.id,
      projectId,
      metadata: { reportDate: existing.reportDate.toISOString() },
    });
    await prisma.fieldReport.delete({ where: { id: reportId } });
    return c.json({ ok: true });
  });

  if (deps?.upgradeWebSocket) {
    const viewerCollabWsGuard: MiddlewareHandler = async (c, next) => {
      const fileVersionId = c.req.param("fileVersionId")!;
      const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: { include: { workspace: true } } } } },
      });
      if (!fv) return c.json({ error: "Not found" }, 404);
      const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
      if ("error" in access) return c.json({ error: access.error }, access.status);
      const gate = requirePro(fv.file.project.workspace);
      if (gate) return c.json({ error: gate.error }, gate.status);
      if (!collaborationEnabledForWorkspace(env, fv.file.project.workspace)) {
        return c.json({ error: "Collaboration disabled" }, 403);
      }
      const userRow = await prisma.user.findUnique({
        where: { id: c.get("user").id },
        select: { hideViewerPresence: true },
      });
      c.set("viewerCollabWs", {
        fileVersionId,
        listInPresence: !userRow?.hideViewerPresence,
      });
      await next();
    };
    r.get(
      "/file-versions/:fileVersionId/viewer-collab/ws",
      needUser,
      viewerCollabWsGuard,
      deps.upgradeWebSocket((c) => {
        const ctx = c.get("viewerCollabWs");
        if (!ctx) {
          return { onOpen() {}, onMessage() {}, onClose() {} };
        }
        return buildViewerCollabWsHandler({
          fileVersionId: ctx.fileVersionId,
          userId: c.get("user").id,
          listInPresence: ctx.listInPresence,
        });
      }),
    );
  }

  registerOccupantPublicRoutes(r, env);
  registerOmRoutes(r, needUser, env);
  registerPunchRoutes(r, needUser, env);
  registerIssuesRoutes(r, needUser, env, {
    onIssuesMutated: (fileVersionId) => {
      if (collaborationGloballyEnabled(env)) {
        broadcastIssuesChanged(fileVersionId);
      }
    },
  });
  registerTakeoffRoutes(r, needUser);
  registerSheetAiRoutes(r, needUser, env);
  registerMaterialsRoutes(r, needUser);
  registerScheduleRoutes(r, needUser);

  return r;
}
