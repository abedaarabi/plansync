import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { prisma } from "../../lib/prisma.js";
import type { Env } from "../../lib/env.js";
import {
  geminiConfigured,
  geminiProposeActions,
  geminiSheetChat,
  geminiSheetSummary,
} from "../../lib/geminiSheetAi.js";
import { loadProjectForMember } from "../../lib/projectAccess.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import {
  assertImageSizeOk,
  sheetChatBodySchema,
  sheetProposeBodySchema,
  sheetSummaryBodySchema,
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
      const { summaryMarkdown, tableOfContents } = await geminiSheetSummary(env, parsed.data);
      return c.json({ summaryMarkdown, tableOfContents });
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
      return c.json({ reply });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      return c.json({ error: msg }, 502);
    }
  });

  r.post("/file-versions/:fileVersionId/ai/propose-actions", needUser, aiBodyLimit, async (c) => {
    if (!geminiConfigured(env)) return c.json({ error: "Sheet AI is not configured" }, 503);

    const fileVersionId = c.req.param("fileVersionId")!;
    const authz = await authorizeSheetAi(fileVersionId, c.get("user").id);
    if ("error" in authz && authz.status === 404) return c.json({ error: authz.error }, 404);
    if ("error" in authz) return c.json({ error: authz.error }, authz.status);

    const raw = await c.req.json().catch(() => null);
    const parsed = sheetProposeBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const b64 = parsed.data.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const img = assertImageSizeOk(b64);
    if (!img.ok) return c.json({ error: img.error }, 400);

    try {
      const { proposals } = await geminiProposeActions(env, parsed.data, parsed.data.userPrompt);
      return c.json({ proposals });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Proposals failed";
      return c.json({ error: msg }, 502);
    }
  });
}
