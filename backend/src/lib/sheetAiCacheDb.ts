import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { sheetAiPageCacheEntrySchema, type SheetAiPageCacheEntry } from "./sheetAiSchemas.js";

const CACHE_V = 1 as const;

type SheetAiCacheRoot = {
  v: typeof CACHE_V;
  byPage: Record<string, unknown>;
};

function parseRoot(raw: unknown): SheetAiCacheRoot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { v: CACHE_V, byPage: {} };
  }
  const o = raw as Record<string, unknown>;
  const byPage = o.byPage;
  if (!byPage || typeof byPage !== "object" || Array.isArray(byPage)) {
    return { v: CACHE_V, byPage: {} };
  }
  return { v: CACHE_V, byPage: { ...(byPage as Record<string, unknown>) } };
}

export function parseSheetAiPageCacheEntry(raw: unknown): SheetAiPageCacheEntry | null {
  const parsed = sheetAiPageCacheEntrySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function emptyPageEntry(): SheetAiPageCacheEntry {
  return {
    summaryMarkdown: "",
    readingsTable: [],
    tableOfContents: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export async function getSheetAiPageFromDb(
  fileVersionId: string,
  pageIndex0: number,
): Promise<SheetAiPageCacheEntry | null> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    select: { sheetAiCache: true },
  });
  if (!fv?.sheetAiCache) return null;
  const root = parseRoot(fv.sheetAiCache);
  const key = String(pageIndex0);
  return parseSheetAiPageCacheEntry(root.byPage[key]);
}

export async function mergeSheetAiPageInDb(
  fileVersionId: string,
  pageIndex0: number,
  patch: Partial<SheetAiPageCacheEntry>,
): Promise<void> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    select: { sheetAiCache: true },
  });
  const root = parseRoot(fv?.sheetAiCache);
  const key = String(pageIndex0);
  const prev = parseSheetAiPageCacheEntry(root.byPage[key]) ?? emptyPageEntry();
  const next: SheetAiPageCacheEntry = {
    summaryMarkdown: patch.summaryMarkdown ?? prev.summaryMarkdown,
    readingsTable: patch.readingsTable ?? prev.readingsTable,
    tableOfContents: patch.tableOfContents ?? prev.tableOfContents,
    updatedAt: new Date().toISOString(),
  };
  if (patch.takeoffAssist !== undefined) {
    next.takeoffAssist = patch.takeoffAssist;
  } else if (prev.takeoffAssist) {
    next.takeoffAssist = prev.takeoffAssist;
  }
  if (patch.chatMessages !== undefined) {
    next.chatMessages = patch.chatMessages;
  } else if (prev.chatMessages && prev.chatMessages.length > 0) {
    next.chatMessages = prev.chatMessages;
  }
  root.byPage[key] = next;
  await prisma.fileVersion.update({
    where: { id: fileVersionId },
    data: { sheetAiCache: root as unknown as Prisma.InputJsonValue },
  });
}

export async function saveSheetAiSummaryToDb(
  fileVersionId: string,
  pageIndex0: number,
  payload: Pick<SheetAiPageCacheEntry, "summaryMarkdown" | "readingsTable" | "tableOfContents">,
): Promise<void> {
  await mergeSheetAiPageInDb(fileVersionId, pageIndex0, {
    summaryMarkdown: payload.summaryMarkdown,
    readingsTable: payload.readingsTable,
    tableOfContents: payload.tableOfContents,
  });
}

export async function saveTakeoffAssistToDb(
  fileVersionId: string,
  pageIndex0: number,
  takeoffAssist: NonNullable<SheetAiPageCacheEntry["takeoffAssist"]>,
): Promise<void> {
  await mergeSheetAiPageInDb(fileVersionId, pageIndex0, { takeoffAssist });
}

const MAX_CACHED_CHAT_MESSAGES = 48;

export async function saveSheetAiChatToDb(
  fileVersionId: string,
  pageIndex0: number,
  chatMessages: NonNullable<SheetAiPageCacheEntry["chatMessages"]>,
): Promise<void> {
  const trimmed =
    chatMessages.length > MAX_CACHED_CHAT_MESSAGES
      ? chatMessages.slice(-MAX_CACHED_CHAT_MESSAGES)
      : chatMessages;
  await mergeSheetAiPageInDb(fileVersionId, pageIndex0, {
    chatMessages: trimmed,
  });
}
