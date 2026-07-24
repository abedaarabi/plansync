import { create } from "zustand";
import { nanoid } from "nanoid";
import type { AnnotationType, MarkupShape } from "@/store/viewerStore";
import { DEFAULT_MARKUP_STROKE_COLOR } from "@/lib/markupUi";

export type BimMarkupMode = "draw" | "select";

export interface BimAnnotation {
  id: string;
  type: AnnotationType;
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
  text?: string;
  arrowHead?: boolean;
  worldPoints?: { x: number; y: number; z: number }[];
  cameraJson: Record<string, unknown>;
  createdAt: number;
  author?: string;
  linkedIssueId?: string;
  linkedIssueAttachment?: boolean;
  linkedIssueTitle?: string;
  issueStatus?: string;
  snapshotDataUrl?: string;
}

// fallow-ignore-next-line complexity
export function markupShapeToType(shape: MarkupShape): AnnotationType {
  switch (shape) {
    case "freehand":
      return "polyline";
    case "highlight":
      return "highlight";
    case "line":
    case "arrow":
      return "line";
    case "rect":
      return "rect";
    case "ellipse":
      return "ellipse";
    case "cross":
      return "cross";
    case "diamond":
      return "diamond";
    case "polygon":
      return "polygon";
    case "cloud":
      return "cloud";
    case "text":
      return "text";
    default:
      return "line";
  }
}

type BimMarkupState = {
  annotations: BimAnnotation[];
  selectedIds: string[];
  markupShape: MarkupShape;
  markupMode: BimMarkupMode;
  strokeColor: string;
  strokeWidth: number;
  cloudFileVersionId: string | null;
  cloudRevision: number;
  viewerStateHydrated: boolean;
  /** Last server blob fields (PDF annotations, takeoff, etc.) preserved on PUT merge. */
  serverBlobMerge: Record<string, unknown> | null;
  setCloudContext: (
    fileVersionId: string | null,
    revision: number,
    merge: Record<string, unknown> | null,
  ) => void;
  setViewerStateHydrated: (v: boolean) => void;
  setAnnotations: (annotations: BimAnnotation[]) => void;
  addAnnotation: (a: Omit<BimAnnotation, "id" | "createdAt"> & { id?: string }) => string;
  updateAnnotation: (id: string, patch: Partial<BimAnnotation>) => void;
  removeAnnotation: (id: string) => void;
  removeAnnotations: (ids: string[]) => void;
  clearAnnotations: () => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  setMarkupShape: (shape: MarkupShape) => void;
  setMarkupMode: (mode: BimMarkupMode) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  linkMarkupsToIssue: (
    markupIds: string[],
    issue: { id: string; title: string; status: string },
  ) => void;
};

export const useBimMarkupStore = create<BimMarkupState>((set, get) => ({
  annotations: [],
  selectedIds: [],
  markupShape: "freehand",
  markupMode: "draw",
  strokeColor: DEFAULT_MARKUP_STROKE_COLOR,
  strokeWidth: 3,
  cloudFileVersionId: null,
  cloudRevision: 0,
  viewerStateHydrated: false,
  serverBlobMerge: null,

  setCloudContext: (fileVersionId, revision, merge) =>
    set({ cloudFileVersionId: fileVersionId, cloudRevision: revision, serverBlobMerge: merge }),

  setViewerStateHydrated: (viewerStateHydrated) => set({ viewerStateHydrated }),

  setAnnotations: (annotations) => set({ annotations }),

  addAnnotation: (a) => {
    const id = a.id ?? nanoid();
    const { id: _ignored, ...rest } = a;
    set((state) => ({
      annotations: [
        ...state.annotations,
        {
          ...rest,
          id,
          createdAt: Date.now(),
        },
      ],
    }));
    return id;
  },

  updateAnnotation: (id, patch) =>
    set((state) => ({
      annotations: state.annotations.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((x) => x.id !== id),
      selectedIds: state.selectedIds.filter((x) => x !== id),
    })),

  removeAnnotations: (ids) => {
    const drop = new Set(ids);
    set((state) => ({
      annotations: state.annotations.filter((x) => !drop.has(x.id)),
      selectedIds: state.selectedIds.filter((x) => !drop.has(x)),
    }));
  },

  clearAnnotations: () => set({ annotations: [], selectedIds: [] }),

  setSelectedIds: (selectedIds) => set({ selectedIds }),

  toggleSelectedId: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),

  setMarkupShape: (markupShape) => set({ markupShape, markupMode: "draw" }),

  setMarkupMode: (markupMode) => set({ markupMode }),

  setStrokeColor: (strokeColor) => set({ strokeColor }),

  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

  linkMarkupsToIssue: (markupIds, issue) => {
    const ids = new Set(markupIds);
    set((state) => ({
      annotations: state.annotations.map((a) =>
        ids.has(a.id)
          ? {
              ...a,
              linkedIssueId: issue.id,
              linkedIssueAttachment: true,
              linkedIssueTitle: issue.title,
              issueStatus: issue.status,
            }
          : a,
      ),
    }));
  },
}));
