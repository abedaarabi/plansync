import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { prisma } from "../../lib/prisma.js";
import type { Env } from "../../lib/env.js";
import {
  geminiConfigured,
  geminiSheetChat,
  geminiSheetSummary,
  geminiTakeoffAssistDetect,
} from "../../lib/geminiSheetAi.js";
import { loadProjectForMember } from "../../lib/projectAccess.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import {
  getSheetAiPageFromDb,
  saveSheetAiChatToDb,
  saveSheetAiSummaryToDb,
  saveTakeoffAssistToDb,
} from "../../lib/sheetAiCacheDb.js";
import {
  assertImageSizeOk,
  sheetChatBodySchema,
  sheetSummaryBodySchema,
  sheetTakeoffDetectBodySchema,
} from "../../lib/sheetAiSchemas.js";

function requirePro(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspacePro(workspace)) {
    return { error: "Pro subscription required", status: 402 as const };
  }
  return null;
}

async function authorizeSheetAi(fileVersionId: string, userId: string) {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: { include: { workspace: true } } } } },
  });
  if (!fv) return { error: "Not found" as const, status: 404 as const };
  const access = await loadProjectForMember(fv.file.projectId, userId);
  if ("error" in access) return { error: access.error, status: access.status };
  const gate = requirePro(access.project.workspace);
  if (gate) return { error: gate.error, status: gate.status };
  return { fv };
}

const aiBodyLimit = bodyLimit({
  maxSize: 9 * 1024 * 1024,
  onError: (c) => c.json({ error: "Payload too large" }, 413),
});

export function registerSheetAiRoutes(r: Hono, needUser: MiddlewareHandler, env: Env) {
  r.get("/file-versions/:fileVersionId/ai/sheet-cache", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const authz = await authorizeSheetAi(fileVersionId, c.get("user").id);
    if ("error" in authz && authz.status === 404) return c.json({ error: authz.error }, 404);
    if ("error" in authz) return c.json({ error: authz.error }, authz.status);

    const pageRaw = c.req.query("pageIndex");
    const pageIndex0 = pageRaw === undefined ? NaN : Number(pageRaw);
    if (!Number.isInteger(pageIndex0) || pageIndex0 < 0 || pageIndex0 > 10_000) {
      return c.json({ error: "Invalid pageIndex (0-based integer)" }, 400);
    }

    const entry = await getSheetAiPageFromDb(fileVersionId, pageIndex0);
    if (!entry) {
      return c.json({ cached: false as const });
    }
    const hasSummary = entry.summaryMarkdown.trim().length > 0;
    const hasTables = entry.readingsTable.length > 0 || entry.tableOfContents.length > 0;
    const hasChat = (entry.chatMessages?.length ?? 0) > 0;
    const hasTakeoffAssist =
      entry.takeoffAssist != null && entry.takeoffAssist.categories.length > 0;
    if (!hasSummary && !hasTables && !hasChat && !hasTakeoffAssist) {
      return c.json({ cached: false as const });
    }
    return c.json({
      cached: true as const,
      summaryMarkdown: entry.summaryMarkdown,
      readingsTable: entry.readingsTable,
      tableOfContents: entry.tableOfContents,
      chatMessages: entry.chatMessages ?? [],
      ...(entry.takeoffAssist ? { takeoffAssist: entry.takeoffAssist } : {}),
      updatedAt: entry.updatedAt,
    });
  });

  r.post("/file-versions/:fileVersionId/ai/sheet-summary", needUser, aiBodyLimit, async (c) => {
    if (!geminiConfigured(env)) return c.json({ error: "Sheet AI is not configured" }, 503);

    const fileVersionId = c.req.param("fileVersionId")!;
    const authz = await authorizeSheetAi(fileVersionId, c.get("user").id);
    if ("error" in authz && authz.status === 404) return c.json({ error: authz.error }, 404);
    if ("error" in authz) return c.json({ error: authz.error }, authz.status);

    const raw = await c.req.json().catch(() => null);
    const parsed = sheetSummaryBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const img = assertImageSizeOk(parsed.data.imageBase64.replace(/^data:[^;]+;base64,/, ""));
    if (!img.ok) return c.json({ error: img.error }, 400);

    try {
      const { summaryMarkdown, readingsTable, tableOfContents } = await geminiSheetSummary(
        env,
        parsed.data,
      );
      await saveSheetAiSummaryToDb(fileVersionId, parsed.data.pageIndex, {
        summaryMarkdown,
        readingsTable,
        tableOfContents,
      });
      return c.json({ summaryMarkdown, readingsTable, tableOfContents });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sheet summary failed";
      return c.json({ error: msg }, 502);
    }
  });

  r.post("/file-versions/:fileVersionId/ai/chat", needUser, aiBodyLimit, async (c) => {
    if (!geminiConfigured(env)) return c.json({ error: "Sheet AI is not configured" }, 503);

    const fileVersionId = c.req.param("fileVersionId")!;
    const authz = await authorizeSheetAi(fileVersionId, c.get("user").id);
    if ("error" in authz && authz.status === 404) return c.json({ error: authz.error }, 404);
    if ("error" in authz) return c.json({ error: authz.error }, authz.status);

    const raw = await c.req.json().catch(() => null);
    const parsed = sheetChatBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const b64 = parsed.data.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const img = assertImageSizeOk(b64);
    if (!img.ok) return c.json({ error: img.error }, 400);

    try {
      const { reply } = await geminiSheetChat(env, parsed.data, parsed.data.messages);
      const thread = [...parsed.data.messages, { role: "model" as const, content: reply }];
      await saveSheetAiChatToDb(fileVersionId, parsed.data.pageIndex, thread);
      return c.json({ reply });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      return c.json({ error: msg }, 502);
    }
  });

  r.post("/file-versions/:fileVersionId/ai/takeoff-detect", needUser, aiBodyLimit, async (c) => {
    if (!geminiConfigured(env)) return c.json({ error: "Sheet AI is not configured" }, 503);

    const fileVersionId = c.req.param("fileVersionId")!;
    const authz = await authorizeSheetAi(fileVersionId, c.get("user").id);
    if ("error" in authz && authz.status === 404) return c.json({ error: authz.error }, 404);
    if ("error" in authz) return c.json({ error: authz.error }, authz.status);

    const raw = await c.req.json().catch(() => null);
    const parsed = sheetTakeoffDetectBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const img = assertImageSizeOk(parsed.data.imageBase64.replace(/^data:[^;]+;base64,/, ""));
    if (!img.ok) return c.json({ error: img.error }, 400);

    try {
      const takeoffAssist = await geminiTakeoffAssistDetect(env, parsed.data);
      await saveTakeoffAssistToDb(fileVersionId, parsed.data.pageIndex, takeoffAssist);
      return c.json({ takeoffAssist });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Takeoff detect failed";
      return c.json({ error: msg }, 502);
    }
  });
}
