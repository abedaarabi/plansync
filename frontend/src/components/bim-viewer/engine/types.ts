import type { BimFederationMember } from "@/lib/bim/federation";
import type { BimQualityState } from "@/lib/bim/renderQuality";

export type BimTool = "select" | "clip" | "length" | "area" | "angle" | "markup";
export type BimCameraMode = "orbit" | "walk";

export type BimSelection = {
  modelId: string;
  fileVersionId: string | null;
  sourceLabel: string | null;
  localId: number;
  ifcGuid: string | null;
  name: string | null;
  ifcType: string | null;
  storey: string | null;
  position: { x: number; y: number; z: number } | null;
  attributes: { label: string; value: string }[];
  psets: { name: string; props: { label: string; value: string }[] }[];
  /** True while property sets are still loading in the background. */
  detailsPending?: boolean;
  /** Multi-select: all selected elements. */
  items?: {
    modelId: string;
    localId: number;
    ifcGuid: string | null;
    name?: string | null;
    ifcType?: string | null;
  }[];
  count?: number;
};

export type BimVisibilityGroup = { name: string; visible: boolean };

export type BimLoadedModel = BimFederationMember & {
  modelId: string;
  visible: boolean;
};

export type BimEngineEvents = {
  onSelection: (sel: BimSelection | null) => void;
  onGroupsChanged: (groups: {
    storeys: BimVisibilityGroup[];
    categories: BimVisibilityGroup[];
  }) => void;
  /** Cursor position in model space (metres), when available. */
  onCursorPosition?: (pos: { x: number; y: number; z: number } | null) => void;
  onMultiSelection?: (guids: string[]) => void;
  onContextMenu?: (pos: { x: number; y: number; hasSelection: boolean }) => void;
  onToolChange?: (tool: BimTool) => void;
  onQualityChanged?: (state: BimQualityState) => void;
  /** Ctrl/Cmd+L — host should copy the current view URL. */
  onCopyViewLink?: () => void;
};
