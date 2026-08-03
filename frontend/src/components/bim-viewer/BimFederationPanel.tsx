"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { BimFederationMember } from "@/lib/bim/federation";
import type { CloudFile } from "@/types/projects";
import type { BimLoadedModel } from "./bimEngine";
import { BimFederationFilePicker } from "./BimFederationFilePicker";

export function BimFederationPanel(props: {
  projectId: string | null;
  anchorFileId: string;
  members: BimFederationMember[];
  loadedModels: BimLoadedModel[];
  addingFileVersionId?: string | null;
  onAddMember: (file: CloudFile, fileVersionId: string, version: number) => void;
  onRemoveMember: (fileVersionId: string) => void;
  onToggleVisible: (modelId: string, visible: boolean) => void;
}) {
  const loadedFileVersionIds = useMemo(
    () => new Set(props.members.map((m) => m.fileVersionId)),
    [props.members],
  );

  // fallow-ignore-next-line complexity
  const loadedRows = props.loadedModels.map((m) => (
    <div key={m.modelId} className="bim-detail-card mb-2 flex items-center gap-2 px-3 py-2.5">
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={m.visible}
          onChange={(e) => props.onToggleVisible(m.modelId, e.target.checked)}
          className="mt-0.5 rounded border-[var(--bim-border)]"
          disabled={props.addingFileVersionId != null}
        />
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-[var(--bim-text)]">
            {m.name}
          </span>
          <span className="block truncate text-[10px] text-[var(--bim-text-muted)]">
            v{m.version ?? "—"}
          </span>
        </span>
      </label>
      {props.members.length > 1 && m.fileVersionId !== props.members[0]?.fileVersionId ? (
        <button
          type="button"
          onClick={() => props.onRemoveMember(m.fileVersionId)}
          disabled={props.addingFileVersionId != null}
          className="bim-focus-ring shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)] hover:text-[var(--bim-text)] disabled:opacity-50"
        >
          Remove
        </button>
      ) : null}
    </div>
  ));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--bim-border)] px-4 py-3">
        <p className="text-[12px] font-medium text-[var(--bim-text)]">Federated models</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
          Add IFC files from your project folders. Browsing starts in the same folder as the model
          you opened.
        </p>
      </div>

      {props.projectId ? (
        <BimFederationFilePicker
          projectId={props.projectId}
          anchorFileId={props.anchorFileId}
          loadedFileVersionIds={loadedFileVersionIds}
          addingFileVersionId={props.addingFileVersionId}
          onPickFile={props.onAddMember}
        />
      ) : (
        <p className="px-4 py-3 text-[11px] text-[var(--bim-text-muted)]">
          Open this viewer from a project file to browse folders and add models.
        </p>
      )}

      <div className="bim-dock-scroll px-2 py-2">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-text-subtle)]">
          Loaded in view
        </p>
        {loadedRows}
        {props.addingFileVersionId ? (
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-[var(--bim-text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading model…
          </div>
        ) : null}
      </div>
    </div>
  );
}
