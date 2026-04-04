import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { jsonObjectForResponse } from "../../lib/materialTemplate.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember } from "../../lib/projectAccess.js";

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
    select: {
      id: true,
      name: true,
      unit: true,
      unitPrice: true,
      currency: true,
      customAttributes: true,
      category: { select: { name: true } },
    },
  },
} as const;

type TakeoffRow = Prisma.TakeoffLineGetPayload<{ include: typeof takeoffInclude }>;

function takeoffRowJson(row: TakeoffRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    fileId: row.fileId,
    fileVersionId: row.fileVersionId,
    fileVersion: row.fileVersion.version,
    fileName: row.file.name,
    materialId: row.materialId,
    label: row.label,
    quantity: row.quantity.toString(),
    unit: row.unit,
    notes: row.notes,
    sourceZoneId: row.sourceZoneId,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    material: row.material
      ? {
          id: row.material.id,
          name: row.material.name,
          unit: row.material.unit,
          unitPrice: row.material.unitPrice != null ? row.material.unitPrice.toString() : null,
          currency: row.material.currency,
          categoryName: row.material.category.name,
          customAttributes: jsonObjectForResponse(row.material.customAttributes),
        }
      : null,
  };
}

async function fileVersionWriteBlocked(fileVersionId: string, userId: string): Promise<boolean> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    select: { lockedByUserId: true, lockExpiresAt: true },
  });
  if (!fv?.lockedByUserId) return false;
  if (fv.lockExpiresAt && fv.lockExpiresAt < new Date()) return false;
  return fv.lockedByUserId !== userId;
}

async function loadFileVersionForTakeoff(fileVersionId: string) {
  return prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: { include: { workspace: true } } } } },
  });
}

export function registerTakeoffRoutes(r: Hono, needUser: MiddlewareHandler) {
  r.get("/file-versions/:fileVersionId/takeoff-lines", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const fv = await loadFileVersionForTakeoff(fileVersionId);
    if (!fv) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.takeoffLine.findMany({
      where: { fileVersionId },
      include: takeoffInclude,
      orderBy: { createdAt: "desc" },
    });
    return c.json(rows.map(takeoffRowJson));
  });

  r.get("/projects/:projectId/takeoff-lines", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.takeoffLine.findMany({
      where: { projectId },
      include: takeoffInclude,
      orderBy: [{ fileId: "asc" }, { createdAt: "desc" }],
    });
    return c.json(rows.map(takeoffRowJson));
  });

  r.post("/file-versions/:fileVersionId/takeoff-lines", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const body = z
      .object({
        materialId: z.string().optional(),
        label: z.string().optional(),
        quantity: z.union([z.number(), z.string()]),
        unit: z.string().optional(),
        notes: z.string().optional(),
        sourceZoneId: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const fv = await loadFileVersionForTakeoff(fileVersionId);
    if (!fv) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (await fileVersionWriteBlocked(fv.id, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const wsId = access.project.workspaceId;
    if (body.data.materialId) {
      const mat = await prisma.material.findFirst({
        where: { id: body.data.materialId, workspaceId: wsId },
      });
      if (!mat) return c.json({ error: "Material not found" }, 400);
    }

    const qty =
      typeof body.data.quantity === "number" ? body.data.quantity : Number(body.data.quantity);
    if (!Number.isFinite(qty)) return c.json({ error: "Invalid quantity" }, 400);

    const tags = body.data.tags?.map((t) => t.trim()).filter(Boolean) ?? [];
    const sourceZoneId = body.data.sourceZoneId?.trim() || null;

    if (sourceZoneId) {
      const existing = await prisma.takeoffLine.findFirst({
        where: { fileVersionId: fv.id, sourceZoneId },
      });
      if (existing) {
        const row = await prisma.takeoffLine.update({
          where: { id: existing.id },
          data: {
            materialId: body.data.materialId ?? existing.materialId,
            label: body.data.label?.trim() ?? existing.label,
            quantity: new Prisma.Decimal(qty),
            unit: body.data.unit?.trim() || existing.unit,
            notes: body.data.notes !== undefined ? body.data.notes?.trim() || null : existing.notes,
            tags: tags.length > 0 ? tags : existing.tags,
          },
          include: takeoffInclude,
        });
        return c.json(takeoffRowJson(row));
      }
    }

    const row = await prisma.takeoffLine.create({
      data: {
        workspaceId: wsId,
        projectId: fv.file.projectId,
        fileId: fv.fileId,
        fileVersionId: fv.id,
        materialId: body.data.materialId ?? null,
        label: body.data.label?.trim() ?? "",
        quantity: new Prisma.Decimal(qty),
        unit: body.data.unit?.trim() || "ea",
        notes: body.data.notes?.trim() || null,
        sourceZoneId,
        tags,
      },
      include: takeoffInclude,
    });
    return c.json(takeoffRowJson(row));
  });

  r.patch("/takeoff-lines/:takeoffLineId", needUser, async (c) => {
    const takeoffLineId = c.req.param("takeoffLineId")!;
    const existing = await prisma.takeoffLine.findUnique({
      where: { id: takeoffLineId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(existing.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (await fileVersionWriteBlocked(existing.fileVersionId, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const body = z
      .object({
        materialId: z.string().nullable().optional(),
        label: z.string().optional(),
        quantity: z.union([z.number(), z.string()]).optional(),
        unit: z.string().optional(),
        notes: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const wsId = access.project.workspaceId;
    if (body.data.materialId) {
      const mat = await prisma.material.findFirst({
        where: { id: body.data.materialId, workspaceId: wsId },
      });
      if (!mat) return c.json({ error: "Material not found" }, 400);
    }

    let quantityDec: Prisma.Decimal | undefined;
    if (body.data.quantity !== undefined) {
      const qty =
        typeof body.data.quantity === "number" ? body.data.quantity : Number(body.data.quantity);
      if (!Number.isFinite(qty)) return c.json({ error: "Invalid quantity" }, 400);
      quantityDec = new Prisma.Decimal(qty);
    }

    const row = await prisma.takeoffLine.update({
      where: { id: takeoffLineId },
      data: {
        ...(body.data.materialId !== undefined ? { materialId: body.data.materialId } : {}),
        ...(body.data.label !== undefined ? { label: body.data.label.trim() } : {}),
        ...(quantityDec !== undefined ? { quantity: quantityDec } : {}),
        ...(body.data.unit !== undefined ? { unit: body.data.unit.trim() } : {}),
        ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
        ...(body.data.tags !== undefined
          ? {
              tags: body.data.tags.map((t) => t.trim()).filter(Boolean),
            }
          : {}),
      },
      include: takeoffInclude,
    });
    return c.json(takeoffRowJson(row));
  });

  r.delete("/takeoff-lines/:takeoffLineId", needUser, async (c) => {
    const takeoffLineId = c.req.param("takeoffLineId")!;
    const existing = await prisma.takeoffLine.findUnique({
      where: { id: takeoffLineId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(existing.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (await fileVersionWriteBlocked(existing.fileVersionId, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    await prisma.takeoffLine.delete({ where: { id: takeoffLineId } });
    return c.json({ ok: true });
  });
}
