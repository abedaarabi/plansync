import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { Prisma, WorkspaceRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import {
  jsonObjectForResponse,
  mergeCustomAttributes,
  normalizeCustomAttributes,
  parseMaterialTemplateJson,
  parseMaterialTemplatePatchBody,
  templateToDbJson,
  type MaterialTemplate,
} from "../../lib/materialTemplate.js";
import {
  buildMaterialsTemplateBuffer,
  parseMaterialsImportBuffer,
} from "../../lib/materialsExcel.js";

function requirePro(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspacePro(workspace)) {
    return { error: "Pro subscription required", status: 402 as const };
  }
  return null;
}

export function normalizeMaterialKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function materialJson(m: {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  sku: string | null;
  unit: string;
  unitPrice: Prisma.Decimal | null;
  currency: string;
  supplier: string | null;
  manufacturer: string | null;
  specification: string | null;
  notes: string | null;
  customAttributes: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; nameKey: string };
}) {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    categoryId: m.categoryId,
    name: m.name,
    sku: m.sku,
    unit: m.unit,
    unitPrice: m.unitPrice != null ? m.unitPrice.toString() : null,
    currency: m.currency,
    supplier: m.supplier,
    manufacturer: m.manufacturer,
    specification: m.specification,
    notes: m.notes,
    customAttributes: jsonObjectForResponse(m.customAttributes),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    category: { id: m.category.id, name: m.category.name },
  };
}

async function loadWorkspaceMaterialTemplate(workspaceId: string): Promise<MaterialTemplate> {
  const w = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { materialTemplateJson: true },
  });
  return parseMaterialTemplateJson(w?.materialTemplateJson);
}

async function loadWorkspaceMember(workspaceId: string, userId: string) {
  const m = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    include: { workspace: true },
  });
  if (!m) return { error: "Forbidden" as const, status: 403 as const };
  return { member: m, workspace: m.workspace };
}

export function registerMaterialsRoutes(r: Hono, needUser: MiddlewareHandler) {
  r.get("/workspaces/:workspaceId/material-template", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const template = await loadWorkspaceMaterialTemplate(workspaceId);
    return c.json(template);
  });

  r.patch("/workspaces/:workspaceId/material-template", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (res.member.role !== WorkspaceRole.SUPER_ADMIN) {
      return c.json({ error: "Only workspace super admins can edit the material template" }, 403);
    }
    const parsed = parseMaterialTemplatePatchBody(await c.req.json());
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { materialTemplateJson: templateToDbJson(parsed.template) },
    });
    return c.json(parsed.template);
  });

  r.get("/workspaces/:workspaceId/materials/paged", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
        q: z.string().trim().max(120).optional(),
        categoryId: z.string().trim().optional(),
      })
      .safeParse({
        page: c.req.query("page"),
        pageSize: c.req.query("pageSize"),
        q: c.req.query("q"),
        categoryId: c.req.query("categoryId"),
      });
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const page = parsed.data.page;
    const pageSize = parsed.data.pageSize;
    const q = parsed.data.q?.trim();
    const categoryId = parsed.data.categoryId?.trim();

    const where: Prisma.MaterialWhereInput = {
      workspaceId,
      ...(categoryId ? { categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { supplier: { contains: q, mode: "insensitive" } },
              { manufacturer: { contains: q, mode: "insensitive" } },
              { specification: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
              { category: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const total = await prisma.material.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const items = await prisma.material.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      skip,
      take: pageSize,
    });

    return c.json({
      items: items.map(materialJson),
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
  });

  r.get("/workspaces/:workspaceId/materials", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const list = await prisma.material.findMany({
      where: { workspaceId },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
    return c.json(list.map(materialJson));
  });

  r.get("/workspaces/:workspaceId/materials/categories", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const cats = await prisma.materialCategory.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return c.json(
      cats.map((cat) => ({
        id: cat.id,
        name: cat.name,
        nameKey: cat.nameKey,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
      })),
    );
  });

  r.get("/workspaces/:workspaceId/materials/template", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const w = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { materialTemplateJson: true },
    });
    const buf = buildMaterialsTemplateBuffer(w?.materialTemplateJson ?? {});
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plansync-materials-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  });

  const materialBody = z.object({
    materialType: z.string().min(1).max(120),
    name: z.string().min(1).max(500),
    sku: z.string().max(120).optional().nullable(),
    unit: z.string().min(1).max(32).optional(),
    unitPrice: z.union([z.number(), z.string()]).optional().nullable(),
    currency: z.string().min(1).max(8).optional(),
    supplier: z.string().max(500).optional().nullable(),
    manufacturer: z.string().max(500).optional().nullable(),
    specification: z.string().max(2000).optional().nullable(),
    notes: z.string().max(10000).optional().nullable(),
    customAttributes: z.record(z.string(), z.unknown()).optional(),
  });

  r.post("/workspaces/:workspaceId/materials", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = materialBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const typeKey = normalizeMaterialKey(body.data.materialType);
    const nameKey = normalizeMaterialKey(body.data.name);
    if (!typeKey || !nameKey) return c.json({ error: "Material type and name are required" }, 400);

    let unitPrice: Prisma.Decimal | null = null;
    if (body.data.unitPrice != null && body.data.unitPrice !== "") {
      const raw =
        typeof body.data.unitPrice === "number"
          ? body.data.unitPrice
          : Number(String(body.data.unitPrice).replace(/,/g, ""));
      if (!Number.isFinite(raw) || raw < 0) {
        return c.json({ error: "Invalid unit price" }, 400);
      }
      unitPrice = new Prisma.Decimal(raw);
    }

    const category = await prisma.materialCategory.upsert({
      where: {
        workspaceId_nameKey: { workspaceId, nameKey: typeKey },
      },
      create: {
        workspaceId,
        name: body.data.materialType.trim(),
        nameKey: typeKey,
      },
      update: {},
    });

    const template = await loadWorkspaceMaterialTemplate(workspaceId);
    const customNorm = normalizeCustomAttributes(body.data.customAttributes ?? {}, template);
    if (!customNorm.ok) return c.json({ error: customNorm.error }, 400);

    const row = await prisma.material.upsert({
      where: {
        workspaceId_categoryId_nameKey: {
          workspaceId,
          categoryId: category.id,
          nameKey,
        },
      },
      create: {
        workspaceId,
        categoryId: category.id,
        name: body.data.name.trim(),
        nameKey,
        sku: body.data.sku?.trim() || null,
        unit: body.data.unit?.trim() || "ea",
        unitPrice,
        currency: (body.data.currency ?? "USD").trim().toUpperCase() || "USD",
        supplier: body.data.supplier?.trim() || null,
        manufacturer: body.data.manufacturer?.trim() || null,
        specification: body.data.specification?.trim() || null,
        notes: body.data.notes?.trim() || null,
        customAttributes: customNorm.attributes,
      },
      update: {
        name: body.data.name.trim(),
        sku: body.data.sku?.trim() || null,
        unit: body.data.unit?.trim() || "ea",
        unitPrice,
        currency: (body.data.currency ?? "USD").trim().toUpperCase() || "USD",
        supplier: body.data.supplier?.trim() || null,
        manufacturer: body.data.manufacturer?.trim() || null,
        specification: body.data.specification?.trim() || null,
        notes: body.data.notes?.trim() || null,
        customAttributes: customNorm.attributes,
      },
      include: { category: true },
    });

    return c.json(materialJson(row));
  });

  r.patch("/workspaces/:workspaceId/materials/:materialId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const materialId = c.req.param("materialId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.material.findFirst({
      where: { id: materialId, workspaceId },
      include: { category: true },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const body = materialBody.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    let nextCategoryId = existing.categoryId;
    if (body.data.materialType !== undefined) {
      const typeKey = normalizeMaterialKey(body.data.materialType);
      if (!typeKey) return c.json({ error: "Material type is required" }, 400);
      const cat = await prisma.materialCategory.upsert({
        where: { workspaceId_nameKey: { workspaceId, nameKey: typeKey } },
        create: {
          workspaceId,
          name: body.data.materialType.trim(),
          nameKey: typeKey,
        },
        update: {},
      });
      nextCategoryId = cat.id;
    }

    let nextNameKey = existing.nameKey;
    if (body.data.name !== undefined) {
      const nk = normalizeMaterialKey(body.data.name);
      if (!nk) return c.json({ error: "Name is required" }, 400);
      nextNameKey = nk;
    }

    if (nextCategoryId !== existing.categoryId || nextNameKey !== existing.nameKey) {
      const clash = await prisma.material.findFirst({
        where: {
          workspaceId,
          categoryId: nextCategoryId,
          nameKey: nextNameKey,
          NOT: { id: materialId },
        },
      });
      if (clash)
        return c.json({ error: "Another material with this type and name already exists" }, 409);
    }

    let unitPrice: Prisma.Decimal | null | undefined = undefined;
    if (body.data.unitPrice !== undefined) {
      if (body.data.unitPrice === null || body.data.unitPrice === "") {
        unitPrice = null;
      } else {
        const raw =
          typeof body.data.unitPrice === "number"
            ? body.data.unitPrice
            : Number(String(body.data.unitPrice).replace(/,/g, ""));
        if (!Number.isFinite(raw) || raw < 0) return c.json({ error: "Invalid unit price" }, 400);
        unitPrice = new Prisma.Decimal(raw);
      }
    }

    const template = await loadWorkspaceMaterialTemplate(workspaceId);
    let nextCustom: Prisma.InputJsonValue | undefined = undefined;
    if (body.data.customAttributes !== undefined) {
      const merged = mergeCustomAttributes(
        existing.customAttributes,
        body.data.customAttributes,
        template,
      );
      if (!merged.ok) return c.json({ error: merged.error }, 400);
      nextCustom = merged.attributes;
    }

    const updated = await prisma.material.update({
      where: { id: materialId },
      data: {
        categoryId: nextCategoryId,
        name: body.data.name !== undefined ? body.data.name.trim() : undefined,
        nameKey: nextNameKey,
        sku: body.data.sku !== undefined ? body.data.sku?.trim() || null : undefined,
        unit: body.data.unit !== undefined ? body.data.unit.trim() || "ea" : undefined,
        unitPrice,
        currency:
          body.data.currency !== undefined
            ? body.data.currency.trim().toUpperCase() || "USD"
            : undefined,
        supplier: body.data.supplier !== undefined ? body.data.supplier?.trim() || null : undefined,
        manufacturer:
          body.data.manufacturer !== undefined ? body.data.manufacturer?.trim() || null : undefined,
        specification:
          body.data.specification !== undefined
            ? body.data.specification?.trim() || null
            : undefined,
        notes: body.data.notes !== undefined ? body.data.notes?.trim() || null : undefined,
        ...(nextCustom !== undefined ? { customAttributes: nextCustom } : {}),
      },
      include: { category: true },
    });

    return c.json(materialJson(updated));
  });

  r.delete("/workspaces/:workspaceId/materials/:materialId", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const materialId = c.req.param("materialId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.material.findFirst({
      where: { id: materialId, workspaceId },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    await prisma.material.delete({ where: { id: materialId } });
    return c.json({ ok: true });
  });

  r.post("/workspaces/:workspaceId/materials/import", needUser, async (c) => {
    const workspaceId = c.req.param("workspaceId")!;
    const res = await loadWorkspaceMember(workspaceId, c.get("user").id);
    if ("error" in res) return c.json({ error: res.error }, res.status);
    const gate = requirePro(res.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = await c.req.parseBody();
    const file = body.file;
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return c.json({ error: 'Expected multipart field "file" with an .xlsx file' }, 400);
    }
    const blob = file as Blob;
    if (blob.size > 5 * 1024 * 1024) {
      return c.json({ error: "File too large (max 5 MB)" }, 400);
    }
    const ab = await blob.arrayBuffer();
    const buf = Buffer.from(ab);
    const wJson = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { materialTemplateJson: true },
    });
    const { rows, errors } = parseMaterialsImportBuffer(buf, wJson?.materialTemplateJson ?? {});
    if (errors.length && rows.length === 0) {
      return c.json({ error: "Import failed", details: errors }, 400);
    }

    let created = 0;
    let updated = 0;
    const rowErrors: string[] = [...errors];
    const template = await loadWorkspaceMaterialTemplate(workspaceId);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const typeKey = normalizeMaterialKey(row.materialType);
      const nameKey = normalizeMaterialKey(row.materialName);
      if (!typeKey || !nameKey) {
        rowErrors.push(`Row ${i + 2}: missing type or name`);
        continue;
      }

      let unitPrice: Prisma.Decimal | null = null;
      if (row.unitPrice.trim()) {
        const n = Number(row.unitPrice.replace(/,/g, ""));
        if (!Number.isFinite(n) || n < 0) {
          rowErrors.push(`Row ${i + 2}: invalid unit price`);
          continue;
        }
        unitPrice = new Prisma.Decimal(n);
      }

      const category = await prisma.materialCategory.upsert({
        where: { workspaceId_nameKey: { workspaceId, nameKey: typeKey } },
        create: {
          workspaceId,
          name: row.materialType.trim(),
          nameKey: typeKey,
        },
        update: {},
      });

      const existing = await prisma.material.findUnique({
        where: {
          workspaceId_categoryId_nameKey: {
            workspaceId,
            categoryId: category.id,
            nameKey,
          },
        },
      });

      const patch: Record<string, unknown> = {};
      for (const f of template.fields) {
        const v = row.customValues[f.key];
        if (v !== undefined && String(v).trim() !== "") {
          patch[f.key] = v;
        }
      }
      const customMerged = mergeCustomAttributes(existing?.customAttributes ?? {}, patch, template);
      if (!customMerged.ok) {
        rowErrors.push(`Row ${i + 2}: ${customMerged.error}`);
        continue;
      }

      const data = {
        name: row.materialName.trim(),
        nameKey,
        sku: row.sku.trim() || null,
        unit: row.unit.trim() || "ea",
        unitPrice,
        currency: (row.currency.trim() || "USD").toUpperCase().slice(0, 8) || "USD",
        supplier: row.supplier.trim() || null,
        manufacturer: row.manufacturer.trim() || null,
        specification: row.specification.trim() || null,
        notes: row.notes.trim() || null,
        customAttributes: customMerged.attributes,
      };

      if (existing) {
        await prisma.material.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await prisma.material.create({
          data: {
            workspaceId,
            categoryId: category.id,
            ...data,
          },
        });
        created++;
      }
    }

    return c.json({
      ok: true,
      created,
      updated,
      rowCount: rows.length,
      warnings: rowErrors.length ? rowErrors : undefined,
    });
  });
}
