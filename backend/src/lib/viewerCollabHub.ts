/**
 * In-process viewer collaboration hub (SSE + WebSocket pointers).
 *
 * **Multi-instance:** Rooms live in this Node process memory only. If you run more than one
 * API replica, subscribers on instance A will not receive events from saves handled on B until
 * you add a shared bus (e.g. Redis pub/sub) and publish `viewer_state` / `issues_changed` there.
 */

import { randomUUID } from "node:crypto";
import type { WSEvents, WSContext } from "hono/ws";
import type { WebSocket as WsSocket } from "ws";

export type ViewerCollabPresenceMember = { userId: string; pageIndex?: number };

export type ViewerCollabSsePayload =
  | { type: "hello"; connectionId: string; sessionHostUserId: string | null }
  | {
      type: "presence";
      members: ViewerCollabPresenceMember[];
      sessionHostUserId: string | null;
    }
  | { type: "viewer_state"; revision: number; actorUserId: string }
  | { type: "issues_changed" }
  | { type: "session_ended" }
  | { type: "ping"; t: number };

type RoomConn = {
  connectionId: string;
  userId: string;
  fileVersionId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  lastHeartbeat: number;
  encoder: TextEncoder;
  /** When false, user is omitted from `presence` lists and cursor WS is not broadcast to peers. */
  listInPresence: boolean;
};

const rooms = new Map<string, Map<string, RoomConn>>();
/** Last serialized presence per room to avoid spamming identical `presence` events */
const lastPresenceKey = new Map<string, string>();
/** User who started this live session (first SSE joiner); may transfer if they disconnect. */
const collabSessionHostByFv = new Map<string, string>();
/** userId -> last pageIndex reported via WS (per file version) */
const lastPageByFv = new Map<string, Map<string, number>>();

const sseConnectTimestamps = new Map<string, number[]>();
const wsCursorTimestamps = new Map<string, number[]>();
const wsSelectionTimestamps = new Map<string, number[]>();
/** Skip WS fan-out + rate-limit ticks when payload unchanged (e.g. idle pointer). Key: fvId:connId or fvId:connId:sel */
const lastWsFanoutPayload = new Map<string, string>();

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

function roomMap(fvId: string): Map<string, RoomConn> {
  let m = rooms.get(fvId);
  if (!m) {
    m = new Map();
    rooms.set(fvId, m);
  }
  return m;
}

function sseWrite(conn: RoomConn, ev: ViewerCollabSsePayload) {
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  try {
    conn.controller.enqueue(conn.encoder.encode(data));
  } catch {
    /* stream closed */
  }
}

export function allowSseConnect(userId: string): boolean {
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

function allowWsCursor(connKey: string): boolean {
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

function allowWsSelection(connKey: string): boolean {
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

function presenceMembers(fvId: string): ViewerCollabPresenceMember[] {
  const room = rooms.get(fvId);
  if (!room) return [];
  const now = Date.now();
  const pages = lastPageByFv.get(fvId);
  const seen = new Set<string>();
  const out: ViewerCollabPresenceMember[] = [];
  for (const c of room.values()) {
    if (now - c.lastHeartbeat > HEARTBEAT_TTL_MS) continue;
    if (!c.listInPresence) continue;
    if (seen.has(c.userId)) continue;
    seen.add(c.userId);
    const pageIndex = pages?.get(c.userId);
    out.push(pageIndex !== undefined ? { userId: c.userId, pageIndex } : { userId: c.userId });
  }
  out.sort((a, b) => a.userId.localeCompare(b.userId));
  return out;
}

function presenceKey(members: ViewerCollabPresenceMember[]): string {
  return members.map((m) => `${m.userId}:${m.pageIndex ?? ""}`).join("|");
}

function presenceBroadcastDedupKey(fvId: string, members: ViewerCollabPresenceMember[]): string {
  const host = collabSessionHostByFv.get(fvId) ?? "";
  return `${host}|${presenceKey(members)}`;
}

/** Keep session host valid when the current host has no connections left. */
function ensureSessionHost(fvId: string) {
  const room = rooms.get(fvId);
  if (!room || room.size === 0) {
    collabSessionHostByFv.delete(fvId);
    return;
  }
  const userIds = [...new Set([...room.values()].map((c) => c.userId))].sort();
  const cur = collabSessionHostByFv.get(fvId);
  if (cur && userIds.includes(cur)) return;
  collabSessionHostByFv.set(fvId, userIds[0]!);
}

export function broadcastPresence(fvId: string, force = false) {
  const room = rooms.get(fvId);
  if (!room) return;
  const members = presenceMembers(fvId);
  const key = presenceBroadcastDedupKey(fvId, members);
  if (!force && lastPresenceKey.get(fvId) === key) return;
  lastPresenceKey.set(fvId, key);
  const sessionHostUserId = collabSessionHostByFv.get(fvId) ?? null;
  const ev: ViewerCollabSsePayload = { type: "presence", members, sessionHostUserId };
  for (const c of room.values()) {
    sseWrite(c, ev);
  }
}

export function broadcastViewerCollabSessionEnded(fvId: string) {
  const room = rooms.get(fvId);
  if (!room) return;
  const ev: ViewerCollabSsePayload = { type: "session_ended" };
  for (const c of room.values()) {
    sseWrite(c, ev);
  }
}

/** Returns false if the caller is not the current session host. */
export function endViewerCollabSession(fvId: string, requesterUserId: string): boolean {
  if (collabSessionHostByFv.get(fvId) !== requesterUserId) return false;
  broadcastViewerCollabSessionEnded(fvId);
  collabSessionHostByFv.delete(fvId);
  return true;
}

export function broadcastViewerState(fvId: string, revision: number, actorUserId: string) {
  const room = rooms.get(fvId);
  if (!room) return;
  collabMetrics.viewerStateBroadcasts++;
  const ev: ViewerCollabSsePayload = { type: "viewer_state", revision, actorUserId };
  for (const c of room.values()) {
    sseWrite(c, ev);
  }
}

export function broadcastIssuesChanged(fvId: string) {
  const room = rooms.get(fvId);
  if (!room) return;
  collabMetrics.issuesBroadcasts++;
  for (const c of room.values()) {
    sseWrite(c, { type: "issues_changed" });
  }
}

export function registerSseConnection(
  fileVersionId: string,
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  listInPresence: boolean,
): string {
  const connectionId = randomUUID();
  const encoder = new TextEncoder();
  const conn: RoomConn = {
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
  } else {
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

export function unregisterSseConnection(fileVersionId: string, connectionId: string) {
  const room = rooms.get(fileVersionId);
  if (!room?.delete(connectionId)) return;
  collabMetrics.sseConnectionsOpen = Math.max(0, collabMetrics.sseConnectionsOpen - 1);
  if (room.size === 0) {
    rooms.delete(fileVersionId);
    lastPresenceKey.delete(fileVersionId);
    collabSessionHostByFv.delete(fileVersionId);
  } else {
    ensureSessionHost(fileVersionId);
  }
  broadcastPresence(fileVersionId, true);
}

export function touchHeartbeat(
  fileVersionId: string,
  connectionId: string,
  userId: string,
): boolean {
  const room = rooms.get(fileVersionId);
  const c = room?.get(connectionId);
  if (!c || c.userId !== userId) return false;
  c.lastHeartbeat = Date.now();
  collabMetrics.heartbeatTotal++;
  broadcastPresence(fileVersionId);
  return true;
}

/** Explicit leave (tab close / keepalive fetch); idempotent with stream cancel. */
export function disconnectViewerCollabSse(
  fileVersionId: string,
  connectionId: string,
  userId: string,
): boolean {
  const room = rooms.get(fileVersionId);
  const c = room?.get(connectionId);
  if (!c || c.userId !== userId) return false;
  try {
    c.controller.close();
  } catch {
    /* */
  }
  unregisterSseConnection(fileVersionId, connectionId);
  return true;
}

export function setUserPageFromWs(fileVersionId: string, userId: string, pageIndex: number) {
  let m = lastPageByFv.get(fileVersionId);
  if (!m) {
    m = new Map();
    lastPageByFv.set(fileVersionId, m);
  }
  if (m.get(userId) === pageIndex) return;
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
        } catch {
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
    } else {
      ensureSessionHost(fvId);
      /** Dedup skips redundant SSE when membership + pages unchanged (avoids 30s full-room spam). */
      broadcastPresence(fvId);
    }
  }
}, PRUNE_MS);

setInterval(() => {
  const ev: ViewerCollabSsePayload = { type: "ping", t: Date.now() };
  const now = Date.now();
  for (const conns of rooms.values()) {
    for (const c of conns.values()) {
      c.lastHeartbeat = now;
      sseWrite(c, ev);
    }
  }
}, 25_000);

/** WebSocket: broadcast cursor JSON to other sockets in the same file version room */
const wsByFv = new Map<string, Map<string, WSContext<WsSocket>>>();

function clearWsFanoutDedupe(fileVersionId: string, connectionId: string) {
  lastWsFanoutPayload.delete(`${fileVersionId}:${connectionId}`);
  lastWsFanoutPayload.delete(`${fileVersionId}:${connectionId}:sel`);
}

export function registerViewerCollabWs(
  fileVersionId: string,
  connectionId: string,
  ws: WSContext<WsSocket>,
) {
  let m = wsByFv.get(fileVersionId);
  if (!m) {
    m = new Map();
    wsByFv.set(fileVersionId, m);
  }
  m.set(connectionId, ws);
  collabMetrics.wsConnectionsOpen++;
  collabMetrics.wsConnectTotal++;
}

export function unregisterViewerCollabWs(fileVersionId: string, connectionId: string) {
  const m = wsByFv.get(fileVersionId);
  if (!m?.delete(connectionId)) return;
  clearWsFanoutDedupe(fileVersionId, connectionId);
  collabMetrics.wsConnectionsOpen = Math.max(0, collabMetrics.wsConnectionsOpen - 1);
  if (m.size === 0) wsByFv.delete(fileVersionId);
}

export function broadcastCursor(
  fileVersionId: string,
  fromConnectionId: string,
  fromUserId: string,
  payload: Record<string, unknown>,
  listInPresence: boolean,
) {
  if (!listInPresence) return;
  const connKey = `${fileVersionId}:${fromConnectionId}`;
  const msg = JSON.stringify({ ...payload, userId: fromUserId });
  if (lastWsFanoutPayload.get(connKey) === msg) return;
  if (!allowWsCursor(connKey)) {
    collabMetrics.wsCursorDropped++;
    return;
  }
  lastWsFanoutPayload.set(connKey, msg);
  const m = wsByFv.get(fileVersionId);
  if (!m) return;
  for (const [id, ws] of m) {
    if (id === fromConnectionId) continue;
    try {
      ws.send(msg);
    } catch {
      /* */
    }
  }
}

export function broadcastSelection(
  fileVersionId: string,
  fromConnectionId: string,
  fromUserId: string,
  annotationIds: string[],
  listInPresence: boolean,
) {
  if (!listInPresence) return;
  const connKey = `${fileVersionId}:${fromConnectionId}:sel`;
  const msg = JSON.stringify({
    type: "selection",
    annotationIds,
    userId: fromUserId,
  });
  if (lastWsFanoutPayload.get(connKey) === msg) return;
  if (!allowWsSelection(connKey)) return;
  lastWsFanoutPayload.set(connKey, msg);
  const m = wsByFv.get(fileVersionId);
  if (!m) return;
  for (const [id, ws] of m) {
    if (id === fromConnectionId) continue;
    try {
      ws.send(msg);
    } catch {
      /* */
    }
  }
}

export function buildViewerCollabWsHandler(args: {
  fileVersionId: string;
  userId: string;
  listInPresence: boolean;
}): WSEvents<WsSocket> {
  const connectionId = randomUUID();
  const { fileVersionId, userId, listInPresence } = args;
  return {
    onOpen(_evt, ws) {
      registerViewerCollabWs(fileVersionId, connectionId, ws);
    },
    onMessage(evt, ws) {
      if (typeof evt.data !== "string") return;
      let j: {
        type?: string;
        pageIndex?: number;
        x?: number;
        y?: number;
        annotationIds?: unknown;
      };
      try {
        j = JSON.parse(evt.data) as typeof j;
      } catch {
        return;
      }
      if (j.type === "cursor" && typeof j.pageIndex === "number") {
        if (listInPresence) {
          setUserPageFromWs(fileVersionId, userId, j.pageIndex);
        }
        broadcastCursor(
          fileVersionId,
          connectionId,
          userId,
          {
            type: "cursor",
            pageIndex: j.pageIndex,
            x: j.x,
            y: j.y,
          },
          listInPresence,
        );
      } else if (j.type === "selection" && Array.isArray(j.annotationIds)) {
        const annotationIds = j.annotationIds
          .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 200)
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
