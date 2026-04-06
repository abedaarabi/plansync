import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  ActivityType,
  Prisma,
  ProposalDeclineReason,
  ProposalStatus,
  WorkspaceRole,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember } from "../../lib/projectAccess.js";
import type { Env } from "../../lib/env.js";
import { logActivitySafe } from "../../lib/activity.js";
import { createUserNotifications } from "../../lib/userNotifications.js";
import { deleteObject, presignGet } from "../../lib/s3.js";
import {
  lineTotalFor,
  proposalMoneyBreakdown,
  sumLineTotals,
  toDec,
} from "../../lib/proposalMath.js";
import { sanitizeProposalCoverHtml } from "../../lib/proposalSanitize.js";
import {
  applyProposalTemplate,
  buildTakeoffTableHtml,
  formatMoneyAmount,
  type TemplateReplaceContext,
} from "../../lib/proposalTemplateVars.js";
import { buildProposalPdfBuffer, dataUrlToPngBuffer } from "../../lib/proposalPdf.js";
import {
  proposalAppHref,
  proposalPortalUrl,
  sendProposalAcceptedToClient,
  sendProposalAcceptedToSender,
  sendProposalChangeRequestedToSender,
  sendProposalDeclinedToSender,
  sendProposalExpiringReminderToSender,
  assertProposalEmailReady,
  sendProposalPortalReplyToClient,
  sendProposalSentToClient,
  sendProposalViewedToSender,
} from "../../lib/proposalEmail.js";
import { geminiConfigured } from "../../lib/geminiSheetAi.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveGeminiApiKey } from "../../lib/env.js";
import {
  fetchWorkspaceLogoImageBuffer,
  prepareWorkspaceLogoBufferForPdf,
  workspaceLogoUrlForClients,
} from "../../lib/workspaceLogo.js";

function requirePro(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspacePro(workspace)) {
    return { error: "Pro subscription required", status: 402 as const };
  }
  return null;
}

const takeoffInclude = {
  file: { select: { name: true } },
  fileVersion: { select: { version: true } },
  material: {
    select: { unitPrice: true, currency: true },
  },
} as const;

function newPublicToken(): string {
  return randomBytes(32).toString("base64url");
}

function safeEqualToken(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

const proposalFullInclude = {
  items: { orderBy: { sortOrder: "asc" as const } },
  attachments: {
    include: {
      fileVersion: {
        select: { id: true, version: true, s3Key: true, file: { select: { name: true } } },
      },
    },
  },
  template: true,
  createdBy: { select: { id: true, name: true, email: true } },
  workspace: { select: { id: true, name: true, logoUrl: true, logoS3Key: true } },
  project: { select: { id: true, name: true, currency: true } },
  takeoffSources: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      fileVersion: {
        select: { id: true, version: true, file: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

type ProposalFull = Prisma.ProposalGetPayload<{ include: typeof proposalFullInclude }>;

function proposalAllowsCompanyEdit(status: ProposalStatus): boolean {
  return (
    status === ProposalStatus.DRAFT ||
    status === ProposalStatus.CHANGE_REQUESTED ||
    status === ProposalStatus.SENT ||
    status === ProposalStatus.VIEWED
  );
}

function declineReasonLabel(r: ProposalDeclineReason): string {
  switch (r) {
    case "PRICE_TOO_HIGH":
      return "Price too high";
    case "TIMING":
      return "Timing doesn't work";
    case "SCOPE":
      return "Scope not right";
    case "OTHER_COMPANY":
      return "Going with another company";
    default:
      return "Other";
  }
}

function proposalLineJson(row: {
  id: string;
  itemName: string;
  quantity: Prisma.Decimal;
  unit: string;
  rate: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  sortOrder: number;
  sourceTakeoffLineId: string | null;
}) {
  return {
    id: row.id,
    itemName: row.itemName,
    quantity: row.quantity.toString(),
    unit: row.unit,
    rate: row.rate.toString(),
    lineTotal: row.lineTotal.toString(),
    sortOrder: row.sortOrder,
    sourceTakeoffLineId: row.sourceTakeoffLineId,
  };
}

function proposalJson(p: ProposalFull, env: Env) {
  const takeoffList = p.takeoffSources.map((t) => ({
    fileVersionId: t.fileVersionId,
    fileName: t.fileVersion.file.name,
    version: t.fileVersion.version,
  }));
  const sourceFileVersionIds = takeoffList.map((t) => t.fileVersionId);
  const primaryTakeoff = takeoffList[0];
  const money = proposalBreakdown(p);
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    projectId: p.projectId,
    createdById: p.createdById,
    templateId: p.templateId,
    sourceFileVersionIds,
    /** @deprecated First linked takeoff; use sourceFileVersionIds */
    sourceFileVersionId: primaryTakeoff?.fileVersionId ?? null,
    takeoffSources: takeoffList,
    sequenceNumber: p.sequenceNumber,
    reference: p.reference,
    title: p.title,
    status: p.status,
    clientName: p.clientName,
    clientEmail: p.clientEmail,
    clientCompany: p.clientCompany,
    clientPhone: p.clientPhone,
    validUntil: p.validUntil.toISOString(),
    currency: p.currency,
    subtotal: p.subtotal.toString(),
    taxPercent: p.taxPercent.toString(),
    workPricePercent: p.workPricePercent.toString(),
    workAmount: money.workAmount.toString(),
    taxableSubtotal: money.taxableBase.toString(),
    taxAmount: money.taxAmount.toString(),
    discount: p.discount.toString(),
    total: p.total.toString(),
    coverNote: p.coverNote,
    publicToken: p.publicToken,
    signerName: p.signerName,
    acceptedAt: p.acceptedAt?.toISOString() ?? null,
    declinedAt: p.declinedAt?.toISOString() ?? null,
    declineReason: p.declineReason,
    declineComment: p.declineComment,
    changeRequestComment: p.changeRequestComment,
    changeRequestedAt: p.changeRequestedAt?.toISOString() ?? null,
    sentAt: p.sentAt?.toISOString() ?? null,
    firstViewedAt: p.firstViewedAt?.toISOString() ?? null,
    pdfS3Key: p.pdfS3Key,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    items: p.items.map(proposalLineJson),
    attachments: p.attachments.map((a) => ({
      fileVersionId: a.fileVersionId,
      fileName: a.fileVersion.file.name,
      version: a.fileVersion.version,
    })),
    template: p.template
      ? { id: p.template.id, name: p.template.name, defaultsJson: p.template.defaultsJson }
      : null,
    createdBy: p.createdBy,
    workspaceName: p.workspace.name,
    workspaceLogoUrl: workspaceLogoUrlForClients(env, {
      id: p.workspace.id,
      logoS3Key: p.workspace.logoS3Key,
      logoUrl: p.workspace.logoUrl,
    }),
    projectName: p.project.name,
    sourceFileVersion: primaryTakeoff
      ? {
          id: primaryTakeoff.fileVersionId,
          version: primaryTakeoff.version,
          fileName: primaryTakeoff.fileName,
        }
      : null,
  };
}

/** Cover text for PDFs: same merge as preview/email, but omit {{takeoff.table}} (shown in breakdown below). */
function mergedProposalCoverForPdf(p: ProposalFull): string {
  const ctxIntro = buildTemplateContext(p, "");
  let bodyText = p.template?.body ?? p.coverNote;
  if (p.template?.body) {
    bodyText = applyProposalTemplate(p.template.body, ctxIntro);
  }
  const mergedIntro = applyProposalTemplate(bodyText, ctxIntro);
  try {
    return sanitizeProposalCoverHtml(mergedIntro);
  } catch {
    return mergedIntro;
  }
}

function buildTemplateContext(p: ProposalFull, takeoffTableHtml: string): TemplateReplaceContext {
  return {
    clientName: p.clientName,
    clientCompany: p.clientCompany,
    projectName: p.project.name,
    companyName: p.workspace.name,
    userName: p.createdBy.name,
    userTitle: "",
    proposalReference: p.reference,
    proposalTotalFormatted: formatMoneyAmount(p.total.toString(), p.currency),
    proposalExpiryFormatted: p.validUntil.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    takeoffTableHtml,
  };
}

function proposalBreakdown(p: ProposalFull) {
  return proposalMoneyBreakdown({
    lineSubtotal: p.subtotal,
    taxPercent: p.taxPercent,
    discount: p.discount,
    workPricePercent: p.workPricePercent,
  });
}

function takeoffTableHtmlFromProposalFull(p: ProposalFull): string {
  const br = proposalBreakdown(p);
  return buildTakeoffTableHtml({
    items: p.items.map((it) => ({
      itemName: it.itemName,
      quantity: it.quantity.toString(),
      unit: it.unit,
      rate: formatMoneyAmount(it.rate.toString(), p.currency),
      lineTotal: formatMoneyAmount(it.lineTotal.toString(), p.currency),
    })),
    subtotal: formatMoneyAmount(p.subtotal.toString(), p.currency),
    workPricePercent: p.workPricePercent.toString(),
    workAmount: formatMoneyAmount(br.workAmount.toString(), p.currency),
    taxPercent: p.taxPercent.toString(),
    taxAmount: formatMoneyAmount(br.taxAmount.toString(), p.currency),
    discount: formatMoneyAmount(p.discount.toString(), p.currency),
    total: formatMoneyAmount(p.total.toString(), p.currency),
    currency: p.currency,
  });
}

async function recalcAndSaveProposalTotals(proposalId: string): Promise<ProposalFull> {
  const items = await prisma.proposalItem.findMany({
    where: { proposalId },
    orderBy: { sortOrder: "asc" },
  });
  const subtotal = sumLineTotals(items);
  const prop = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    select: { taxPercent: true, discount: true, workPricePercent: true },
  });
  const { total } = proposalMoneyBreakdown({
    lineSubtotal: subtotal,
    taxPercent: prop.taxPercent,
    discount: prop.discount,
    workPricePercent: prop.workPricePercent,
  });
  await prisma.proposal.update({
    where: { id: proposalId },
    data: { subtotal, total, discount: prop.discount },
  });
  return prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: proposalFullInclude,
  });
}

export function registerProposalRoutes(r: Hono, needUser: MiddlewareHandler, env: Env) {
  r.get("/projects/:projectId/proposals/takeoff-file-versions", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const files = await prisma.file.findMany({
      where: { projectId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          select: { id: true, version: true, label: true },
        },
      },
      orderBy: { name: "asc" },
    });
    const out: { id: string; label: string; fileId: string; fileName: string; version: number }[] =
      [];
    for (const f of files) {
      for (const v of f.versions) {
        out.push({
          id: v.id,
          fileId: f.id,
          fileName: f.name,
          version: v.version,
          label: `${f.name} · v${v.version}${v.label ? ` (${v.label})` : ""}`,
        });
      }
    }
    return c.json({ fileVersions: out });
  });

  r.get("/projects/:projectId/proposals", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const list = await prisma.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    });

    const pipelineStatuses: ProposalStatus[] = [
      ProposalStatus.DRAFT,
      ProposalStatus.SENT,
      ProposalStatus.VIEWED,
      ProposalStatus.CHANGE_REQUESTED,
    ];
    let pipelineCents = new Prisma.Decimal(0);
    let accepted = 0;
    let sent = 0;
    let draft = 0;
    let declined = 0;
    for (const row of list) {
      if (pipelineStatuses.includes(row.status)) {
        pipelineCents = pipelineCents.add(row.total);
      }
      if (row.status === ProposalStatus.ACCEPTED) accepted += 1;
      if (row.status === ProposalStatus.SENT || row.status === ProposalStatus.VIEWED) sent += 1;
      if (row.status === ProposalStatus.DRAFT) draft += 1;
      if (row.status === ProposalStatus.DECLINED) declined += 1;
    }

    return c.json({
      proposals: list.map((p) => ({
        id: p.id,
        sequenceNumber: p.sequenceNumber,
        reference: p.reference,
        title: p.title,
        status: p.status,
        clientName: p.clientName,
        clientEmail: p.clientEmail,
        sentAt: p.sentAt?.toISOString() ?? null,
        total: p.total.toString(),
        currency: p.currency,
        createdAt: p.createdAt.toISOString(),
        createdByName: p.createdBy.name,
      })),
      stats: {
        pipelineTotal: pipelineCents.toString(),
        accepted,
        sent,
        draft,
        declined,
      },
    });
  });

  r.post("/projects/:projectId/proposals", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        title: z.string().min(1).max(500),
        clientName: z.string().min(1).max(200),
        clientEmail: z.string().email(),
        clientCompany: z.string().max(200).optional().nullable(),
        clientPhone: z.string().max(80).optional().nullable(),
        currency: z.string().length(3).optional(),
        validUntil: z.string().datetime().optional(),
        templateId: z.string().optional().nullable(),
        /** @deprecated use sourceFileVersionIds */
        sourceFileVersionId: z.string().optional().nullable(),
        sourceFileVersionIds: z.array(z.string()).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const takeoffFvIds = [
      ...(body.data.sourceFileVersionIds ?? []),
      ...(body.data.sourceFileVersionId ? [body.data.sourceFileVersionId] : []),
    ];
    const uniqueTakeoffFvIds = [...new Set(takeoffFvIds.filter(Boolean))];
    for (const fid of uniqueTakeoffFvIds) {
      const fv = await prisma.fileVersion.findUnique({
        where: { id: fid },
        include: { file: true },
      });
      if (!fv || fv.file.projectId !== projectId) {
        return c.json({ error: "Invalid takeoff file version" }, 400);
      }
    }

    const year = new Date().getUTCFullYear();
    const agg = await prisma.proposal.aggregate({
      where: { projectId },
      _max: { sequenceNumber: true },
    });
    const sequenceNumber = (agg._max.sequenceNumber ?? 0) + 1;
    const reference = `PROP-${year}-${String(sequenceNumber).padStart(3, "0")}`;
    const validUntil = body.data.validUntil
      ? new Date(body.data.validUntil)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const currency = body.data.currency ?? access.project.currency;
    const zdec = new Prisma.Decimal(0);

    const created = await prisma.proposal.create({
      data: {
        workspaceId: access.project.workspaceId,
        projectId,
        createdById: c.get("user").id,
        templateId: body.data.templateId ?? undefined,
        sequenceNumber,
        reference,
        title: body.data.title,
        status: ProposalStatus.DRAFT,
        clientName: body.data.clientName,
        clientEmail: body.data.clientEmail,
        clientCompany: body.data.clientCompany ?? null,
        clientPhone: body.data.clientPhone ?? null,
        validUntil,
        currency,
        subtotal: zdec,
        taxPercent: zdec,
        discount: zdec,
        total: zdec,
        coverNote: "",
        takeoffSources: {
          create: uniqueTakeoffFvIds.map((fileVersionId, sortOrder) => ({
            fileVersionId,
            sortOrder,
          })),
        },
      },
      include: proposalFullInclude,
    });

    await logActivitySafe(access.project.workspaceId, ActivityType.PROPOSAL_CREATED, {
      actorUserId: c.get("user").id,
      entityId: created.id,
      projectId,
      metadata: { reference, title: created.title },
    });

    return c.json(proposalJson(created, env));
  });

  r.get("/projects/:projectId/proposals/:proposalId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: proposalFullInclude,
    });
    if (!p) return c.json({ error: "Not found" }, 404);
    return c.json(proposalJson(p, env));
  });

  r.patch("/projects/:projectId/proposals/:proposalId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
    });
    if (!p) return c.json({ error: "Not found" }, 404);
    if (!proposalAllowsCompanyEdit(p.status)) {
      return c.json({ error: "Proposal is not editable" }, 400);
    }

    const body = z
      .object({
        title: z.string().min(1).max(500).optional(),
        clientName: z.string().min(1).max(200).optional(),
        clientEmail: z.string().email().optional(),
        clientCompany: z.string().max(200).optional().nullable(),
        clientPhone: z.string().max(80).optional().nullable(),
        currency: z.string().length(3).optional(),
        validUntil: z.string().datetime().optional(),
        templateId: z.string().optional().nullable(),
        /** @deprecated use sourceFileVersionIds */
        sourceFileVersionId: z.string().optional().nullable(),
        sourceFileVersionIds: z.array(z.string()).optional(),
        taxPercent: z.union([z.number(), z.string()]).optional(),
        workPricePercent: z.union([z.number(), z.string()]).optional(),
        discount: z.union([z.number(), z.string()]).optional(),
        coverNote: z.string().max(200_000).optional(),
        attachmentFileVersionIds: z.array(z.string()).optional(),
        items: z
          .array(
            z.object({
              id: z.string().optional(),
              itemName: z.string().min(1).max(500),
              quantity: z.union([z.number(), z.string()]),
              unit: z.string().max(32),
              rate: z.union([z.number(), z.string()]),
              sortOrder: z.number().optional(),
              sourceTakeoffLineId: z.string().optional().nullable(),
            }),
          )
          .optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const data: Prisma.ProposalUpdateInput = {};
    if (body.data.title !== undefined) data.title = body.data.title;
    if (body.data.clientName !== undefined) data.clientName = body.data.clientName;
    if (body.data.clientEmail !== undefined) data.clientEmail = body.data.clientEmail;
    if (body.data.clientCompany !== undefined) data.clientCompany = body.data.clientCompany;
    if (body.data.clientPhone !== undefined) data.clientPhone = body.data.clientPhone;
    if (body.data.currency !== undefined) data.currency = body.data.currency;
    if (body.data.validUntil !== undefined) data.validUntil = new Date(body.data.validUntil);
    if (body.data.templateId !== undefined)
      data.template = body.data.templateId
        ? { connect: { id: body.data.templateId } }
        : { disconnect: true };

    const patchTakeoffIds =
      body.data.sourceFileVersionIds !== undefined
        ? body.data.sourceFileVersionIds
        : body.data.sourceFileVersionId !== undefined
          ? body.data.sourceFileVersionId
            ? [body.data.sourceFileVersionId]
            : []
          : undefined;
    if (patchTakeoffIds !== undefined) {
      for (const fid of patchTakeoffIds) {
        const fv = await prisma.fileVersion.findUnique({
          where: { id: fid },
          include: { file: true },
        });
        if (!fv || fv.file.projectId !== projectId) {
          return c.json({ error: "Invalid takeoff file version" }, 400);
        }
      }
      await prisma.proposalTakeoffSource.deleteMany({ where: { proposalId } });
      await prisma.proposalTakeoffSource.createMany({
        data: patchTakeoffIds.map((fileVersionId, sortOrder) => ({
          proposalId,
          fileVersionId,
          sortOrder,
        })),
      });
    }
    if (body.data.taxPercent !== undefined) data.taxPercent = toDec(body.data.taxPercent);
    if (body.data.workPricePercent !== undefined)
      data.workPricePercent = toDec(body.data.workPricePercent);
    if (body.data.discount !== undefined) data.discount = toDec(body.data.discount);
    if (body.data.coverNote !== undefined) {
      try {
        data.coverNote = sanitizeProposalCoverHtml(body.data.coverNote);
      } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : "Invalid cover note" }, 400);
      }
    }

    await prisma.proposal.update({ where: { id: proposalId }, data });

    if (body.data.items) {
      await prisma.proposalItem.deleteMany({ where: { proposalId } });
      let order = 0;
      for (const it of body.data.items) {
        const qty = toDec(it.quantity);
        const rate = toDec(it.rate);
        const lt = lineTotalFor(qty, rate);
        await prisma.proposalItem.create({
          data: {
            proposalId,
            itemName: it.itemName,
            quantity: qty,
            unit: it.unit,
            rate,
            lineTotal: lt,
            sortOrder: it.sortOrder ?? order,
            sourceTakeoffLineId: it.sourceTakeoffLineId ?? null,
          },
        });
        order += 1;
      }
    }

    if (body.data.attachmentFileVersionIds) {
      await prisma.proposalAttachment.deleteMany({ where: { proposalId } });
      for (const fid of body.data.attachmentFileVersionIds) {
        const fv = await prisma.fileVersion.findUnique({
          where: { id: fid },
          include: { file: true },
        });
        if (!fv || fv.file.projectId !== projectId) continue;
        await prisma.proposalAttachment.create({
          data: { proposalId, fileVersionId: fid },
        });
      }
    }

    const updated = await recalcAndSaveProposalTotals(proposalId);
    return c.json(proposalJson(updated, env));
  });

  r.post(
    "/projects/:projectId/proposals/:proposalId/items/sync-from-takeoff",
    needUser,
    async (c) => {
      const projectId = c.req.param("projectId")!;
      const proposalId = c.req.param("proposalId")!;
      const access = await loadProjectForMember(projectId, c.get("user").id);
      if ("error" in access) return c.json({ error: access.error }, access.status);
      const gate = requirePro(access.project.workspace);
      if (gate) return c.json({ error: gate.error }, gate.status);

      const p = await prisma.proposal.findFirst({ where: { id: proposalId, projectId } });
      if (!p) return c.json({ error: "Not found" }, 404);
      if (!proposalAllowsCompanyEdit(p.status)) {
        return c.json({ error: "Proposal is not editable" }, 400);
      }

      const body = z
        .object({
          fileVersionId: z.string().optional(),
          fileVersionIds: z.array(z.string()).optional(),
          mode: z.enum(["replace", "quantities_only"]).optional(),
        })
        .safeParse(await c.req.json());
      if (!body.success) return c.json({ error: body.error.flatten() }, 400);

      const ids = [
        ...new Set(
          [
            ...(body.data.fileVersionIds ?? []),
            ...(body.data.fileVersionId ? [body.data.fileVersionId] : []),
          ].filter(Boolean),
        ),
      ];
      const mode = body.data.mode ?? "replace";

      if (mode === "replace" && ids.length === 0) {
        return c.json({ error: "Pass fileVersionId or a non-empty fileVersionIds array" }, 400);
      }

      async function assertFvsInProject(fvIds: string[]) {
        for (const fid of fvIds) {
          const fv = await prisma.fileVersion.findUnique({
            where: { id: fid },
            include: { file: true },
          });
          if (!fv || fv.file.projectId !== projectId) {
            return c.json({ error: "File version not found" }, 404);
          }
        }
        return null;
      }

      if (mode === "replace") {
        const bad = await assertFvsInProject(ids);
        if (bad) return bad;
      }

      if (mode === "replace") {
        await prisma.proposalItem.deleteMany({ where: { proposalId } });
        await prisma.proposalTakeoffSource.deleteMany({ where: { proposalId } });
        await prisma.proposalTakeoffSource.createMany({
          data: ids.map((fileVersionId, sortOrder) => ({ proposalId, fileVersionId, sortOrder })),
        });
        let order = 0;
        for (const fid of ids) {
          const lines = await prisma.takeoffLine.findMany({
            where: { fileVersionId: fid },
            include: takeoffInclude,
            orderBy: { createdAt: "asc" },
          });
          for (const tl of lines) {
            let rate = new Prisma.Decimal(0);
            if (tl.materialId && tl.material?.unitPrice != null) {
              rate = tl.material.unitPrice;
            }
            const qty = tl.quantity;
            const lt = lineTotalFor(qty, rate);
            const name = tl.label?.trim() || "Item";
            await prisma.proposalItem.create({
              data: {
                proposalId,
                itemName: name,
                quantity: qty,
                unit: tl.unit,
                rate,
                lineTotal: lt,
                sortOrder: order++,
                sourceTakeoffLineId: tl.id,
              },
            });
          }
        }
      } else {
        const links = await prisma.proposalTakeoffSource.findMany({
          where: { proposalId },
          orderBy: { sortOrder: "asc" },
        });
        const effectiveIds = ids.length > 0 ? ids : links.map((l) => l.fileVersionId);
        if (effectiveIds.length === 0) {
          return c.json(
            {
              error:
                "No takeoff revisions linked — run a full load (replace) first or pass fileVersionIds",
            },
            400,
          );
        }
        const bad = await assertFvsInProject(effectiveIds);
        if (bad) return bad;
        const lines = await prisma.takeoffLine.findMany({
          where: { fileVersionId: { in: effectiveIds } },
          include: takeoffInclude,
        });
        const existing = await prisma.proposalItem.findMany({ where: { proposalId } });
        const byTakeoff = new Map(
          existing.filter((x) => x.sourceTakeoffLineId).map((x) => [x.sourceTakeoffLineId!, x]),
        );
        for (const tl of lines) {
          const ex = byTakeoff.get(tl.id);
          if (ex) {
            const qty = tl.quantity;
            const lt = lineTotalFor(qty, ex.rate);
            await prisma.proposalItem.update({
              where: { id: ex.id },
              data: {
                quantity: qty,
                lineTotal: lt,
                itemName: tl.label?.trim() || ex.itemName,
                unit: tl.unit,
              },
            });
          }
        }
      }

      const updated = await recalcAndSaveProposalTotals(proposalId);
      return c.json(proposalJson(updated, env));
    },
  );

  r.post("/projects/:projectId/proposals/:proposalId/preview", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: proposalFullInclude,
    });
    if (!p) return c.json({ error: "Not found" }, 404);

    const table = takeoffTableHtmlFromProposalFull(p);
    const ctx = buildTemplateContext(p, table);
    let bodyText = p.template?.body ?? p.coverNote;
    if (p.template?.body) {
      bodyText = applyProposalTemplate(p.template.body, ctx);
    }
    const merged = applyProposalTemplate(bodyText, ctx);
    let html: string;
    try {
      html = sanitizeProposalCoverHtml(merged);
    } catch {
      html = merged;
    }

    const ctxNoTable = buildTemplateContext(p, "");
    let bodyLetter = p.template?.body ?? p.coverNote;
    if (p.template?.body) {
      bodyLetter = applyProposalTemplate(p.template.body, ctxNoTable);
    }
    const mergedLetterOnly = applyProposalTemplate(bodyLetter, ctxNoTable).trim();
    let letterHtml: string | null = null;
    let letterMarkdown = mergedLetterOnly;
    if (/^\s*</.test(mergedLetterOnly) && /<[a-z]/i.test(mergedLetterOnly)) {
      try {
        letterHtml = sanitizeProposalCoverHtml(mergedLetterOnly);
        letterMarkdown = "";
      } catch {
        letterHtml = null;
        letterMarkdown = mergedLetterOnly;
      }
    }

    return c.json({
      html,
      takeoffTableHtml: table,
      letterMarkdown,
      letterHtml,
    });
  });

  r.post("/projects/:projectId/proposals/:proposalId/send", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: { ...proposalFullInclude, items: true },
    });
    if (!p) return c.json({ error: "Not found" }, 404);
    if (p.status !== ProposalStatus.DRAFT && p.status !== ProposalStatus.CHANGE_REQUESTED) {
      return c.json({ error: "Only draft or change-requested proposals can be sent" }, 400);
    }
    if (p.items.length === 0) return c.json({ error: "Add line items before sending" }, 400);
    if (!p.clientEmail?.trim()) return c.json({ error: "Client email required" }, 400);

    try {
      assertProposalEmailReady(env);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Email not configured" }, 400);
    }

    const token = p.publicToken ?? newPublicToken();
    const table = takeoffTableHtmlFromProposalFull(p);
    const ctx = buildTemplateContext(p, table);
    let letter = p.template?.body ? applyProposalTemplate(p.template.body, ctx) : p.coverNote;
    letter = applyProposalTemplate(letter, ctx);
    let coverSanitized: string;
    try {
      coverSanitized = sanitizeProposalCoverHtml(letter);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Invalid letter HTML" }, 400);
    }

    const snapshot = {
      reference: p.reference,
      title: p.title,
      coverNote: coverSanitized,
      items: p.items.map((it) => ({
        itemName: it.itemName,
        quantity: it.quantity.toString(),
        unit: it.unit,
        rate: it.rate.toString(),
        lineTotal: it.lineTotal.toString(),
      })),
      subtotal: p.subtotal.toString(),
      taxPercent: p.taxPercent.toString(),
      workPricePercent: p.workPricePercent.toString(),
      discount: p.discount.toString(),
      total: p.total.toString(),
      sentAt: new Date().toISOString(),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: ProposalStatus.SENT,
          publicToken: token,
          sentAt: new Date(),
          coverNote: coverSanitized,
        },
        include: proposalFullInclude,
      });
      await tx.proposalRevision.create({
        data: { proposalId, snapshot: snapshot as Prisma.InputJsonValue },
      });
      return u;
    });

    const sender = await prisma.user.findUnique({ where: { id: c.get("user").id } });
    try {
      await sendProposalSentToClient({
        env,
        toEmail: p.clientEmail,
        clientName: p.clientName,
        reference: p.reference,
        title: p.title,
        senderName: sender?.name ?? "PlanSync user",
        portalUrl: proposalPortalUrl(env, token),
        workspaceLogoUrl: workspaceLogoUrlForClients(env, updated.workspace),
      });
    } catch (e) {
      console.error("[proposal] send email failed", e);
      return c.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "The proposal was saved as sent, but the email could not be delivered. Use Resend to resend.",
        },
        502,
      );
    }

    await logActivitySafe(access.project.workspaceId, ActivityType.PROPOSAL_SENT, {
      actorUserId: c.get("user").id,
      entityId: proposalId,
      projectId,
      metadata: { reference: p.reference, title: p.title },
    });

    return c.json(proposalJson(updated, env));
  });

  r.post("/projects/:projectId/proposals/:proposalId/resend", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: {
        createdBy: { select: { name: true } },
        workspace: { select: { id: true, logoUrl: true, logoS3Key: true } },
      },
    });
    if (!p) return c.json({ error: "Not found" }, 404);
    if (!p.publicToken) return c.json({ error: "Proposal was never sent" }, 400);
    if (p.status === ProposalStatus.ACCEPTED || p.status === ProposalStatus.DECLINED) {
      return c.json({ error: "Cannot resend this proposal" }, 400);
    }
    if (p.validUntil < new Date()) return c.json({ error: "Proposal has expired" }, 400);

    try {
      assertProposalEmailReady(env);
      await sendProposalSentToClient({
        env,
        toEmail: p.clientEmail,
        clientName: p.clientName,
        reference: p.reference,
        title: p.title,
        senderName: p.createdBy.name,
        portalUrl: proposalPortalUrl(env, p.publicToken),
        workspaceLogoUrl: workspaceLogoUrlForClients(env, p.workspace),
      });
    } catch (e) {
      console.error("[proposal] resend email failed", e);
      return c.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "Could not send email. Check RESEND_API_KEY and RESEND_FROM.",
        },
        502,
      );
    }

    await logActivitySafe(access.project.workspaceId, ActivityType.PROPOSAL_RESENT, {
      actorUserId: c.get("user").id,
      entityId: proposalId,
      projectId,
      metadata: { reference: p.reference },
    });

    return c.json({ ok: true });
  });

  r.post("/projects/:projectId/proposals/:proposalId/duplicate", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: {
        items: true,
        attachments: true,
        takeoffSources: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!p) return c.json({ error: "Not found" }, 404);

    const agg = await prisma.proposal.aggregate({
      where: { projectId },
      _max: { sequenceNumber: true },
    });
    const sequenceNumber = (agg._max.sequenceNumber ?? 0) + 1;
    const year = new Date().getUTCFullYear();
    const reference = `PROP-${year}-${String(sequenceNumber).padStart(3, "0")}`;
    const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const copy = await prisma.proposal.create({
      data: {
        workspaceId: p.workspaceId,
        projectId,
        createdById: c.get("user").id,
        templateId: p.templateId,
        sequenceNumber,
        reference,
        title: `${p.title} (copy)`,
        status: ProposalStatus.DRAFT,
        clientName: p.clientName,
        clientEmail: p.clientEmail,
        clientCompany: p.clientCompany,
        clientPhone: p.clientPhone,
        validUntil,
        currency: p.currency,
        subtotal: p.subtotal,
        taxPercent: p.taxPercent,
        discount: p.discount,
        total: p.total,
        coverNote: p.coverNote,
        items: {
          create: p.items.map((it, i) => ({
            itemName: it.itemName,
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            lineTotal: it.lineTotal,
            sortOrder: i,
            sourceTakeoffLineId: it.sourceTakeoffLineId,
          })),
        },
        attachments: {
          create: p.attachments.map((a) => ({ fileVersionId: a.fileVersionId })),
        },
        takeoffSources: {
          create: p.takeoffSources.map((t, i) => ({
            fileVersionId: t.fileVersionId,
            sortOrder: i,
          })),
        },
      },
      include: proposalFullInclude,
    });

    await logActivitySafe(access.project.workspaceId, ActivityType.PROPOSAL_CREATED, {
      actorUserId: c.get("user").id,
      entityId: copy.id,
      projectId,
      metadata: { reference: copy.reference, title: copy.title, duplicatedFrom: proposalId },
    });

    return c.json(proposalJson(copy, env));
  });

  r.delete("/projects/:projectId/proposals/:proposalId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      select: { id: true, reference: true, title: true, pdfS3Key: true, workspaceId: true },
    });
    if (!p) return c.json({ error: "Not found" }, 404);

    if (p.pdfS3Key) {
      await deleteObject(env, p.pdfS3Key);
    }

    await prisma.proposal.delete({ where: { id: proposalId } });

    await logActivitySafe(p.workspaceId, ActivityType.PROPOSAL_DELETED, {
      actorUserId: c.get("user").id,
      entityId: proposalId,
      projectId,
      metadata: { reference: p.reference, title: p.title },
    });

    return c.json({ ok: true });
  });

  r.get("/projects/:projectId/proposals/:proposalId/pdf", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: proposalFullInclude,
    });
    if (!p) return c.json({ error: "Not found" }, 404);

    const br = proposalBreakdown(p);
    const rawLogo = await fetchWorkspaceLogoImageBuffer(env, p.workspace);
    const logoBuf = await prepareWorkspaceLogoBufferForPdf(rawLogo);
    const buf = await buildProposalPdfBuffer({
      title: p.title,
      reference: p.reference,
      workspaceName: p.workspace.name,
      clientName: p.clientName,
      clientCompany: p.clientCompany ?? undefined,
      projectName: p.project.name,
      validUntilLabel: p.validUntil.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      coverHtml: mergedProposalCoverForPdf(p),
      lines: p.items.map((it) => ({
        itemName: it.itemName,
        quantity: it.quantity.toString(),
        unit: it.unit,
        rate: formatMoneyAmount(it.rate.toString(), p.currency),
        lineTotal: formatMoneyAmount(it.lineTotal.toString(), p.currency),
      })),
      subtotal: formatMoneyAmount(p.subtotal.toString(), p.currency),
      workFeeLabel: p.workPricePercent.gt(0)
        ? `Work (${p.workPricePercent.toString()}%)`
        : undefined,
      workFeeAmount: p.workPricePercent.gt(0)
        ? formatMoneyAmount(br.workAmount.toString(), p.currency)
        : undefined,
      taxLabel: `Tax (${p.taxPercent.toString()}%)`,
      taxAmount: formatMoneyAmount(br.taxAmount.toString(), p.currency),
      discount: formatMoneyAmount(p.discount.toString(), p.currency),
      total: formatMoneyAmount(p.total.toString(), p.currency),
      signedAtIso: p.acceptedAt?.toISOString(),
      signerName: p.signerName ?? undefined,
      signaturePngBuffer: p.signatureData ? dataUrlToPngBuffer(p.signatureData) : null,
      logoImageBuffer: logoBuf,
    });

    const safeName = p.reference.replace(/[^a-z0-9-_]/gi, "_");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-proposal.pdf"`,
      },
    });
  });

  r.get("/workspaces/:workspaceId/proposal-templates", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    const list = await prisma.proposalTemplate.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });
    return c.json({
      templates: list.map((t) => ({
        id: t.id,
        name: t.name,
        body: t.body,
        defaultsJson: t.defaultsJson,
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  });

  r.post("/workspaces/:workspaceId/proposal-templates", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    const body = z
      .object({
        name: z.string().min(1).max(200),
        body: z.string().min(1).max(200_000),
        defaultsJson: z.record(z.unknown()).optional().nullable(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const t = await prisma.proposalTemplate.create({
      data: {
        workspaceId,
        name: body.data.name,
        body: body.data.body,
        defaultsJson:
          body.data.defaultsJson !== undefined && body.data.defaultsJson !== null
            ? (body.data.defaultsJson as Prisma.InputJsonValue)
            : undefined,
      },
    });
    return c.json({
      id: t.id,
      name: t.name,
      body: t.body,
      defaultsJson: t.defaultsJson,
    });
  });

  r.patch("/workspaces/:workspaceId/proposal-templates/:templateId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const templateId = c.req.param("templateId")!;
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    const t = await prisma.proposalTemplate.findFirst({ where: { id: templateId, workspaceId } });
    if (!t) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        body: z.string().min(1).max(200_000).optional(),
        defaultsJson: z.record(z.unknown()).optional().nullable(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const updated = await prisma.proposalTemplate.update({
      where: { id: templateId },
      data: {
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.body !== undefined ? { body: body.data.body } : {}),
        ...(body.data.defaultsJson !== undefined
          ? {
              defaultsJson:
                body.data.defaultsJson === null
                  ? Prisma.JsonNull
                  : (body.data.defaultsJson as Prisma.InputJsonValue),
            }
          : {}),
      },
    });
    return c.json({
      id: updated.id,
      name: updated.name,
      body: updated.body,
      defaultsJson: updated.defaultsJson,
    });
  });

  r.delete("/workspaces/:workspaceId/proposal-templates/:templateId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const templateId = c.req.param("templateId")!;
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    if (m.role !== WorkspaceRole.ADMIN && m.role !== WorkspaceRole.SUPER_ADMIN) {
      return c.json({ error: "Admin only" }, 403);
    }
    const t = await prisma.proposalTemplate.findFirst({ where: { id: templateId, workspaceId } });
    if (!t) return c.json({ error: "Not found" }, 404);
    await prisma.proposalTemplate.delete({ where: { id: templateId } });
    return c.json({ ok: true });
  });

  r.post("/projects/:projectId/proposals/:proposalId/ai-draft", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (!geminiConfigured(env)) return c.json({ error: "AI is not configured" }, 503);

    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: { items: true, project: true, workspace: true },
    });
    if (!p) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({
        userPrompt: z.string().max(4000).optional(),
        section: z.enum(["cover", "executive_summary"]).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const key = resolveGeminiApiKey(env);
    if (!key) return c.json({ error: "AI is not configured" }, 503);

    const linesSummary = p.items
      .map(
        (it) =>
          `${it.itemName}: ${it.quantity.toString()} ${it.unit} @ ${it.rate.toString()} = ${it.lineTotal.toString()}`,
      )
      .join("\n");

    const prompt = `You are helping write a professional construction proposal cover letter (plain text or very simple markdown, no HTML).
Project: ${p.project.name}
Client: ${p.clientName}
Proposal ref: ${p.reference}
Total: ${p.total.toString()} ${p.currency}
Line items summary:
${linesSummary}

${body.data.userPrompt?.trim() ?? "Write a concise, professional opening letter."}

Rules: Do not invent quantities or prices. No legal guarantees. Keep under 400 words.`;

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL.trim() || "gemini-2.5-flash",
      generationConfig: { temperature: 0.35, maxOutputTokens: 2048 },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim() ?? "";
    if (!text) return c.json({ error: "Empty AI response" }, 502);

    return c.json({ text });
  });

  // --- Public (no auth) ---
  r.get("/public/proposals/:token", async (c) => {
    const token = c.req.param("token")!;
    const match = await prisma.proposal.findFirst({
      where: { publicToken: token },
      include: proposalFullInclude,
    });
    if (!match || !match.publicToken || !safeEqualToken(token, match.publicToken)) {
      return c.json({ error: "Not found" }, 404);
    }

    const now = new Date();
    let status = match.status;
    if (
      match.validUntil < now &&
      (status === ProposalStatus.SENT || status === ProposalStatus.VIEWED)
    ) {
      status = ProposalStatus.EXPIRED;
    }

    const pubMoney = proposalBreakdown(match);
    const attachmentsOut: {
      fileVersionId: string;
      fileName: string;
      version: number;
      readUrl: string | null;
    }[] = [];
    for (const a of match.attachments) {
      let readUrl: string | null = null;
      readUrl = await presignGet(env, a.fileVersion.s3Key);
      attachmentsOut.push({
        fileVersionId: a.fileVersionId,
        fileName: a.fileVersion.file.name,
        version: a.fileVersion.version,
        readUrl,
      });
    }

    return c.json({
      reference: match.reference,
      title: match.title,
      status,
      workspaceName: match.workspace.name,
      workspaceLogoUrl: workspaceLogoUrlForClients(env, {
        id: match.workspace.id,
        logoS3Key: match.workspace.logoS3Key,
        logoUrl: match.workspace.logoUrl,
      }),
      clientName: match.clientName,
      validUntil: match.validUntil.toISOString(),
      currency: match.currency,
      coverHtml: match.coverNote,
      subtotal: match.subtotal.toString(),
      taxPercent: match.taxPercent.toString(),
      workPricePercent: match.workPricePercent.toString(),
      workAmount: pubMoney.workAmount.toString(),
      taxableSubtotal: pubMoney.taxableBase.toString(),
      taxAmount: pubMoney.taxAmount.toString(),
      discount: match.discount.toString(),
      total: match.total.toString(),
      items: match.items.map(proposalLineJson),
      attachments: attachmentsOut,
      expired: match.validUntil < now,
    });
  });

  r.post("/public/proposals/:token/view", async (c) => {
    const token = c.req.param("token")!;
    const p = await prisma.proposal.findUnique({
      where: { publicToken: token },
      include: { createdBy: { select: { id: true, email: true, name: true } } },
    });
    if (!p?.publicToken || !safeEqualToken(token, p.publicToken)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (p.validUntil < new Date()) return c.json({ error: "Expired" }, 410);

    if (
      p.firstViewedAt == null &&
      (p.status === ProposalStatus.SENT || p.status === ProposalStatus.VIEWED)
    ) {
      await prisma.proposal.update({
        where: { id: p.id },
        data: {
          status: ProposalStatus.VIEWED,
          firstViewedAt: new Date(),
        },
      });

      const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
      const appUrl = `${base}${proposalAppHref(p.projectId, p.id)}`;
      if (p.createdBy.email) {
        await sendProposalViewedToSender({
          env,
          toEmail: p.createdBy.email,
          senderName: p.createdBy.name,
          clientName: p.clientName,
          reference: p.reference,
          title: p.title,
          appUrl,
        });
      }

      await createUserNotifications({
        workspaceId: p.workspaceId,
        projectId: p.projectId,
        recipientUserIds: [p.createdById],
        kind: "PROPOSAL_VIEWED",
        title: `${p.clientName} viewed your proposal`,
        body: p.reference,
        href: proposalAppHref(p.projectId, p.id),
      });

      await logActivitySafe(p.workspaceId, ActivityType.PROPOSAL_VIEWED, {
        actorUserId: null,
        entityId: p.id,
        projectId: p.projectId,
        metadata: { reference: p.reference },
      });
    }

    return c.json({ ok: true });
  });

  r.post("/public/proposals/:token/accept", async (c) => {
    const token = c.req.param("token")!;
    const body = z
      .object({
        signerName: z.string().min(1).max(200),
        signatureData: z.string().min(10).max(2_000_000),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const p = await prisma.proposal.findUnique({
      where: { publicToken: token },
      include: proposalFullInclude,
    });
    if (!p?.publicToken || !safeEqualToken(token, p.publicToken)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (p.validUntil < new Date()) return c.json({ error: "Expired" }, 410);
    if (p.status === ProposalStatus.ACCEPTED) return c.json({ error: "Already accepted" }, 400);
    if (p.status !== ProposalStatus.SENT && p.status !== ProposalStatus.VIEWED) {
      return c.json({ error: "Proposal cannot be accepted" }, 400);
    }

    const accBr = proposalBreakdown(p);
    const sigBuf = dataUrlToPngBuffer(body.data.signatureData);
    const rawLogo = await fetchWorkspaceLogoImageBuffer(env, p.workspace);
    const logoBuf = await prepareWorkspaceLogoBufferForPdf(rawLogo);
    const pdfBuf = await buildProposalPdfBuffer({
      title: p.title,
      reference: p.reference,
      workspaceName: p.workspace.name,
      clientName: p.clientName,
      clientCompany: p.clientCompany ?? undefined,
      projectName: p.project.name,
      validUntilLabel: p.validUntil.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      coverHtml: mergedProposalCoverForPdf(p),
      lines: p.items.map((it) => ({
        itemName: it.itemName,
        quantity: it.quantity.toString(),
        unit: it.unit,
        rate: formatMoneyAmount(it.rate.toString(), p.currency),
        lineTotal: formatMoneyAmount(it.lineTotal.toString(), p.currency),
      })),
      subtotal: formatMoneyAmount(p.subtotal.toString(), p.currency),
      workFeeLabel: p.workPricePercent.gt(0)
        ? `Work (${p.workPricePercent.toString()}%)`
        : undefined,
      workFeeAmount: p.workPricePercent.gt(0)
        ? formatMoneyAmount(accBr.workAmount.toString(), p.currency)
        : undefined,
      taxLabel: `Tax (${p.taxPercent.toString()}%)`,
      taxAmount: formatMoneyAmount(accBr.taxAmount.toString(), p.currency),
      discount: formatMoneyAmount(p.discount.toString(), p.currency),
      total: formatMoneyAmount(p.total.toString(), p.currency),
      signedAtIso: new Date().toISOString(),
      signerName: body.data.signerName,
      signaturePngBuffer: sigBuf,
      logoImageBuffer: logoBuf,
    });

    await prisma.proposal.update({
      where: { id: p.id },
      data: {
        status: ProposalStatus.ACCEPTED,
        signerName: body.data.signerName,
        signatureData: body.data.signatureData,
        acceptedAt: new Date(),
      },
    });

    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const appUrl = `${base}${proposalAppHref(p.projectId, p.id)}`;
    if (p.createdBy.email) {
      await sendProposalAcceptedToSender({
        env,
        toEmail: p.createdBy.email,
        senderName: p.createdBy.name,
        clientName: p.clientName,
        reference: p.reference,
        title: p.title,
        appUrl,
        pdfAttachment: pdfBuf,
      });
    }
    const clientEmail = p.clientEmail?.trim();
    if (!clientEmail) {
      console.warn(
        "[proposal] acceptance: no client email — skipping client confirmation email",
        p.id,
      );
    }
    if (clientEmail) {
      try {
        await sendProposalAcceptedToClient({
          env,
          toEmail: clientEmail,
          clientName: p.clientName,
          reference: p.reference,
          title: p.title,
          workspaceName: p.workspace.name,
          senderName: p.createdBy.name,
          signerName: body.data.signerName,
          workspaceLogoUrl: workspaceLogoUrlForClients(env, p.workspace),
          portalUrl: p.publicToken ? proposalPortalUrl(env, p.publicToken) : null,
          pdfAttachment: pdfBuf,
        });
      } catch (e) {
        console.error("[proposal] acceptance email to client failed", e);
      }
    }

    await createUserNotifications({
      workspaceId: p.workspaceId,
      projectId: p.projectId,
      recipientUserIds: [p.createdById],
      kind: "PROPOSAL_ACCEPTED",
      title: `${p.clientName} accepted your proposal`,
      body: p.reference,
      href: proposalAppHref(p.projectId, p.id),
    });

    await logActivitySafe(p.workspaceId, ActivityType.PROPOSAL_ACCEPTED, {
      actorUserId: null,
      entityId: p.id,
      projectId: p.projectId,
      metadata: { reference: p.reference, signerName: body.data.signerName },
    });

    return c.json({ ok: true });
  });

  r.post("/public/proposals/:token/decline", async (c) => {
    const token = c.req.param("token")!;
    const body = z
      .object({
        reason: z.nativeEnum(ProposalDeclineReason),
        comment: z.string().max(5000).optional().nullable(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const p = await prisma.proposal.findUnique({
      where: { publicToken: token },
      include: { createdBy: { select: { id: true, email: true, name: true } } },
    });
    if (!p?.publicToken || !safeEqualToken(token, p.publicToken)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (p.validUntil < new Date()) return c.json({ error: "Expired" }, 410);
    if (p.status === ProposalStatus.ACCEPTED) return c.json({ error: "Already finalized" }, 400);
    if (p.status !== ProposalStatus.SENT && p.status !== ProposalStatus.VIEWED) {
      return c.json({ error: "Cannot decline" }, 400);
    }

    await prisma.proposal.update({
      where: { id: p.id },
      data: {
        status: ProposalStatus.DECLINED,
        declinedAt: new Date(),
        declineReason: body.data.reason,
        declineComment: body.data.comment ?? null,
      },
    });

    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const appUrl = `${base}${proposalAppHref(p.projectId, p.id)}`;
    if (p.createdBy.email) {
      await sendProposalDeclinedToSender({
        env,
        toEmail: p.createdBy.email,
        senderName: p.createdBy.name,
        clientName: p.clientName,
        reference: p.reference,
        title: p.title,
        reasonLabel: declineReasonLabel(body.data.reason),
        comment: body.data.comment,
        appUrl,
      });
    }

    await createUserNotifications({
      workspaceId: p.workspaceId,
      projectId: p.projectId,
      recipientUserIds: [p.createdById],
      kind: "PROPOSAL_DECLINED",
      title: `${p.clientName} declined your proposal`,
      body: declineReasonLabel(body.data.reason),
      href: proposalAppHref(p.projectId, p.id),
    });

    await logActivitySafe(p.workspaceId, ActivityType.PROPOSAL_DECLINED, {
      actorUserId: null,
      entityId: p.id,
      projectId: p.projectId,
      metadata: { reference: p.reference, reason: body.data.reason },
    });

    return c.json({ ok: true });
  });

  r.post("/public/proposals/:token/request-changes", async (c) => {
    const token = c.req.param("token")!;
    const body = z.object({ comment: z.string().min(1).max(8000) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const commentTrimmed = body.data.comment.trim();
    if (!commentTrimmed) {
      return c.json({ error: "Comment is required" }, 400);
    }

    const p = await prisma.proposal.findUnique({
      where: { publicToken: token },
      include: { createdBy: { select: { id: true, email: true, name: true } } },
    });
    if (!p?.publicToken || !safeEqualToken(token, p.publicToken)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (p.validUntil < new Date()) return c.json({ error: "Expired" }, 410);
    if (
      p.status !== ProposalStatus.SENT &&
      p.status !== ProposalStatus.VIEWED &&
      p.status !== ProposalStatus.CHANGE_REQUESTED
    ) {
      return c.json({ error: "Cannot request changes" }, 400);
    }
    await prisma.proposal.update({
      where: { id: p.id },
      data: {
        status: ProposalStatus.CHANGE_REQUESTED,
        changeRequestComment: commentTrimmed,
        changeRequestedAt: new Date(),
      },
    });

    await prisma.proposalPortalMessage.create({
      data: {
        proposalId: p.id,
        body: commentTrimmed,
        isFromClient: true,
      },
    });

    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const appUrl = `${base}${proposalAppHref(p.projectId, p.id)}`;
    if (p.createdBy.email) {
      await sendProposalChangeRequestedToSender({
        env,
        toEmail: p.createdBy.email,
        senderName: p.createdBy.name,
        clientName: p.clientName,
        reference: p.reference,
        title: p.title,
        comment: commentTrimmed,
        appUrl,
      });
    }

    await createUserNotifications({
      workspaceId: p.workspaceId,
      projectId: p.projectId,
      recipientUserIds: [p.createdById],
      kind: "PROPOSAL_CHANGE_REQUESTED",
      title: `${p.clientName} requested changes`,
      body: commentTrimmed.slice(0, 200),
      href: proposalAppHref(p.projectId, p.id),
    });

    await logActivitySafe(p.workspaceId, ActivityType.PROPOSAL_CHANGE_REQUESTED, {
      actorUserId: null,
      entityId: p.id,
      projectId: p.projectId,
      metadata: { reference: p.reference },
    });

    return c.json({ ok: true });
  });

  r.post("/public/proposals/:token/messages", async (c) => {
    const token = c.req.param("token")!;
    const body = z.object({ body: z.string().min(1).max(8000) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const p = await prisma.proposal.findUnique({ where: { publicToken: token } });
    if (!p?.publicToken || !safeEqualToken(token, p.publicToken)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (p.validUntil < new Date()) return c.json({ error: "Expired" }, 410);

    const msg = await prisma.proposalPortalMessage.create({
      data: { proposalId: p.id, body: body.data.body, isFromClient: true },
    });
    return c.json({ id: msg.id, createdAt: msg.createdAt.toISOString() });
  });

  r.get("/public/proposals/:token/messages", async (c) => {
    const token = c.req.param("token")!;
    const p = await prisma.proposal.findUnique({ where: { publicToken: token } });
    if (!p?.publicToken || !safeEqualToken(token, p.publicToken)) {
      return c.json({ error: "Not found" }, 404);
    }
    const list = await prisma.proposalPortalMessage.findMany({
      where: { proposalId: p.id },
      orderBy: { createdAt: "asc" },
    });
    return c.json({
      messages: list.map((m) => ({
        id: m.id,
        body: m.body,
        isFromClient: m.isFromClient,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

  r.post("/internal/proposal-reminders", async (c) => {
    const secret = env.INTERNAL_CRON_SECRET?.trim();
    if (!secret || c.req.header("x-plansync-cron-secret") !== secret) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const expiringSoon = await prisma.proposal.findMany({
      where: {
        status: { in: [ProposalStatus.SENT, ProposalStatus.VIEWED] },
        validUntil: { gt: now, lte: in48h },
      },
      include: { createdBy: { select: { email: true, name: true } } },
    });

    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    for (const p of expiringSoon) {
      if (!p.createdBy.email) continue;
      const appUrl = `${base}${proposalAppHref(p.projectId, p.id)}`;
      await sendProposalExpiringReminderToSender({
        env,
        toEmail: p.createdBy.email,
        senderName: p.createdBy.name,
        reference: p.reference,
        title: p.title,
        validUntilLabel: p.validUntil.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        appUrl,
      });
    }

    const expiredRows = await prisma.proposal.findMany({
      where: {
        status: { in: [ProposalStatus.SENT, ProposalStatus.VIEWED] },
        validUntil: { lt: now },
      },
      select: { id: true, workspaceId: true, projectId: true, reference: true },
    });
    await prisma.proposal.updateMany({
      where: {
        status: { in: [ProposalStatus.SENT, ProposalStatus.VIEWED] },
        validUntil: { lt: now },
      },
      data: { status: ProposalStatus.EXPIRED },
    });
    for (const row of expiredRows) {
      await logActivitySafe(row.workspaceId, ActivityType.PROPOSAL_EXPIRED, {
        entityId: row.id,
        projectId: row.projectId,
        metadata: { reference: row.reference },
      });
    }

    return c.json({
      expiringRemindersSent: expiringSoon.length,
      markedExpired: expiredRows.length,
    });
  });

  r.get("/projects/:projectId/proposals/:proposalId/revisions", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const p = await prisma.proposal.findFirst({ where: { id: proposalId, projectId } });
    if (!p) return c.json({ error: "Not found" }, 404);
    const revs = await prisma.proposalRevision.findMany({
      where: { proposalId },
      orderBy: { sentAt: "desc" },
    });
    return c.json({
      revisions: revs.map((r) => ({
        id: r.id,
        sentAt: r.sentAt.toISOString(),
        snapshot: r.snapshot,
      })),
    });
  });

  r.get("/projects/:projectId/proposals/:proposalId/portal-messages", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const p = await prisma.proposal.findFirst({ where: { id: proposalId, projectId } });
    if (!p) return c.json({ error: "Not found" }, 404);
    const list = await prisma.proposalPortalMessage.findMany({
      where: { proposalId },
      orderBy: { createdAt: "asc" },
    });
    return c.json({
      messages: list.map((m) => ({
        id: m.id,
        body: m.body,
        isFromClient: m.isFromClient,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

  r.post("/projects/:projectId/proposals/:proposalId/portal-messages", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const body = z.object({ body: z.string().min(1).max(8000) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: {
        workspace: { select: { id: true, logoUrl: true, logoS3Key: true } },
      },
    });
    if (!p) return c.json({ error: "Not found" }, 404);
    if (!p.publicToken) {
      return c.json({ error: "Proposal has not been sent to the client yet" }, 400);
    }
    if (p.validUntil < new Date()) {
      return c.json({ error: "Proposal has expired" }, 400);
    }
    if (
      p.status !== ProposalStatus.SENT &&
      p.status !== ProposalStatus.VIEWED &&
      p.status !== ProposalStatus.CHANGE_REQUESTED
    ) {
      return c.json({ error: "Cannot add a portal message for this proposal status" }, 400);
    }
    const trimmedBody = body.data.body.trim();
    const msg = await prisma.proposalPortalMessage.create({
      data: { proposalId, body: trimmedBody, isFromClient: false },
    });

    const clientEmail = p.clientEmail?.trim();
    if (clientEmail) {
      const staff = await prisma.user.findUnique({
        where: { id: c.get("user").id },
        select: { name: true },
      });
      try {
        await sendProposalPortalReplyToClient({
          env,
          toEmail: clientEmail,
          clientName: p.clientName,
          reference: p.reference,
          title: p.title,
          staffName: staff?.name?.trim() || "Your contractor",
          messagePreview: trimmedBody,
          portalUrl: proposalPortalUrl(env, p.publicToken),
          workspaceLogoUrl: workspaceLogoUrlForClients(env, p.workspace),
        });
      } catch (e) {
        console.error("[proposal] portal reply client email failed", e);
      }
    }

    return c.json({ id: msg.id, createdAt: msg.createdAt.toISOString() });
  });

  r.get("/projects/:projectId/proposals/analytics/summary", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const all = await prisma.proposal.findMany({
      where: { projectId },
      select: { status: true, total: true, currency: true },
    });
    let accepted = 0;
    let declined = 0;
    let sent = 0;
    for (const x of all) {
      if (x.status === ProposalStatus.ACCEPTED) accepted += 1;
      if (x.status === ProposalStatus.DECLINED) declined += 1;
      if (x.status === ProposalStatus.SENT || x.status === ProposalStatus.VIEWED) sent += 1;
    }
    const decided = accepted + declined;
    return c.json({
      totalProposals: all.length,
      accepted,
      declined,
      sent,
      winRate: decided > 0 ? accepted / decided : null,
    });
  });

  r.get("/projects/:projectId/proposals/:proposalId/export-csv", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, projectId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!p) return c.json({ error: "Not found" }, 404);
    const lines = [
      ["reference", "item", "quantity", "unit", "rate", "lineTotal"].join(","),
      ...p.items.map((it) =>
        [
          csvEscape(p.reference),
          csvEscape(it.itemName),
          it.quantity.toString(),
          csvEscape(it.unit),
          it.rate.toString(),
          it.lineTotal.toString(),
        ].join(","),
      ),
    ];
    const body = lines.join("\n");
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${p.reference.replace(/[^a-z0-9-_]/gi, "_")}-lines.csv"`,
      },
    });
  });

  r.get("/workspaces/:workspaceId/proposals/rate-hints", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
    });
    if (!m) return c.json({ error: "Forbidden" }, 403);
    if (q.length < 2) return c.json({ hints: [] });

    const accepted = await prisma.proposal.findMany({
      where: { workspaceId, status: ProposalStatus.ACCEPTED },
      select: { id: true },
      take: 80,
      orderBy: { updatedAt: "desc" },
    });
    const ids = accepted.map((x) => x.id);
    const items = await prisma.proposalItem.findMany({
      where: {
        proposalId: { in: ids },
        itemName: { contains: q, mode: "insensitive" },
      },
      select: { itemName: true, rate: true, proposal: { select: { currency: true } } },
      take: 50,
    });
    const byKey = new Map<string, { sum: number; n: number; currency: string }>();
    for (const it of items) {
      const key = it.itemName.trim().toLowerCase();
      const prev = byKey.get(key) ?? { sum: 0, n: 0, currency: it.proposal.currency };
      prev.sum += Number(it.rate.toString());
      prev.n += 1;
      byKey.set(key, prev);
    }
    const hints = [...byKey.entries()].map(([name, v]) => ({
      itemName: name,
      avgRate: v.n > 0 ? v.sum / v.n : 0,
      sampleSize: v.n,
      currency: v.currency,
    }));
    return c.json({ hints: hints.slice(0, 15) });
  });

  r.post("/projects/:projectId/proposals/:proposalId/external-sign-export", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const proposalId = c.req.param("proposalId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const p = await prisma.proposal.findFirst({ where: { id: proposalId, projectId } });
    if (!p) return c.json({ error: "Not found" }, 404);
    return c.json({
      configured: false,
      message: "External e-sign handoff is not configured for this workspace.",
    });
  });
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
