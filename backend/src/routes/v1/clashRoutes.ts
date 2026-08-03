import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { AssetType, BimClashStatus, BimClashType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { loadProjectWithAuth } from "../../lib/permissions.js";
import { loadBuildingForUser } from "../../lib/locations/locationsAccess.js";
import { requireBimPro } from "./bimRouteHelpers.js";
import { parseRunStats, parseSetDef, reconcileClashRun } from "../../lib/bim/clashPersistence.js";
import { commentAuthorInclude, simpleCommentJson } from "../../lib/userCommentJson.js";
import { assertUserAssignableToProject } from "../../lib/projectAccess.js";
import type { Env } from "../../lib/env.js";
import type { BimClashHit, BimClashSetDef } from "../../shared/bimClashTypes.js";

const setDefSchema = z.object({
  label: z.string().min(1).max(120),
  rules: z
    .array(
      z.object({
        field: z.enum(["model", "discipline", "ifcType", "level"]),
        values: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
});

const hitSchema = z.object({
  guidA: z.string().min(1),
  guidB: z.string().min(1),
  fileVersionIdA: z.string().min(1),
  fileVersionIdB: z.string().min(1),
  clashType: z.nativeEnum(BimClashType),
  distanceMm: z.number(),
  point: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  contactCount: z.number().int().min(1).default(1),
  nameA: z.string().max(240).nullish(),
  nameB: z.string().max(240).nullish(),
  ifcTypeA: z.string().max(120).nullish(),
  ifcTypeB: z.string().max(120).nullish(),
});

function clashRowJson(c: {
  id: string;
  testId: string;
  projectId: string;
  fileVersionAId: string;
  fileVersionBId: string;
  elementAId: string;
  elementBId: string;
  guidA: string;
  guidB: string;
  clashType: BimClashType;
  distanceMm: number;
  pointJson: unknown;
  contactCount: number;
  status: BimClashStatus;
  statusChangedAt: Date | null;
  statusDistanceMm: number | null;
  assigneeId: string | null;
  groupId: string | null;
  elementMissingSinceId: string | null;
  issueId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  elementA?: { name: string | null; ifcType: string | null; ifcGuid: string } | null;
  elementB?: { name: string | null; ifcType: string | null; ifcGuid: string } | null;
  assignee?: { id: string; name: string; email: string; image: string | null } | null;
  issue?: { id: string; status: string; title: string } | null;
}) {
  return {
    id: c.id,
    testId: c.testId,
    projectId: c.projectId,
    fileVersionAId: c.fileVersionAId,
    fileVersionBId: c.fileVersionBId,
    elementAId: c.elementAId,
    elementBId: c.elementBId,
    guidA: c.guidA,
    guidB: c.guidB,
    clashType: c.clashType,
    distanceMm: c.distanceMm,
    point:
      c.pointJson &&
      typeof c.pointJson === "object" &&
      "x" in (c.pointJson as object) &&
      "y" in (c.pointJson as object) &&
      "z" in (c.pointJson as object)
        ? (c.pointJson as { x: number; y: number; z: number })
        : { x: 0, y: 0, z: 0 },
    contactCount: c.contactCount,
    status: c.status,
    statusChangedAt: c.statusChangedAt?.toISOString() ?? null,
    statusDistanceMm: c.statusDistanceMm,
    assigneeId: c.assigneeId,
    groupId: c.groupId,
    elementMissingSinceId: c.elementMissingSinceId,
    issueId: c.issueId,
    firstSeenAt: c.firstSeenAt.toISOString(),
    lastSeenAt: c.lastSeenAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    elementA: c.elementA
      ? { name: c.elementA.name, ifcType: c.elementA.ifcType, ifcGuid: c.elementA.ifcGuid }
      : null,
    elementB: c.elementB
      ? { name: c.elementB.name, ifcType: c.elementB.ifcType, ifcGuid: c.elementB.ifcGuid }
      : null,
    assignee: c.assignee ?? null,
    issue: c.issue ?? null,
  };
}

const clashInclude = {
  elementA: { select: { name: true, ifcType: true, ifcGuid: true } },
  elementB: { select: { name: true, ifcType: true, ifcGuid: true } },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  issue: { select: { id: true, status: true, title: true } },
} as const;

function testRowJson(t: {
  id: string;
  projectId: string;
  name: string;
  setAJson: unknown;
  setBJson: unknown;
  clearanceEnabled: boolean;
  clearanceMm: number;
  lastRunAt: Date | null;
  lastRunById: string | null;
  lastRunStats: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count?: { clashes: number };
}) {
  return {
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    setA: parseSetDef(t.setAJson),
    setB: parseSetDef(t.setBJson),
    clearanceEnabled: t.clearanceEnabled,
    clearanceMm: t.clearanceMm,
    lastRunAt: t.lastRunAt?.toISOString() ?? null,
    lastRunById: t.lastRunById,
    lastRunStats: parseRunStats(t.lastRunStats),
    clashCount: t._count?.clashes ?? undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function authorizeClashProject(projectId: string, userId: string) {
  const auth = await loadProjectWithAuth(projectId, userId);
  if ("error" in auth) return auth;
  const pro = requireBimPro(auth.ctx.project.workspace);
  if (pro) return { error: pro.error, status: pro.status };
  return auth;
}

async function loadClashForUser(clashId: string, userId: string) {
  const clash = await prisma.bimClash.findUnique({
    where: { id: clashId },
    include: clashInclude,
  });
  if (!clash) return { error: "Not found" as const, status: 404 as const };
  const auth = await authorizeClashProject(clash.projectId, userId);
  if ("error" in auth) return auth;
  return { clash, ctx: auth.ctx };
}

export function registerClashRoutes(
  r: Hono,
  needUser: MiddlewareHandler,
  _env: Env, // kept for register*Routes signature parity
): void {
  void _env;
  r.get("/projects/:projectId/clash-tests", needUser, async (c) => {
    const projectId = c.req.param("projectId");
    const auth = await authorizeClashProject(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);

    const tests = await prisma.bimClashTest.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { clashes: true } } },
    });
    return c.json({ tests: tests.map(testRowJson) });
  });

  r.post("/projects/:projectId/clash-tests", needUser, async (c) => {
    const projectId = c.req.param("projectId");
    const auth = await authorizeClashProject(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);

    const body = z
      .object({
        name: z.string().min(1).max(160),
        setA: setDefSchema,
        setB: setDefSchema,
        clearanceEnabled: z.boolean().optional(),
        clearanceMm: z.number().min(0).max(1000).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const test = await prisma.bimClashTest.create({
      data: {
        projectId,
        name: body.data.name.trim(),
        setAJson: body.data.setA,
        setBJson: body.data.setB,
        clearanceEnabled: body.data.clearanceEnabled ?? true,
        clearanceMm: body.data.clearanceMm ?? 25,
      },
      include: { _count: { select: { clashes: true } } },
    });
    return c.json(testRowJson(test), 201);
  });

  r.patch("/clash-tests/:testId", needUser, async (c) => {
    const testId = c.req.param("testId");
    const test = await prisma.bimClashTest.findUnique({ where: { id: testId } });
    if (!test) return c.json({ error: "Not found" }, 404);
    const auth = await authorizeClashProject(test.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);

    const body = z
      .object({
        name: z.string().min(1).max(160).optional(),
        setA: setDefSchema.optional(),
        setB: setDefSchema.optional(),
        clearanceEnabled: z.boolean().optional(),
        clearanceMm: z.number().min(0).max(1000).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const updated = await prisma.bimClashTest.update({
      where: { id: testId },
      data: {
        ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
        ...(body.data.setA !== undefined ? { setAJson: body.data.setA } : {}),
        ...(body.data.setB !== undefined ? { setBJson: body.data.setB } : {}),
        ...(body.data.clearanceEnabled !== undefined
          ? { clearanceEnabled: body.data.clearanceEnabled }
          : {}),
        ...(body.data.clearanceMm !== undefined ? { clearanceMm: body.data.clearanceMm } : {}),
      },
      include: { _count: { select: { clashes: true } } },
    });
    return c.json(testRowJson(updated));
  });

  r.delete("/clash-tests/:testId", needUser, async (c) => {
    const testId = c.req.param("testId");
    const test = await prisma.bimClashTest.findUnique({ where: { id: testId } });
    if (!test) return c.json({ error: "Not found" }, 404);
    const auth = await authorizeClashProject(test.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    await prisma.bimClashTest.delete({ where: { id: testId } });
    return c.json({ ok: true });
  });

  r.post("/clash-tests/:testId/runs", needUser, async (c) => {
    const testId = c.req.param("testId");
    const test = await prisma.bimClashTest.findUnique({ where: { id: testId } });
    if (!test) return c.json({ error: "Not found" }, 404);
    const auth = await authorizeClashProject(test.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);

    const body = z
      .object({
        clearanceEnabled: z.boolean(),
        clearanceMm: z.number().min(0).max(1000),
        setA: setDefSchema,
        setB: setDefSchema,
        hits: z.array(hitSchema).max(50_000),
        scannedPairs: z.number().int().min(0),
        truncated: z.boolean(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const { clashes, stats } = await reconcileClashRun({
      testId,
      projectId: test.projectId,
      userId: c.get("user").id,
      payload: {
        clearanceEnabled: body.data.clearanceEnabled,
        clearanceMm: body.data.clearanceMm,
        setA: body.data.setA as BimClashSetDef,
        setB: body.data.setB as BimClashSetDef,
        hits: body.data.hits as BimClashHit[],
        scannedPairs: body.data.scannedPairs,
        truncated: body.data.truncated,
      },
    });

    const withIncludes = await prisma.bimClash.findMany({
      where: { id: { in: clashes.map((x) => x.id) } },
      include: clashInclude,
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
    });

    return c.json({
      stats,
      clashes: withIncludes.map(clashRowJson),
    });
  });

  r.get("/clash-tests/:testId/clashes", needUser, async (c) => {
    const testId = c.req.param("testId");
    const test = await prisma.bimClashTest.findUnique({ where: { id: testId } });
    if (!test) return c.json({ error: "Not found" }, 404);
    const auth = await authorizeClashProject(test.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);

    const status = c.req.query("status");
    const assignee = c.req.query("assignee");
    const where: {
      testId: string;
      status?: BimClashStatus;
      assigneeId?: string;
    } = { testId };
    if (status && Object.values(BimClashStatus).includes(status as BimClashStatus)) {
      where.status = status as BimClashStatus;
    }
    if (assignee === "me") where.assigneeId = c.get("user").id;

    const clashes = await prisma.bimClash.findMany({
      where,
      include: clashInclude,
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
    });
    return c.json({
      test: testRowJson(test),
      clashes: clashes.map(clashRowJson),
    });
  });

  r.delete("/clash-tests/:testId/clashes", needUser, async (c) => {
    const testId = c.req.param("testId");
    const test = await prisma.bimClashTest.findUnique({ where: { id: testId } });
    if (!test) return c.json({ error: "Not found" }, 404);
    const auth = await authorizeClashProject(test.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);

    const deleted = await prisma.bimClash.deleteMany({ where: { testId } });
    await prisma.bimClashTest.update({
      where: { id: testId },
      data: { lastRunAt: null, lastRunById: null, lastRunStats: Prisma.DbNull },
    });
    return c.json({ ok: true, deletedCount: deleted.count });
  });

  r.delete("/clashes/:clashId", needUser, async (c) => {
    const loaded = await loadClashForUser(c.req.param("clashId"), c.get("user").id);
    if ("error" in loaded) return c.json({ error: loaded.error }, loaded.status);
    await prisma.bimClash.delete({ where: { id: loaded.clash.id } });
    return c.json({ ok: true });
  });

  r.patch("/clashes/:clashId", needUser, async (c) => {
    const loaded = await loadClashForUser(c.req.param("clashId"), c.get("user").id);
    if ("error" in loaded) return c.json({ error: loaded.error }, loaded.status);

    const body = z
      .object({
        status: z.nativeEnum(BimClashStatus).optional(),
        assigneeId: z.string().nullable().optional(),
        groupId: z.string().nullable().optional(),
        issueId: z.string().nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    if (body.data.assigneeId) {
      const ok = await assertUserAssignableToProject(
        body.data.assigneeId,
        loaded.clash.projectId,
        loaded.ctx.project.workspaceId,
      );
      if ("error" in ok) return c.json({ error: ok.error }, ok.status);
    }

    const now = new Date();
    const statusChanging =
      body.data.status !== undefined && body.data.status !== loaded.clash.status;
    const updated = await prisma.bimClash.update({
      where: { id: loaded.clash.id },
      data: {
        ...(body.data.status !== undefined ? { status: body.data.status } : {}),
        ...(statusChanging
          ? {
              statusChangedAt: now,
              statusDistanceMm:
                body.data.status === "RESOLVED" || body.data.status === "IGNORED"
                  ? loaded.clash.distanceMm
                  : null,
            }
          : {}),
        ...(body.data.assigneeId !== undefined ? { assigneeId: body.data.assigneeId } : {}),
        ...(body.data.groupId !== undefined ? { groupId: body.data.groupId } : {}),
        ...(body.data.issueId !== undefined ? { issueId: body.data.issueId } : {}),
      },
      include: clashInclude,
    });
    return c.json(clashRowJson(updated));
  });

  r.post("/clash-tests/:testId/clashes/bulk", needUser, async (c) => {
    const testId = c.req.param("testId");
    const test = await prisma.bimClashTest.findUnique({ where: { id: testId } });
    if (!test) return c.json({ error: "Not found" }, 404);
    const auth = await authorizeClashProject(test.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);

    const body = z
      .object({
        clashIds: z.array(z.string().min(1)).min(1).max(2000),
        status: z.nativeEnum(BimClashStatus).optional(),
        assigneeId: z.string().nullable().optional(),
        issueId: z.string().nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    if (body.data.assigneeId) {
      const ok = await assertUserAssignableToProject(
        body.data.assigneeId,
        test.projectId,
        auth.ctx.project.workspaceId,
      );
      if ("error" in ok) return c.json({ error: ok.error }, ok.status);
    }

    const now = new Date();
    const clashes = await prisma.bimClash.findMany({
      where: { id: { in: body.data.clashIds }, testId },
    });

    await Promise.all(
      clashes.map((clash) => {
        const statusChanging = body.data.status !== undefined && body.data.status !== clash.status;
        return prisma.bimClash.update({
          where: { id: clash.id },
          data: {
            ...(body.data.status !== undefined ? { status: body.data.status } : {}),
            ...(statusChanging
              ? {
                  statusChangedAt: now,
                  statusDistanceMm:
                    body.data.status === "RESOLVED" || body.data.status === "IGNORED"
                      ? clash.distanceMm
                      : null,
                }
              : {}),
            ...(body.data.assigneeId !== undefined ? { assigneeId: body.data.assigneeId } : {}),
            ...(body.data.issueId !== undefined ? { issueId: body.data.issueId } : {}),
          },
        });
      }),
    );

    const updated = await prisma.bimClash.findMany({
      where: { id: { in: body.data.clashIds }, testId },
      include: clashInclude,
    });
    return c.json({ clashes: updated.map(clashRowJson) });
  });

  r.get("/clashes/:clashId/comments", needUser, async (c) => {
    const loaded = await loadClashForUser(c.req.param("clashId"), c.get("user").id);
    if ("error" in loaded) return c.json({ error: loaded.error }, loaded.status);

    const comments = await prisma.bimClashComment.findMany({
      where: { clashId: loaded.clash.id },
      orderBy: { createdAt: "asc" },
      include: commentAuthorInclude,
    });
    return c.json({ comments: comments.map(simpleCommentJson) });
  });

  r.post("/clashes/:clashId/comments", needUser, async (c) => {
    const loaded = await loadClashForUser(c.req.param("clashId"), c.get("user").id);
    if ("error" in loaded) return c.json({ error: loaded.error }, loaded.status);

    const body = await c.req.json<{ body?: string }>();
    const text = body.body?.trim();
    if (!text) return c.json({ error: "body is required" }, 400);

    const comment = await prisma.bimClashComment.create({
      data: {
        clashId: loaded.clash.id,
        authorId: c.get("user").id,
        body: text,
      },
      include: commentAuthorInclude,
    });
    const commentCount = await prisma.bimClashComment.count({
      where: { clashId: loaded.clash.id },
    });
    return c.json({ ...simpleCommentJson(comment), commentCount }, 201);
  });

  /** Aggregated clash health for a building (persisted results; no re-run). */
  // fallow-ignore-next-line complexity
  r.get("/buildings/:buildingId/clash-summary", needUser, async (c) => {
    const loaded = await loadBuildingForUser(c, c.req.param("buildingId"));
    if ("response" in loaded) return loaded.response;

    const projectId = loaded.location.projectId;
    const pro = requireBimPro(loaded.ctx.project.workspace);
    if (pro) return c.json({ error: pro.error }, pro.status);

    const ifcFiles = await prisma.file.findMany({
      where: { buildingId: loaded.building.id, buildingAssetType: AssetType.IFC },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const fileVersionIds = ifcFiles
      .map((f) => f.versions[0]?.id)
      .filter((id): id is string => Boolean(id));
    const newestModelAt = ifcFiles.reduce<Date | null>((acc, f) => {
      const v = f.versions[0];
      if (!v) return acc;
      const t = v.createdAt;
      if (!acc || t > acc) return t;
      return acc;
    }, null);

    const empty = {
      openCount: 0,
      resolvedCount: 0,
      ignoredCount: 0,
      byType: { HARD: 0, CLEARANCE: 0, DUPLICATE: 0 },
      lastRunAt: null as string | null,
      stale: false,
      tests: [] as Array<{
        id: string;
        name: string;
        openCount: number;
        clashCount: number;
        lastRunAt: string | null;
        lastRunStats: ReturnType<typeof parseRunStats>;
      }>,
    };

    if (fileVersionIds.length === 0) {
      return c.json({ summary: empty });
    }

    const buildingClashWhere: Prisma.BimClashWhereInput = {
      projectId,
      OR: [{ fileVersionAId: { in: fileVersionIds } }, { fileVersionBId: { in: fileVersionIds } }],
    };

    const [statusGroups, typeGroups, testGroups, lastSeen] = await Promise.all([
      prisma.bimClash.groupBy({
        by: ["status"],
        where: buildingClashWhere,
        _count: { _all: true },
      }),
      prisma.bimClash.groupBy({
        by: ["clashType"],
        where: buildingClashWhere,
        _count: { _all: true },
      }),
      prisma.bimClash.groupBy({
        by: ["testId", "status"],
        where: buildingClashWhere,
        _count: { _all: true },
      }),
      prisma.bimClash.aggregate({
        where: buildingClashWhere,
        _max: { lastSeenAt: true },
      }),
    ]);

    let openCount = 0;
    let resolvedCount = 0;
    let ignoredCount = 0;
    for (const g of statusGroups) {
      if (g.status === BimClashStatus.NEW || g.status === BimClashStatus.ACTIVE) {
        openCount += g._count._all;
      } else if (g.status === BimClashStatus.RESOLVED) {
        resolvedCount += g._count._all;
      } else if (g.status === BimClashStatus.IGNORED) {
        ignoredCount += g._count._all;
      }
    }

    const byType = { HARD: 0, CLEARANCE: 0, DUPLICATE: 0 };
    for (const g of typeGroups) {
      if (g.clashType in byType) {
        byType[g.clashType as keyof typeof byType] = g._count._all;
      }
    }

    const testIds = [...new Set(testGroups.map((g) => g.testId))];
    const tests =
      testIds.length === 0
        ? []
        : await prisma.bimClashTest.findMany({
            where: { id: { in: testIds } },
            orderBy: { updatedAt: "desc" },
          });

    const openByTest = new Map<string, number>();
    const totalByTest = new Map<string, number>();
    for (const g of testGroups) {
      totalByTest.set(g.testId, (totalByTest.get(g.testId) ?? 0) + g._count._all);
      if (g.status === BimClashStatus.NEW || g.status === BimClashStatus.ACTIVE) {
        openByTest.set(g.testId, (openByTest.get(g.testId) ?? 0) + g._count._all);
      }
    }

    let lastRunAt: Date | null = null;
    for (const t of tests) {
      if (t.lastRunAt && (!lastRunAt || t.lastRunAt > lastRunAt)) lastRunAt = t.lastRunAt;
    }
    if (!lastRunAt && lastSeen._max.lastSeenAt) lastRunAt = lastSeen._max.lastSeenAt;

    const stale = Boolean(
      newestModelAt && lastRunAt && newestModelAt.getTime() > lastRunAt.getTime(),
    );

    return c.json({
      summary: {
        openCount,
        resolvedCount,
        ignoredCount,
        byType,
        lastRunAt: lastRunAt?.toISOString() ?? null,
        stale,
        tests: tests.map((t) => ({
          id: t.id,
          name: t.name,
          openCount: openByTest.get(t.id) ?? 0,
          clashCount: totalByTest.get(t.id) ?? 0,
          lastRunAt: t.lastRunAt?.toISOString() ?? null,
          lastRunStats: parseRunStats(t.lastRunStats),
        })),
      },
    });
  });

  /** Delete persisted clashes involving this building's IFC versions (keeps test configs). */
  r.delete("/buildings/:buildingId/clashes", needUser, async (c) => {
    const loaded = await loadBuildingForUser(c, c.req.param("buildingId"));
    if ("response" in loaded) return loaded.response;

    const projectId = loaded.location.projectId;
    const pro = requireBimPro(loaded.ctx.project.workspace);
    if (pro) return c.json({ error: pro.error }, pro.status);

    const ifcFiles = await prisma.file.findMany({
      where: { buildingId: loaded.building.id, buildingAssetType: AssetType.IFC },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const fileVersionIds = ifcFiles
      .map((f) => f.versions[0]?.id)
      .filter((id): id is string => Boolean(id));

    if (fileVersionIds.length === 0) {
      return c.json({ ok: true, deletedCount: 0 });
    }

    const buildingClashWhere: Prisma.BimClashWhereInput = {
      projectId,
      OR: [{ fileVersionAId: { in: fileVersionIds } }, { fileVersionBId: { in: fileVersionIds } }],
    };

    const affected = await prisma.bimClash.findMany({
      where: buildingClashWhere,
      select: { testId: true },
      distinct: ["testId"],
    });
    const testIds = affected.map((r) => r.testId);

    const deleted = await prisma.bimClash.deleteMany({ where: buildingClashWhere });

    if (testIds.length > 0) {
      const remaining = await prisma.bimClash.groupBy({
        by: ["testId"],
        where: { testId: { in: testIds } },
        _count: { _all: true },
      });
      const stillHas = new Set(remaining.map((r) => r.testId));
      const clearIds = testIds.filter((id) => !stillHas.has(id));
      if (clearIds.length > 0) {
        await prisma.bimClashTest.updateMany({
          where: { id: { in: clearIds } },
          data: { lastRunAt: null, lastRunById: null, lastRunStats: Prisma.DbNull },
        });
      }
    }

    return c.json({ ok: true, deletedCount: deleted.count });
  });
}
