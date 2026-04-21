"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchViewerState,
  postViewerCollabEndSession,
  postViewerCollabHeartbeat,
  postViewerCollabLeaveKeepalive,
} from "@/lib/api-client";
import { apiUrl, wsApiUrl } from "@/lib/api-url";
import { parseServerViewerState } from "@/lib/viewerStateCloud";
import { buildMergePatchFromRemote } from "@/lib/viewerStateMerge";
import { getViewerCollabRevision, setViewerCollabRevision } from "@/lib/viewerCollabRevision";
import { qk } from "@/lib/queryKeys";
import { clampViewerScaleWithPageDims, useViewerStore } from "@/store/viewerStore";
import { useViewerCollabDesktop } from "@/hooks/useViewerCollabDesktop";
import {
  ViewerCollabProvider,
  type ViewerCollabPresenceMember,
  type ViewerRemoteCursor,
  type ViewerRemoteSelection,
} from "./viewerCollabContext";
import { toast } from "sonner";

type SsePayload =
  | { type: "hello"; connectionId: string; sessionHostUserId?: string | null }
  | {
      type: "presence";
      members: ViewerCollabPresenceMember[];
      sessionHostUserId?: string | null;
    }
  | { type: "viewer_state"; revision: number; actorUserId: string }
  | { type: "issues_changed" }
  | { type: "session_ended" }
  | { type: "ping"; t: number };

/** Hide remote cursor this long after the last cursor packet (peer idle / background tab). */
const REMOTE_CURSOR_LINGER_MS = 18_000;
const REMOTE_SELECTION_LINGER_MS = 22_000;
/** Slightly looser than 60fps to cut WS + server fan-out; motion-safe transition hides jitter. */
const POINTER_SEND_MIN_MS_VISIBLE = 120;
const POINTER_SEND_MIN_MS_HIDDEN = 2_000;

/** Per sheet revision: user left / hid tab / closed — must click "Rejoin live session". */
function collabOptOutStorageKey(fileVersionId: string) {
  return `plansyncViewerCollabOptOut:${fileVersionId}`;
}

function markViewerCollabOptOut(fileVersionId: string) {
  try {
    sessionStorage.setItem(collabOptOutStorageKey(fileVersionId), "1");
  } catch {
    /* private mode */
  }
}

function clearViewerCollabOptOut(fileVersionId: string) {
  try {
    sessionStorage.removeItem(collabOptOutStorageKey(fileVersionId));
  } catch {
    /* */
  }
}

export function ViewerCollabSync({
  fileVersionId,
  enabled,
  cloudHydrated,
  numPages,
  currentUserId,
  children,
}: {
  fileVersionId: string | null;
  enabled: boolean;
  cloudHydrated: boolean;
  numPages: number;
  currentUserId: string | undefined;
  children: React.ReactNode;
}) {
  const desktop = useViewerCollabDesktop();
  const queryClient = useQueryClient();
  const [presenceMembers, setPresenceMembers] = useState<ViewerCollabPresenceMember[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<ViewerRemoteCursor[]>([]);
  const [remoteSelections, setRemoteSelections] = useState<ViewerRemoteSelection[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"live" | "reconnecting" | "offline">(
    "offline",
  );

  const connectionIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastPointerSendRef = useRef(0);
  const pendingPointerRef = useRef<{ pageIndex: number; x: number; y: number } | null>(null);
  /** Browser timer ids (number); avoid NodeJS.Timeout from merged typings. */
  const debounceFetchRef = useRef<number | null>(null);
  const cursorFadeTimersRef = useRef<Map<string, number>>(new Map());
  const selectionFadeTimersRef = useRef<Map<string, number>>(new Map());
  const remoteCursorsRef = useRef<ViewerRemoteCursor[]>([]);
  const remoteSelectionsRef = useRef<ViewerRemoteSelection[]>([]);
  const localSelectionRef = useRef<string[]>([]);
  const lastSentSelectionKeyRef = useRef<string>("");
  const [sseReconnectNonce, setSseReconnectNonce] = useState(0);
  /** Bump when the tab becomes visible again so SSE/WS reconnect after teardown on hide. */
  const [transportEpoch, setTransportEpoch] = useState(0);
  const [userParticipating, setUserParticipating] = useState(true);
  const userParticipatingRef = useRef(true);
  useEffect(() => {
    userParticipatingRef.current = userParticipating;
  }, [userParticipating]);
  const [sessionHostUserId, setSessionHostUserId] = useState<string | null>(null);

  const collabFeatureEnabled = Boolean(enabled);
  const collabTransportReady = Boolean(
    desktop && enabled && fileVersionId && cloudHydrated && userParticipating,
  );
  const collabActive = collabTransportReady;

  const selectedAnnotationIds = useViewerStore((s) => s.selectedAnnotationIds);
  useEffect(() => {
    localSelectionRef.current = selectedAnnotationIds;
  }, [selectedAnnotationIds]);

  const fileVersionIdRef = useRef<string | null>(null);
  useEffect(() => {
    fileVersionIdRef.current = fileVersionId;
  }, [fileVersionId]);

  /** Tab close / hard navigation: keepalive leave + close sockets so the room frees immediately. */
  useEffect(() => {
    if (!enabled || !cloudHydrated || !fileVersionId) return;

    const onPageHide = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      const fv = fileVersionIdRef.current;
      if (fv) markViewerCollabOptOut(fv);
      const cid = connectionIdRef.current;
      if (fv && cid) postViewerCollabLeaveKeepalive(fv, cid);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [enabled, cloudHydrated, fileVersionId]);

  useEffect(() => {
    remoteCursorsRef.current = remoteCursors;
  }, [remoteCursors]);

  useEffect(() => {
    remoteSelectionsRef.current = remoteSelections;
  }, [remoteSelections]);

  useEffect(() => {
    setSessionHostUserId(null);
    setRemoteCursors([]);
    setRemoteSelections([]);
    if (!fileVersionId) {
      setUserParticipating(true);
      return;
    }
    try {
      setUserParticipating(sessionStorage.getItem(collabOptOutStorageKey(fileVersionId)) !== "1");
    } catch {
      setUserParticipating(true);
    }
  }, [fileVersionId]);

  const leaveCollab = useCallback(() => {
    if (fileVersionId) markViewerCollabOptOut(fileVersionId);
    setUserParticipating(false);
    setRemoteCursors([]);
    setRemoteSelections([]);
    setPresenceMembers([]);
    setSessionHostUserId(null);
  }, [fileVersionId]);

  const rejoinCollab = useCallback(() => {
    if (fileVersionId) clearViewerCollabOptOut(fileVersionId);
    setUserParticipating(true);
    setTransportEpoch((e) => e + 1);
  }, [fileVersionId]);

  const endSessionForAll = useCallback(async () => {
    if (!fileVersionId) return;
    await postViewerCollabEndSession(fileVersionId);
  }, [fileVersionId]);

  const reportPointer = useCallback(
    (pageIndex: number, x: number, y: number) => {
      if (!collabActive) return;
      pendingPointerRef.current = { pageIndex, x, y };
    },
    [collabActive],
  );

  const applyRemoteViewerState = useCallback(
    async (revision: number, actorUserId: string) => {
      if (!fileVersionId) return;
      if (actorUserId === currentUserId) {
        setViewerCollabRevision(revision);
        return;
      }
      const known = getViewerCollabRevision();
      if (known >= 0 && revision <= known) return;
      if (debounceFetchRef.current) window.clearTimeout(debounceFetchRef.current);
      debounceFetchRef.current = window.setTimeout(async () => {
        try {
          const { viewerState: raw, revision: rev } = await fetchViewerState(fileVersionId);
          setViewerCollabRevision(rev);
          const parsed = parseServerViewerState(raw);
          if (!parsed) return;
          const localAnn = useViewerStore.getState().annotations;
          const patch = buildMergePatchFromRemote(parsed, localAnn, numPages);
          const st0 = useViewerStore.getState();
          const pageForClamp = patch.currentPage ?? st0.currentPage;
          patch.scale = clampViewerScaleWithPageDims(
            patch.scale ?? 1,
            st0.pageSizePtByPage,
            pageForClamp,
          );
          useViewerStore.setState({
            ...patch,
            historyPast: [],
            historyFuture: [],
            selectedAnnotationIds: [],
          });
        } catch {
          /* ignore */
        }
      }, 1200);
    },
    [fileVersionId, currentUserId, numPages],
  );

  /**
   * Leaving the tab (hide) or closing ends *this user's* live participation until they rejoin.
   * Listener stays mounted whenever collab could apply — not gated on `collabActive` — so we still
   * catch tab switches after opting out.
   */
  useEffect(() => {
    if (!desktop || !enabled || !cloudHydrated || !fileVersionId) return;
    const fv = fileVersionId;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        markViewerCollabOptOut(fv);
        setUserParticipating(false);
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        connectionIdRef.current = null;
        setConnectionStatus("offline");
      } else if (userParticipatingRef.current) {
        setTransportEpoch((e) => e + 1);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [desktop, enabled, cloudHydrated, fileVersionId]);

  useEffect(() => {
    if (!collabActive || !fileVersionId) {
      setConnectionStatus("offline");
      setPresenceMembers([]);
      connectionIdRef.current = null;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const streamUrl = apiUrl(
      `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-collab/events`,
    );
    const es = new EventSource(streamUrl, { withCredentials: true });
    esRef.current = es;
    setConnectionStatus("reconnecting");

    es.onopen = () => setConnectionStatus("live");

    es.onmessage = (ev) => {
      let p: SsePayload;
      try {
        p = JSON.parse(ev.data) as SsePayload;
      } catch {
        return;
      }
      if (p.type === "hello") {
        connectionIdRef.current = p.connectionId;
        if (p.sessionHostUserId !== undefined) setSessionHostUserId(p.sessionHostUserId ?? null);
      } else if (p.type === "presence") {
        setPresenceMembers(p.members ?? []);
        if (p.sessionHostUserId !== undefined) setSessionHostUserId(p.sessionHostUserId ?? null);
      } else if (p.type === "session_ended") {
        markViewerCollabOptOut(fileVersionId);
        toast.message("Live session ended", {
          description:
            "The host ended collaboration on this sheet. You can rejoin from the Live tab.",
        });
        setUserParticipating(false);
        setRemoteCursors([]);
        setRemoteSelections([]);
        setPresenceMembers([]);
        setSessionHostUserId(null);
      } else if (p.type === "viewer_state") void applyRemoteViewerState(p.revision, p.actorUserId);
      else if (p.type === "issues_changed") {
        void queryClient.invalidateQueries({
          queryKey: qk.issuesForFileVersion(fileVersionId),
        });
      }
    };

    es.onerror = () => {
      setConnectionStatus("reconnecting");
      es.close();
      esRef.current = null;
      window.setTimeout(() => setSseReconnectNonce((n) => n + 1), 2000);
    };

    const hb = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const id = connectionIdRef.current;
      if (!id || !fileVersionId) return;
      void postViewerCollabHeartbeat(fileVersionId, id).catch(() => {});
    }, 25_000);

    return () => {
      window.clearInterval(hb);
      const cid = connectionIdRef.current;
      if (fileVersionId && cid) {
        postViewerCollabLeaveKeepalive(fileVersionId, cid);
      }
      es.close();
      esRef.current = null;
    };
  }, [
    collabActive,
    fileVersionId,
    applyRemoteViewerState,
    queryClient,
    sseReconnectNonce,
    transportEpoch,
  ]);

  useEffect(() => {
    if (!collabActive || !fileVersionId) return;

    const clearCursorFadeTimers = () => {
      for (const t of cursorFadeTimersRef.current.values()) window.clearTimeout(t);
      cursorFadeTimersRef.current.clear();
    };

    const clearSelectionFadeTimers = () => {
      for (const t of selectionFadeTimersRef.current.values()) window.clearTimeout(t);
      selectionFadeTimersRef.current.clear();
    };

    const armCursorFade = (uid: string) => {
      const prevT = cursorFadeTimersRef.current.get(uid);
      if (prevT) window.clearTimeout(prevT);
      const t = window.setTimeout(() => {
        cursorFadeTimersRef.current.delete(uid);
        setRemoteCursors((prev) => prev.filter((c) => c.userId !== uid));
      }, REMOTE_CURSOR_LINGER_MS);
      cursorFadeTimersRef.current.set(uid, t);
    };

    const armSelectionFade = (uid: string) => {
      const prevT = selectionFadeTimersRef.current.get(uid);
      if (prevT) window.clearTimeout(prevT);
      const t = window.setTimeout(() => {
        selectionFadeTimersRef.current.delete(uid);
        setRemoteSelections((prev) => prev.filter((r) => r.userId !== uid));
      }, REMOTE_SELECTION_LINGER_MS);
      selectionFadeTimersRef.current.set(uid, t);
    };

    const wsUrl = wsApiUrl(
      `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-collab/ws`,
    );
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    let sendTickCount = 0;
    ws.onopen = () => {
      clearCursorFadeTimers();
      clearSelectionFadeTimers();
      for (const c of remoteCursorsRef.current) armCursorFade(c.userId);
      for (const r of remoteSelectionsRef.current) armSelectionFade(r.userId);
      lastSentSelectionKeyRef.current = "";
      sendTickCount = 0;
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      let j: {
        type?: string;
        userId?: string;
        pageIndex?: number;
        x?: number;
        y?: number;
        annotationIds?: unknown;
      };
      try {
        j = JSON.parse(ev.data) as typeof j;
      } catch {
        return;
      }
      if (typeof j.userId !== "string" || j.userId === currentUserId) return;

      if (j.type === "cursor") {
        if (typeof j.pageIndex !== "number" || typeof j.x !== "number" || typeof j.y !== "number")
          return;
        setRemoteCursors((prev) => {
          const next = prev.filter((c) => c.userId !== j.userId);
          next.push({
            userId: j.userId!,
            pageIndex: j.pageIndex!,
            x: j.x!,
            y: j.y!,
          });
          return next;
        });
        armCursorFade(j.userId);
      } else if (j.type === "selection") {
        const raw = j.annotationIds;
        const annotationIds = Array.isArray(raw)
          ? raw.filter((x): x is string => typeof x === "string")
          : [];
        setRemoteSelections((prev) => {
          const next = prev.filter((r) => r.userId !== j.userId);
          if (annotationIds.length > 0) {
            next.push({ userId: j.userId!, annotationIds });
          }
          return next;
        });
        armSelectionFade(j.userId);
      }
    };

    const sendTick = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      sendTickCount += 1;
      if (sendTickCount % 3 === 0) {
        const sel = localSelectionRef.current;
        const selKey = sel.length ? [...sel].sort().join("\0") : "";
        if (selKey !== lastSentSelectionKeyRef.current) {
          lastSentSelectionKeyRef.current = selKey;
          try {
            ws.send(JSON.stringify({ type: "selection", annotationIds: sel }));
          } catch {
            /* */
          }
        }
      }
      const pending = pendingPointerRef.current;
      if (!pending) return;
      const now = Date.now();
      const minGap =
        document.visibilityState === "hidden"
          ? POINTER_SEND_MIN_MS_HIDDEN
          : POINTER_SEND_MIN_MS_VISIBLE;
      if (now - lastPointerSendRef.current < minGap) return;
      lastPointerSendRef.current = now;
      ws.send(
        JSON.stringify({
          type: "cursor",
          pageIndex: pending.pageIndex,
          x: pending.x,
          y: pending.y,
        }),
      );
    }, 100);

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      window.clearInterval(sendTick);
      clearCursorFadeTimers();
      clearSelectionFadeTimers();
      ws.close();
      wsRef.current = null;
    };
  }, [collabActive, fileVersionId, currentUserId, transportEpoch]);

  const ctx = useMemo(
    () => ({
      reportPointer,
      remoteCursors,
      remoteSelections,
      presenceMembers,
      connectionStatus,
      collabFeatureEnabled,
      collabActive,
      sessionHostUserId,
      leaveCollab,
      rejoinCollab,
      endSessionForAll,
    }),
    [
      reportPointer,
      remoteCursors,
      remoteSelections,
      presenceMembers,
      connectionStatus,
      collabFeatureEnabled,
      collabActive,
      sessionHostUserId,
      leaveCollab,
      rejoinCollab,
      endSessionForAll,
    ],
  );

  return <ViewerCollabProvider value={ctx}>{children}</ViewerCollabProvider>;
}
