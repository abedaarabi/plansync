"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileText, Layers, Link2, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import {
  fetchLevelMappings,
  type BuildingAsset,
  type BuildingLevel,
  type LevelDrawingMapping,
} from "@/lib/api-client/locations";
import { useUnassignDrawingFromLevelMutation } from "@/lib/locations/useBuildingQueries";
import { qk } from "@/lib/queryKeys";
import { AssignDrawingsToLevelSlideOver } from "./AssignDrawingsToLevelSlideOver";
import { BuildingLevelFormSlideOver } from "./BuildingLevelFormSlideOver";

type Props = {
  buildingId: string;
  locationId: string;
  projectId: string;
  levels: BuildingLevel[];
  unmappedPdfs: BuildingAsset[];
  pdfAssets: BuildingAsset[];
};

function LevelDrawingsList({
  levelId,
  buildingId,
  locationId,
  projectId,
  pdfById,
}: {
  levelId: string;
  buildingId: string;
  locationId: string;
  projectId: string;
  pdfById: Map<string, BuildingAsset>;
}) {
  const unassignMut = useUnassignDrawingFromLevelMutation(buildingId, locationId);
  const { data: mappings = [], isPending } = useQuery({
    queryKey: qk.levelMappings(levelId),
    queryFn: () => fetchLevelMappings(levelId),
  });

  if (isPending) {
    return (
      <p className="enterprise-type-caption px-3.5 py-2.5 text-[var(--enterprise-text-muted)]">
        Loading drawings…
      </p>
    );
  }
  if (mappings.length === 0) {
    return (
      <p className="enterprise-type-caption px-3.5 py-2.5 text-[var(--enterprise-text-muted)]">
        No drawings assigned yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--enterprise-border)] border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40">
      {mappings.map((m: LevelDrawingMapping) => {
        const asset = pdfById.get(m.pdfFileId);
        const fvId = m.pdfFileVersionId ?? asset?.fileVersionId ?? null;
        const openHref =
          fvId != null
            ? `/viewer?${new URLSearchParams({
                fileId: m.pdfFileId,
                name: m.pdfFileName,
                projectId,
                fileVersionId: fvId,
              }).toString()}`
            : null;
        return (
          <li key={m.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <FileText
                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                aria-hidden
              />
              {openHref ? (
                <a
                  href={openHref}
                  className="truncate font-medium text-[var(--enterprise-primary)] hover:underline"
                >
                  {m.pdfFileName}
                </a>
              ) : (
                <span className="truncate font-medium text-[var(--enterprise-text)]">
                  {m.pdfFileName}
                </span>
              )}
            </div>
            <button
              type="button"
              className="mobile-touch-target inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
              disabled={unassignMut.isPending}
              onClick={() => {
                unassignMut.mutate(m.id, {
                  onSuccess: () => toast.success("Drawing unassigned"),
                  onError: (e) =>
                    toast.error(e instanceof Error ? e.message : "Could not unassign."),
                });
              }}
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden />
              Unassign
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function BuildingLevelsSection({
  buildingId,
  locationId,
  projectId,
  levels,
  unmappedPdfs,
  pdfAssets,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [assignLevel, setAssignLevel] = useState<BuildingLevel | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const pdfById = new Map(pdfAssets.map((a) => [a.id, a]));
  const mappedCount = levels.filter((l) => l.mappedDrawingCount > 0).length;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
            Building levels
          </h2>
          <p className="mt-0.5 text-sm text-[var(--enterprise-text-muted)]">
            {levels.length === 0
              ? "Create floors, then assign PDF drawings so issues and assets link automatically."
              : `${mappedCount}/${levels.length} level${levels.length === 1 ? "" : "s"} with drawings${
                  unmappedPdfs.length > 0
                    ? ` · ${unmappedPdfs.length} PDF${unmappedPdfs.length === 1 ? "" : "s"} unassigned`
                    : ""
                }`}
          </p>
        </div>
        <EnterpriseButton
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add level
        </EnterpriseButton>
      </div>

      {levels.length === 0 ? (
        <OmEmptyState
          icon={Layers}
          title="No levels yet"
          description="Add a level (for example Level 1), then assign one or more PDF drawings to it."
          action={
            <EnterpriseButton type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add level
            </EnterpriseButton>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
          {levels.map((level) => {
            const isOpen = expanded.has(level.id);
            const hasDrawings = level.mappedDrawingCount > 0;
            return (
              <li
                key={level.id}
                className="border-b border-[var(--enterprise-border)] last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-3.5">
                  <button
                    type="button"
                    className="mobile-touch-target flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => toggleExpand(level.id)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                        aria-hidden
                      />
                    )}
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
                      aria-hidden
                    >
                      <Layers
                        className="h-3.5 w-3.5 text-[var(--enterprise-text-muted)]"
                        strokeWidth={1.75}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                          {level.name}
                        </span>
                        {hasDrawings ? (
                          <span className="enterprise-badge-success rounded px-1.5 py-0.5 text-[11px] font-semibold">
                            Linked
                          </span>
                        ) : (
                          <span className="enterprise-badge-neutral rounded px-1.5 py-0.5 text-[11px] font-semibold">
                            Empty
                          </span>
                        )}
                      </span>
                      <span className="enterprise-type-caption mt-0.5 block text-[var(--enterprise-text-muted)]">
                        {level.mappedDrawingCount} drawing
                        {level.mappedDrawingCount === 1 ? "" : "s"}
                        {level.elevation != null ? ` · ${level.elevation} m` : ""}
                      </span>
                    </span>
                  </button>
                  <EnterpriseButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAssignLevel(level)}
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                    Assign PDFs
                  </EnterpriseButton>
                </div>
                {isOpen ? (
                  <LevelDrawingsList
                    levelId={level.id}
                    buildingId={buildingId}
                    locationId={locationId}
                    projectId={projectId}
                    pdfById={pdfById}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <BuildingLevelFormSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        buildingId={buildingId}
        locationId={locationId}
      />
      <AssignDrawingsToLevelSlideOver
        open={Boolean(assignLevel)}
        onClose={() => setAssignLevel(null)}
        buildingId={buildingId}
        locationId={locationId}
        level={assignLevel}
        unmappedPdfs={unmappedPdfs}
      />
    </section>
  );
}
