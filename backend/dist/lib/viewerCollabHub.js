/**
 * In-process viewer collaboration hub (SSE + WebSocket pointers).
 *
 * **Multi-instance:** Rooms live in this Node process memory only. If you run more than one
 * API replica, subscribers on instance A will not receive events from saves handled on B until
 * you add a shared bus (e.g. Redis pub/sub) and publish `viewer_state` / `issues_changed` there.
 */
import { randomUUID } from "node:crypto";
const rooms = new Map();
/** Last serialized presence per room to avoid spamming identical `presence` events */
const lastPresenceKey = new Map();
/** User who started this live session (first SSE joiner); may transfer if they disconnect. */
const collabSessionHostByFv = new Map();
/** userId -> last pageIndex reported via WS (per file version) */
const lastPageByFv = new Map();
const sseConnectTimestamps = new Map();
const wsCursorTimestamps = new Map();
const wsSelectionTimestamps = new Map();
/** Skip WS fan-out + rate-limit ticks when payload unchanged (e.g. idle pointer). Key: fvId:connId or fvId:connId:sel */
const lastWsFanoutPayload = new Map();
/** Exported counters for `/internal/collab-metrics` and tests */
export const collabMetrics = {
    sseConnectionsOpen: 0,
    sseConnectTotal: 0,
    wsConnectionsOpen: 0,
    wsConnectTotal: 0,
    wsCursorDropped: 0,
    wsSelectionDropped: 0,
    viewerStateBroadcasts: 0,
    issuesBroadcasts: 0,
    put409Count: 0,
    heartbeatTotal: 0,
    rateLimitedSse: 0,
    rateLimitedWs: 0,
};
const HEARTBEAT_TTL_MS = 75_000;
const PRUNE_MS = 30_000;
const MAX_SSE_CONNECTS_PER_MINUTE = 24;
/** Per WebSocket connection; ~11 sends/sec per tab + headroom for two tabs / bursts. */
const MAX_WS_CURSORS_PER_SECOND = 48;
const MAX_WS_SELECTION_PER_SECOND = 20;
function roomMap(fvId) {
    let m = rooms.get(fvId);
    if (!m) {
        m = new Map();
        rooms.set(fvId, m);
    }
    return m;
}
function sseWrite(conn, ev) {
    const data = `data: ${JSON.stringify(ev)}\n\n`;
    try {
        conn.controller.enqueue(conn.encoder.encode(data));
    }
    catch {
        /* stream closed */
    }
}
export function allowSseConnect(userId) {
    const now = Date.now();
    const windowMs = 60_000;
    let arr = sseConnectTimestamps.get(userId) ?? [];
    arr = arr.filter((t) => now - t < windowMs);
    if (arr.length >= MAX_SSE_CONNECTS_PER_MINUTE) {
        collabMetrics.rateLimitedSse++;
        return false;
    }
    arr.push(now);
    sseConnectTimestamps.set(userId, arr);
    return true;
}
function allowWsCursor(connKey) {
    const now = Date.now();
    const windowMs = 1000;
    let arr = wsCursorTimestamps.get(connKey) ?? [];
    arr = arr.filter((t) => now - t < windowMs);
    if (arr.length >= MAX_WS_CURSORS_PER_SECOND) {
        collabMetrics.rateLimitedWs++;
        return false;
    }
    arr.push(now);
    wsCursorTimestamps.set(connKey, arr);
    return true;
}
function allowWsSelection(connKey) {
    const now = Date.now();
    const windowMs = 1000;
    let arr = wsSelectionTimestamps.get(connKey) ?? [];
    arr = arr.filter((t) => now - t < windowMs);
    if (arr.length >= MAX_WS_SELECTION_PER_SECOND) {
        collabMetrics.wsSelectionDropped++;
        return false;
    }
    arr.push(now);
    wsSelectionTimestamps.set(connKey, arr);
    return true;
}
function presenceMembers(fvId) {
    const room = rooms.get(fvId);
    if (!room)
        return [];
    const now = Date.now();
    const pages = lastPageByFv.get(fvId);
    const seen = new Set();
    const out = [];
    for (const c of room.values()) {
        if (now - c.lastHeartbeat > HEARTBEAT_TTL_MS)
            continue;
        if (!c.listInPresence)
            continue;
        if (seen.has(c.userId))
            continue;
        seen.add(c.userId);
        const pageIndex = pages?.get(c.userId);
        out.push(pageIndex !== undefined ? { userId: c.userId, pageIndex } : { userId: c.userId });
    }
    out.sort((a, b) => a.userId.localeCompare(b.userId));
    return out;
}
function presenceKey(members) {
    return members.map((m) => `${m.userId}:${m.pageIndex ?? ""}`).join("|");
}
function presenceBroadcastDedupKey(fvId, members) {
    const host = collabSessionHostByFv.get(fvId) ?? "";
    return `${host}|${presenceKey(members)}`;
}
/** Keep session host valid when the current host has no connections left. */
function ensureSessionHost(fvId) {
    const room = rooms.get(fvId);
    if (!room || room.size === 0) {
        collabSessionHostByFv.delete(fvId);
        return;
    }
    const userIds = [...new Set([...room.values()].map((c) => c.userId))].sort();
    const cur = collabSessionHostByFv.get(fvId);
    if (cur && userIds.includes(cur))
        return;
    collabSessionHostByFv.set(fvId, userIds[0]);
}
export function broadcastPresence(fvId, force = false) {
    const room = rooms.get(fvId);
    if (!room)
        return;
    const members = presenceMembers(fvId);
    const key = presenceBroadcastDedupKey(fvId, members);
    if (!force && lastPresenceKey.get(fvId) === key)
        return;
    lastPresenceKey.set(fvId, key);
    const sessionHostUserId = collabSessionHostByFv.get(fvId) ?? null;
    const ev = { type: "presence", members, sessionHostUserId };
    for (const c of room.values()) {
        sseWrite(c, ev);
    }
}
export function broadcastViewerCollabSessionEnded(fvId) {
    const room = rooms.get(fvId);
    if (!room)
        return;
    const ev = { type: "session_ended" };
    for (const c of room.values()) {
        sseWrite(c, ev);
    }
}
/** Returns false if the caller is not the current session host. */
export function endViewerCollabSession(fvId, requesterUserId) {
    if (collabSessionHostByFv.get(fvId) !== requesterUserId)
        return false;
    broadcastViewerCollabSessionEnded(fvId);
    collabSessionHostByFv.delete(fvId);
    return true;
}
export function broadcastViewerState(fvId, revision, actorUserId) {
    const room = rooms.get(fvId);
    if (!room)
        return;
    collabMetrics.viewerStateBroadcasts++;
    const ev = { type: "viewer_state", revision, actorUserId };
    for (const c of room.values()) {
        sseWrite(c, ev);
    }
}
export function broadcastIssuesChanged(fvId) {
    const room = rooms.get(fvId);
    if (!room)
        return;
    collabMetrics.issuesBroadcasts++;
    for (const c of room.values()) {
        sseWrite(c, { type: "issues_changed" });
    }
}
export function registerSseConnection(fileVersionId, userId, controller, listInPresence) {
    const connectionId = randomUUID();
    const encoder = new TextEncoder();
    const conn = {
        connectionId,
        userId,
        fileVersionId,
        controller,
        lastHeartbeat: Date.now(),
        encoder,
        listInPresence,
    };
    const room = roomMap(fileVersionId);
    const firstConnectionInRoom = room.size === 0;
    room.set(connectionId, conn);
    if (firstConnectionInRoom) {
        collabSessionHostByFv.set(fileVersionId, userId);
    }
    else {
        ensureSessionHost(fileVersionId);
    }
    collabMetrics.sseConnectionsOpen++;
    collabMetrics.sseConnectTotal++;
    const sessionHostUserId = collabSessionHostByFv.get(fileVersionId) ?? null;
    sseWrite(conn, { type: "hello", connectionId, sessionHostUserId });
    broadcastPresence(fileVersionId, true);
    if (roomMap(fileVersionId).size > 100) {
        console.warn(`[viewer-collab] large room ${fileVersionId}: ${roomMap(fileVersionId).size} sse`);
    }
    return connectionId;
}
export function unregisterSseConnection(fileVersionId, connectionId) {
    const room = rooms.get(fileVersionId);
    if (!room?.delete(connectionId))
        return;
    collabMetrics.sseConnectionsOpen = Math.max(0, collabMetrics.sseConnectionsOpen - 1);
    if (room.size === 0) {
        rooms.delete(fileVersionId);
        lastPresenceKey.delete(fileVersionId);
        collabSessionHostByFv.delete(fileVersionId);
    }
    else {
        ensureSessionHost(fileVersionId);
    }
    broadcastPresence(fileVersionId, true);
}
export function touchHeartbeat(fileVersionId, connectionId, userId) {
    const room = rooms.get(fileVersionId);
    const c = room?.get(connectionId);
    if (!c || c.userId !== userId)
        return false;
    c.lastHeartbeat = Date.now();
    collabMetrics.heartbeatTotal++;
    broadcastPresence(fileVersionId);
    return true;
}
/** Explicit leave (tab close / keepalive fetch); idempotent with stream cancel. */
export function disconnectViewerCollabSse(fileVersionId, connectionId, userId) {
    const room = rooms.get(fileVersionId);
    const c = room?.get(connectionId);
    if (!c || c.userId !== userId)
        return false;
    try {
        c.controller.close();
    }
    catch {
        /* */
    }
    unregisterSseConnection(fileVersionId, connectionId);
    return true;
}
export function setUserPageFromWs(fileVersionId, userId, pageIndex) {
    let m = lastPageByFv.get(fileVersionId);
    if (!m) {
        m = new Map();
        lastPageByFv.set(fileVersionId, m);
    }
    if (m.get(userId) === pageIndex)
        return;
    m.set(userId, pageIndex);
    broadcastPresence(fileVersionId);
}
setInterval(() => {
    const now = Date.now();
    for (const [fvId, room] of [...rooms.entries()]) {
        for (const [cid, c] of [...room.entries()]) {
            if (now - c.lastHeartbeat > HEARTBEAT_TTL_MS + 15_000) {
                try {
                    c.controller.close();
                }
                catch {
                    /* */
                }
                room.delete(cid);
                collabMetrics.sseConnectionsOpen = Math.max(0, collabMetrics.sseConnectionsOpen - 1);
            }
        }
        if (room.size === 0) {
            rooms.delete(fvId);
            lastPresenceKey.delete(fvId);
            collabSessionHostByFv.delete(fvId);
        }
        else {
            ensureSessionHost(fvId);
            /** Dedup skips redundant SSE when membership + pages unchanged (avoids 30s full-room spam). */
            broadcastPresence(fvId);
        }
    }
}, PRUNE_MS);
setInterval(() => {
    const ev = { type: "ping", t: Date.now() };
    const now = Date.now();
    for (const conns of rooms.values()) {
        for (const c of conns.values()) {
            c.lastHeartbeat = now;
            sseWrite(c, ev);
        }
    }
}, 25_000);
/** WebSocket: broadcast cursor JSON to other sockets in the same file version room */
const wsByFv = new Map();
function clearWsFanoutDedupe(fileVersionId, connectionId) {
    lastWsFanoutPayload.delete(`${fileVersionId}:${connectionId}`);
    lastWsFanoutPayload.delete(`${fileVersionId}:${connectionId}:sel`);
}
export function registerViewerCollabWs(fileVersionId, connectionId, ws) {
    let m = wsByFv.get(fileVersionId);
    if (!m) {
        m = new Map();
        wsByFv.set(fileVersionId, m);
    }
    m.set(connectionId, ws);
    collabMetrics.wsConnectionsOpen++;
    collabMetrics.wsConnectTotal++;
}
export function unregisterViewerCollabWs(fileVersionId, connectionId) {
    const m = wsByFv.get(fileVersionId);
    if (!m?.delete(connectionId))
        return;
    clearWsFanoutDedupe(fileVersionId, connectionId);
    collabMetrics.wsConnectionsOpen = Math.max(0, collabMetrics.wsConnectionsOpen - 1);
    if (m.size === 0)
        wsByFv.delete(fileVersionId);
}
export function broadcastCursor(fileVersionId, fromConnectionId, fromUserId, payload, listInPresence) {
    if (!listInPresence)
        return;
    const connKey = `${fileVersionId}:${fromConnectionId}`;
    const msg = JSON.stringify({ ...payload, userId: fromUserId });
    if (lastWsFanoutPayload.get(connKey) === msg)
        return;
    if (!allowWsCursor(connKey)) {
        collabMetrics.wsCursorDropped++;
        return;
    }
    lastWsFanoutPayload.set(connKey, msg);
    const m = wsByFv.get(fileVersionId);
    if (!m)
        return;
    for (const [id, ws] of m) {
        if (id === fromConnectionId)
            continue;
        try {
            ws.send(msg);
        }
        catch {
            /* */
        }
    }
}
export function broadcastSelection(fileVersionId, fromConnectionId, fromUserId, annotationIds, listInPresence) {
    if (!listInPresence)
        return;
    const connKey = `${fileVersionId}:${fromConnectionId}:sel`;
    const msg = JSON.stringify({
        type: "selection",
        annotationIds,
        userId: fromUserId,
    });
    if (lastWsFanoutPayload.get(connKey) === msg)
        return;
    if (!allowWsSelection(connKey))
        return;
    lastWsFanoutPayload.set(connKey, msg);
    const m = wsByFv.get(fileVersionId);
    if (!m)
        return;
    for (const [id, ws] of m) {
        if (id === fromConnectionId)
            continue;
        try {
            ws.send(msg);
        }
        catch {
            /* */
        }
    }
}
export function buildViewerCollabWsHandler(args) {
    const connectionId = randomUUID();
    const { fileVersionId, userId, listInPresence } = args;
    return {
        onOpen(_evt, ws) {
            registerViewerCollabWs(fileVersionId, connectionId, ws);
        },
        onMessage(evt, ws) {
            if (typeof evt.data !== "string")
                return;
            let j;
            try {
                j = JSON.parse(evt.data);
            }
            catch {
                return;
            }
            if (j.type === "cursor" && typeof j.pageIndex === "number") {
                if (listInPresence) {
                    setUserPageFromWs(fileVersionId, userId, j.pageIndex);
                }
                broadcastCursor(fileVersionId, connectionId, userId, {
                    type: "cursor",
                    pageIndex: j.pageIndex,
                    x: j.x,
                    y: j.y,
                }, listInPresence);
            }
            else if (j.type === "selection" && Array.isArray(j.annotationIds)) {
                const annotationIds = j.annotationIds
                    .filter((x) => typeof x === "string" && x.length > 0 && x.length <= 200)
                    .slice(0, 80);
                broadcastSelection(fileVersionId, connectionId, userId, annotationIds, listInPresence);
            }
        },
        onClose(_evt, ws) {
            unregisterViewerCollabWs(fileVersionId, connectionId);
        },
    };
}
export function getCollabMetricsSnapshot() {
    let sseRooms = 0;
    let sseSubs = 0;
    for (const m of rooms.values()) {
        sseRooms++;
        sseSubs += m.size;
    }
    let wsRooms = 0;
    let wsSubs = 0;
    for (const m of wsByFv.values()) {
        wsRooms++;
        wsSubs += m.size;
    }
    return {
        ...collabMetrics,
        sseRooms,
        sseSubscribers: sseSubs,
        wsRooms,
        wsSubscribers: wsSubs,
    };
}
