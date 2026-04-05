"use client";

import { createContext, useContext } from "react";

export type ViewerCollabPresenceMember = { userId: string; pageIndex?: number };

export type ViewerRemoteCursor = {
  userId: string;
  pageIndex: number;
  x: number;
  y: number;
};

export type ViewerRemoteSelection = {
  userId: string;
  annotationIds: string[];
};

type Ctx = {
  reportPointer: (pageIndex: number, x: number, y: number) => void;
  remoteCursors: ViewerRemoteCursor[];
  /** Other users’ selected markup / measure ids (outline only; does not change local selection). */
  remoteSelections: ViewerRemoteSelection[];
  presenceMembers: ViewerCollabPresenceMember[];
  connectionStatus: "live" | "reconnecting" | "offline";
  /** Pro + workspace flag: collaboration feature is available for this sheet. */
  collabFeatureEnabled: boolean;
  /** Desktop, hydrated, participating, and transports active. */
  collabActive: boolean;
  sessionHostUserId: string | null;
  leaveCollab: () => void;
  rejoinCollab: () => void;
  endSessionForAll: () => Promise<void>;
};

const ViewerCollabContext = createContext<Ctx | null>(null);

export function ViewerCollabProvider({
  value,
  children,
}: {
  value: Ctx;
  children: React.ReactNode;
}) {
  return <ViewerCollabContext.Provider value={value}>{children}</ViewerCollabContext.Provider>;
}

export function useViewerCollab(): Ctx | null {
  return useContext(ViewerCollabContext);
}

const COLLAB_COLORS = [
  "#f472b6",
  "#a78bfa",
  "#38bdf8",
  "#4ade80",
  "#fbbf24",
  "#fb7185",
  "#2dd4bf",
  "#c084fc",
];

export function collabColorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLLAB_COLORS[h % COLLAB_COLORS.length]!;
}

/** Vertical nudge (px) for collaborator labels when cursors cluster. */
export function collabCursorLabelNudgeY(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return (h % 6) * 4 - 10;
}
