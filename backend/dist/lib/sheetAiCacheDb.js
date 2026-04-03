import { prisma } from "./prisma.js";
import { sheetAiPageCacheEntrySchema } from "./sheetAiSchemas.js";
const CACHE_V = 1;
function parseRoot(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { v: CACHE_V, byPage: {} };
    }
    const o = raw;
    const byPage = o.byPage;
    if (!byPage || typeof byPage !== "object" || Array.isArray(byPage)) {
        return { v: CACHE_V, byPage: {} };
    }
    return { v: CACHE_V, byPage: { ...byPage } };
}
export function parseSheetAiPageCacheEntry(raw) {
    const parsed = sheetAiPageCacheEntrySchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
}
function emptyPageEntry() {
    return {
        summaryMarkdown: "",
        readingsTable: [],
        tableOfContents: [],
        updatedAt: new Date(0).toISOString(),
    };
}
export async function getSheetAiPageFromDb(fileVersionId, pageIndex0) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        select: { sheetAiCache: true },
    });
    if (!fv?.sheetAiCache)
        return null;
    const root = parseRoot(fv.sheetAiCache);
    const key = String(pageIndex0);
    return parseSheetAiPageCacheEntry(root.byPage[key]);
}
export async function mergeSheetAiPageInDb(fileVersionId, pageIndex0, patch) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        select: { sheetAiCache: true },
    });
    const root = parseRoot(fv?.sheetAiCache);
    const key = String(pageIndex0);
    const prev = parseSheetAiPageCacheEntry(root.byPage[key]) ?? emptyPageEntry();
    const next = {
        summaryMarkdown: patch.summaryMarkdown ?? prev.summaryMarkdown,
        readingsTable: patch.readingsTable ?? prev.readingsTable,
        tableOfContents: patch.tableOfContents ?? prev.tableOfContents,
        updatedAt: new Date().toISOString(),
    };
    if (patch.chatMessages !== undefined) {
        next.chatMessages = patch.chatMessages;
    }
    else if (prev.chatMessages && prev.chatMessages.length > 0) {
        next.chatMessages = prev.chatMessages;
    }
    root.byPage[key] = next;
    await prisma.fileVersion.update({
        where: { id: fileVersionId },
        data: { sheetAiCache: root },
    });
}
export async function saveSheetAiSummaryToDb(fileVersionId, pageIndex0, payload) {
    await mergeSheetAiPageInDb(fileVersionId, pageIndex0, {
        summaryMarkdown: payload.summaryMarkdown,
        readingsTable: payload.readingsTable,
        tableOfContents: payload.tableOfContents,
    });
}
const MAX_CACHED_CHAT_MESSAGES = 48;
export async function saveSheetAiChatToDb(fileVersionId, pageIndex0, chatMessages) {
    const trimmed = chatMessages.length > MAX_CACHED_CHAT_MESSAGES
        ? chatMessages.slice(-MAX_CACHED_CHAT_MESSAGES)
        : chatMessages;
    await mergeSheetAiPageInDb(fileVersionId, pageIndex0, {
        chatMessages: trimmed,
    });
}
