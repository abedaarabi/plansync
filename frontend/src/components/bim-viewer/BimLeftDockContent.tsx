"use client";

import type { BimLoqReport, BimQuantityIndex } from "@/lib/bim/types";
import type { BimViewportAppearance } from "@/lib/bim/viewportAppearance";
import type { BimVisibilityGroup, BimLoadedModel } from "./bimEngine";
import type { BimFederationMember } from "@/lib/bim/federation";
import type { CloudFile } from "@/types/projects";
import { BimElementCatalog } from "./BimElementCatalog";
import { BimFederationPanel } from "./BimFederationPanel";
import { BimModelTreePanel } from "./BimModelTreePanel";
import { BimModelQualityPanel } from "./BimModelQualityPanel";

export type BimLeftDockId = "objects" | "models" | "visibility" | "quality";

// fallow-ignore-next-line complexity
export function BimLeftDockContent(props: {
  dock: BimLeftDockId;
  storeys: BimVisibilityGroup[];
  categories: BimVisibilityGroup[];
  onToggleGroup: (kind: "storey" | "category", name: string, visible: boolean) => void;
  onShowAll: () => void;
  quantityIndex: BimQuantityIndex | null;
  quantityIndexError?: string | null;
  conversionStatus?: string;
  selectedGuids: Set<string>;
  onSelectGuids: (guids: string[], additive: boolean) => void;
  onSelectType: (ifcType: string, additive: boolean) => void;
  loq: BimLoqReport | null;
  onRebuildIndex?: () => void;
  appearance: BimViewportAppearance;
  onAppearanceChange: (patch: Partial<BimViewportAppearance>) => void;
  projectId: string | null;
  anchorFileId: string;
  federationMembers: BimFederationMember[];
  loadedModels: BimLoadedModel[];
  addingFileVersionId?: string | null;
  onAddFederationMember: (file: CloudFile, fileVersionId: string, version: number) => void;
  onRemoveFederationMember: (fileVersionId: string) => void;
  onToggleModelVisible: (modelId: string, visible: boolean) => void;
}) {
  if (props.dock === "quality") {
    return (
      <BimModelQualityPanel
        loq={props.loq}
        quantityIndex={props.quantityIndex}
        conversionStatus={props.conversionStatus ?? "pending"}
        appearance={props.appearance}
        onAppearanceChange={props.onAppearanceChange}
        onRebuildIndex={props.onRebuildIndex}
      />
    );
  }

  if (props.dock === "models") {
    return (
      <BimFederationPanel
        projectId={props.projectId ?? null}
        anchorFileId={props.anchorFileId}
        members={props.federationMembers}
        loadedModels={props.loadedModels}
        addingFileVersionId={props.addingFileVersionId}
        onAddMember={props.onAddFederationMember}
        onRemoveMember={props.onRemoveFederationMember}
        onToggleVisible={props.onToggleModelVisible}
      />
    );
  }

  if (props.dock === "visibility") {
    return (
      <BimModelTreePanel
        embedded
        storeys={props.storeys}
        categories={props.categories}
        onToggle={props.onToggleGroup}
        onShowAll={props.onShowAll}
      />
    );
  }

  return (
    <BimElementCatalog
      index={props.quantityIndex}
      conversionStatus={props.conversionStatus}
      errorMessage={props.quantityIndexError}
      selectedGuids={props.selectedGuids}
      onSelectGuids={props.onSelectGuids}
      onSelectType={props.onSelectType}
    />
  );
}
