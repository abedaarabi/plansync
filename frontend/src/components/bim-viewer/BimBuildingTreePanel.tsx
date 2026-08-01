"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen, Layers, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { IfcFileIcon } from "@/components/icons/IfcFileIcon";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import type { BuildingAsset, BuildingLevel } from "@/lib/api-client/locations";
import {
  useBuildingAssetsQuery,
  useBuildingLevelsQuery,
  useCreateBuildingLevelMutation,
  useUpdateBuildingLevelMutation,
} from "@/lib/locations/useBuildingQueries";
import { hasProcessingAssets } from "@/lib/locations/buildingQueryUtils";
import { levelHealthLabel } from "@/lib/locations/buildingPublish";
import { LevelDisplayToggle } from "./LevelDisplayToggle";

type Props = {
  projectId: string;
  locationId: string;
  buildingId: string;
  activeLevelId: string | null;
  onSelectLevel: (level: BuildingLevel) => void;
  onShowModel: () => void;
  onMatchDrawing: (levelId: string, assetId: string) => void;
};

function formatElevation(e: number | null): string {
  if (e == null) return "";
  const sign = e >= 0 ? "+" : "";
  return `${sign}${e.toFixed(2)} m`;
}

function nextManualLevelName(levels: BuildingLevel[]): string {
  return `Level ${String(levels.length + 1).padStart(2, "0")}`;
}

// fallow-ignore-next-line complexity
export function BimBuildingTreePanel({
  locationId,
  buildingId,
  activeLevelId,
  onSelectLevel,
  onShowModel,
  onMatchDrawing,
}: Props) {
  const [drawingsOpen, setDrawingsOpen] = useState(true);
  const [modelOpen, setModelOpen] = useState(true);
  const [dropLevelId, setDropLevelId] = useState<string | null>(null);
  const [draggingAsset, setDraggingAsset] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const renameCancelledRef = useRef(false);

  const { data: assetsData, isLoading: assetsLoading } = useBuildingAssetsQuery(buildingId, {
    typeFilter: "ALL",
    disciplineFilter: "ALL",
  });
  const assets = useMemo(() => assetsData?.assets ?? [], [assetsData]);
  const unmappedIds = useMemo(
    () => new Set((assetsData?.unmapped ?? []).map((a) => a.id)),
    [assetsData?.unmapped],
  );
  const pdfAssets = useMemo(() => assets.filter((a) => a.type === "PDF"), [assets]);
  const unmappedCount = unmappedIds.size;
  const ifcAssets = useMemo(() => assets.filter((a) => a.type === "IFC"), [assets]);
  const pollLevels = hasProcessingAssets(assets) || ifcAssets.length > 0;
  const {
    data: levels = [],
    isLoading: levelsLoading,
    isError: levelsError,
    isFetching: levelsFetching,
  } = useBuildingLevelsQuery(buildingId, pollLevels);

  const createLevel = useCreateBuildingLevelMutation(buildingId, locationId);
  const updateLevel = useUpdateBuildingLevelMutation(buildingId, locationId);

  const startRename = (level: BuildingLevel) => {
    renameCancelledRef.current = false;
    setEditingLevelId(level.id);
    setDraftName(level.name);
  };

  const commitRename = () => {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }
    if (!editingLevelId) return;
    const name = draftName.trim();
    const levelId = editingLevelId;
    setEditingLevelId(null);
    if (!name) return;
    const current = levels.find((l) => l.id === levelId);
    if (current && current.name === name) return;
    updateLevel.mutate(
      { levelId, name },
      { onError: (e: Error) => toast.error(e.message || "Could not rename level") },
    );
  };

  const cancelRename = () => {
    renameCancelledRef.current = true;
    setEditingLevelId(null);
  };

  const addManualLevel = () => {
    setModelOpen(true);
    createLevel.mutate(nextManualLevelName(levels), {
      onSuccess: (level) => startRename(level),
      onError: (e: Error) => toast.error(e.message || "Could not add level"),
    });
  };

  const levelsBusy = levelsLoading || (levelsFetching && levels.length === 0 && !levelsError);
  const modelName = ifcAssets[0]?.fileName ?? "3D model";

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col bg-[var(--enterprise-bg)] text-[var(--enterprise-text)]">
      <header className="shrink-0 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3">
        <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Building</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-[var(--enterprise-text)]">
          {modelName.replace(/\.ifc$/i, "")}
        </p>
      </header>

      <div className="enterprise-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* Drawings folder */}
        <div className="mb-1">
          <TreeFolderRow
            open={drawingsOpen}
            onToggle={() => setDrawingsOpen((v) => !v)}
            icon={
              drawingsOpen ? (
                <FolderOpen className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              ) : (
                <Folder className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
              )
            }
            label="Drawings"
            meta={
              assetsLoading ? "…" : `${pdfAssets.length} PDF${pdfAssets.length === 1 ? "" : "s"}`
            }
            badge={
              unmappedCount > 0 ? (
                <span className="enterprise-badge-warning inline-flex min-w-5 items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {unmappedCount}
                </span>
              ) : null
            }
          />

          {drawingsOpen ? (
            <div className="ml-3 border-l border-[var(--enterprise-border)] pl-1">
              {assetsLoading ? (
                <StatusRow
                  icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  label="Loading drawings…"
                />
              ) : pdfAssets.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-[var(--enterprise-text-muted)]">
                  No PDF drawings yet.
                </p>
              ) : (
                <>
                  {unmappedCount > 0 ? (
                    <p className="px-2 pb-1 pt-0.5 text-[10px] leading-snug text-[var(--enterprise-text-muted)]">
                      Drag an unmapped drawing onto a level below.
                    </p>
                  ) : null}
                  <ul className="space-y-0.5 pb-1">
                    {pdfAssets.map((asset) => {
                      const isUnmapped = unmappedIds.has(asset.id);
                      return (
                        <li
                          key={asset.id}
                          draggable={isUnmapped}
                          onDragStart={
                            isUnmapped
                              ? (e) => {
                                  e.dataTransfer.setData("text/plain", asset.id);
                                  e.dataTransfer.effectAllowed = "move";
                                  setDraggingAsset(true);
                                  setModelOpen(true);
                                }
                              : undefined
                          }
                          onDragEnd={
                            isUnmapped
                              ? () => {
                                  setDraggingAsset(false);
                                  setDropLevelId(null);
                                }
                              : undefined
                          }
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ${
                            isUnmapped
                              ? "cursor-grab hover:bg-[var(--enterprise-hover-surface)] active:cursor-grabbing"
                              : "opacity-80"
                          }`}
                          title={
                            isUnmapped ? "Drag onto a level to match" : "Already matched to a level"
                          }
                        >
                          <PdfFileIcon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate font-medium text-[var(--enterprise-text)]">
                            {asset.fileName}
                          </span>
                          {isUnmapped ? (
                            <span className="shrink-0 rounded bg-[var(--enterprise-semantic-warning-bg)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[var(--enterprise-semantic-warning-text)]">
                              Unmapped
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-[var(--enterprise-text-muted)]">
                              Matched
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* IFC model + levels */}
        <div>
          <div
            className={`flex items-center gap-0.5 rounded-lg transition ${
              activeLevelId == null
                ? "bg-[var(--enterprise-primary-soft)] ring-1 ring-[var(--enterprise-primary)]/20"
                : "hover:bg-[var(--enterprise-surface)]"
            }`}
          >
            <button
              type="button"
              className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
              aria-label={modelOpen ? "Collapse model levels" : "Expand model levels"}
              aria-expanded={modelOpen}
              onClick={() => setModelOpen((v) => !v)}
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${modelOpen ? "rotate-90" : ""}`}
                aria-hidden
              />
            </button>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left"
              onClick={() => {
                onShowModel();
              }}
              onDoubleClick={() => setModelOpen((v) => !v)}
            >
              <IfcFileIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--enterprise-text)]">
                  {modelName}
                </span>
                <span className="block truncate text-[10px] text-[var(--enterprise-text-muted)]">
                  {levels.length} level{levels.length === 1 ? "" : "s"}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="mr-1 inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-semibold text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)] disabled:opacity-50"
              onClick={addManualLevel}
              disabled={createLevel.isPending}
              title="Add level"
              aria-label="Add level"
            >
              {createLevel.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </div>

          {modelOpen ? (
            <div className="ml-3 border-l border-[var(--enterprise-border)] pl-1">
              {levelsBusy ? (
                <StatusRow
                  icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  label="Extracting levels…"
                />
              ) : levelsError ? (
                <p className="px-2 py-2 text-xs text-[var(--enterprise-semantic-danger-text)]">
                  Could not load levels. Refresh to try again.
                </p>
              ) : levels.length === 0 ? (
                <button
                  type="button"
                  className="mx-1 my-1 flex w-[calc(100%-0.5rem)] flex-col items-center gap-1 rounded-lg border border-dashed border-[var(--enterprise-border)] px-3 py-4 text-center transition hover:border-[var(--enterprise-primary)]/40 hover:bg-[var(--enterprise-primary-soft)]"
                  onClick={addManualLevel}
                  disabled={createLevel.isPending}
                >
                  <Plus className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
                  <span className="text-xs font-semibold text-[var(--enterprise-primary)]">
                    Add level manually
                  </span>
                </button>
              ) : (
                <ul className="space-y-0.5 py-0.5">
                  {levels.map(
                    // fallow-ignore-next-line complexity
                    (level) => {
                      const active = level.id === activeLevelId;
                      const isDrop = dropLevelId === level.id;
                      const editing = editingLevelId === level.id;
                      return (
                        <li key={level.id}>
                          <div
                            className={`rounded-lg px-2 py-1.5 transition ${
                              isDrop
                                ? "bg-[var(--enterprise-primary-soft)] ring-2 ring-[var(--enterprise-primary)]"
                                : active
                                  ? "bg-[var(--enterprise-surface)] ring-1 ring-[var(--enterprise-primary)]/25"
                                  : "hover:bg-[var(--enterprise-surface)]"
                            } ${draggingAsset && !isDrop ? "ring-1 ring-dashed ring-[var(--enterprise-border)]" : ""}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDropLevelId(level.id);
                            }}
                            onDragLeave={() =>
                              setDropLevelId((id) => (id === level.id ? null : id))
                            }
                            onDrop={(e) => {
                              e.preventDefault();
                              setDropLevelId(null);
                              setDraggingAsset(false);
                              const assetId = e.dataTransfer.getData("text/plain");
                              if (assetId) onMatchDrawing(level.id, assetId);
                            }}
                          >
                            {editing ? (
                              <LevelNameInput
                                value={draftName}
                                onChange={setDraftName}
                                onCommit={commitRename}
                                onCancel={cancelRename}
                              />
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    onClick={() => onSelectLevel(level)}
                                  >
                                    <Layers
                                      className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[var(--enterprise-primary)]" : "text-[var(--enterprise-text-muted)]"}`}
                                      aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[13px] font-medium text-[var(--enterprise-text)]">
                                        {level.name}
                                      </span>
                                      <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                        {level.elevation != null ? (
                                          <span className="tabular-nums text-[var(--enterprise-text-muted)]">
                                            {formatElevation(level.elevation)}
                                          </span>
                                        ) : null}
                                        <span
                                          className={
                                            level.mappingHealth === "weak"
                                              ? "font-medium text-[var(--enterprise-semantic-warning-text)]"
                                              : level.mappedDrawingCount > 0
                                                ? "text-[var(--enterprise-semantic-success-text)]"
                                                : "text-[var(--enterprise-text-muted)]"
                                          }
                                        >
                                          {levelHealthLabel(
                                            level.mappingHealth,
                                            level.mappedDrawingCount,
                                          )}
                                        </span>
                                      </span>
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)]"
                                    aria-label={`Rename ${level.name}`}
                                    title="Rename"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startRename(level);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                </div>
                                <div className="mt-1.5">
                                  <LevelDisplayToggle
                                    level={level}
                                    buildingId={buildingId}
                                    locationId={locationId}
                                  />
                                </div>
                                {isDrop ? (
                                  <p className="mt-1 text-center text-[10px] font-medium text-[var(--enterprise-primary)]">
                                    Drop to match drawing
                                  </p>
                                ) : null}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    },
                  )}
                </ul>
              )}

              {levels.length > 0 ? (
                <button
                  type="button"
                  className="my-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-surface)] hover:text-[var(--enterprise-primary)] disabled:opacity-50"
                  onClick={addManualLevel}
                  disabled={createLevel.isPending}
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  Add level
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function TreeFolderRow({
  open,
  onToggle,
  icon,
  label,
  meta,
  badge,
}: {
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  meta?: string;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-0.5 rounded-lg px-0.5 py-1 text-left transition hover:bg-[var(--enterprise-surface)]"
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="flex h-8 w-7 shrink-0 items-center justify-center text-[var(--enterprise-text-muted)]">
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
      </span>
      <span className="flex h-8 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 px-1.5">
        <span className="block truncate text-[13px] font-semibold text-[var(--enterprise-text)]">
          {label}
        </span>
        {meta ? (
          <span className="block truncate text-[10px] text-[var(--enterprise-text-muted)]">
            {meta}
          </span>
        ) : null}
      </span>
      {badge}
    </button>
  );
}

function StatusRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-xs text-[var(--enterprise-text-muted)]">
      {icon}
      {label}
    </div>
  );
}

function LevelNameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <div className="space-y-1">
      <input
        ref={ref}
        className="w-full rounded-md border border-[var(--enterprise-primary)] bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm font-medium text-[var(--enterprise-text)] outline-none ring-2 ring-[var(--enterprise-primary)]/15"
        value={value}
        aria-label="Level name"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <p className="text-[10px] text-[var(--enterprise-text-muted)]">
        Enter to save · Esc to cancel
      </p>
    </div>
  );
}
