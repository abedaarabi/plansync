"use client";

import { useState } from "react";
import { Boxes, Building2, FileText, Layers, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LocationBuildingRow } from "@/lib/api-client/locations";
import { buildingTypeLabel, formatLocationPlace } from "@/lib/locations/buildingLabels";
import {
  useCreateBuildingMutation,
  useDeleteBuildingMutation,
  useLocationDetailQuery,
  useUpdateBuildingMutation,
} from "@/lib/locations/useBuildingQueries";
import { useEnterpriseWorkspace } from "../EnterpriseWorkspaceContext";
import { EnterpriseLoadingState } from "../EnterpriseLoadingState";
import { BuildingCardStatus } from "./BuildingCardStatus";
import { BuildingFormDialog } from "./BuildingFormDialog";
import { TypeDeleteConfirmDialog } from "./TypeDeleteConfirmDialog";

const BuildingFileBrowser = dynamic(
  () => import("./file-browser").then((m) => m.BuildingFileBrowser),
  { ssr: false },
);

type Props = { projectId: string; locationId: string };

// fallow-ignore-next-line complexity
export function BuildingsListClient({ projectId, locationId }: Props) {
  const router = useRouter();
  const { primary } = useEnterpriseWorkspace();
  const workspaceId = primary?.workspace.id ?? "";
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LocationBuildingRow | null>(null);
  const [browserBuilding, setBrowserBuilding] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, isPending, isError, refetch } = useLocationDetailQuery(locationId);
  const createMut = useCreateBuildingMutation(projectId, locationId);
  const updateMut = useUpdateBuildingMutation(projectId, locationId);
  const deleteMut = useDeleteBuildingMutation(projectId, locationId);

  if (isPending && !data) return <EnterpriseLoadingState label="Loading buildings…" />;

  if (isError && !data) {
    return (
      <div className="enterprise-card flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
        <p className="text-sm font-medium text-[var(--enterprise-text)]">
          Couldn’t load this location
        </p>
        <button
          type="button"
          className="enterprise-btn-primary mobile-touch-target rounded-lg px-4 py-2 text-sm"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  const buildings = data?.buildings ?? [];
  const location = data?.location;
  const place = location ? formatLocationPlace(location) : null;
  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="enterprise-animate-in space-y-5 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)]">
            <MapPin className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Location</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                {location?.name}
              </h1>
              {location?.code ? (
                <span className="rounded-md bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enterprise-primary)]">
                  {location.code}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              {place ?? "No address yet"}
              {" · "}
              {buildings.length} building{buildings.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {buildings.length > 0 ? (
          <button
            type="button"
            className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add building
          </button>
        ) : null}
      </header>

      {buildings.length === 0 ? (
        <div className="enterprise-card flex flex-col items-center gap-4 rounded-2xl px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)]">
            <Building2 className="h-7 w-7 text-[var(--enterprise-primary)]" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1">
            <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
              Add your first building
            </h2>
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              Create a building, then upload an IFC model and PDF drawings to start setup.
            </p>
          </div>
          <button
            type="button"
            className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add building
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => {
            const typeLabel = buildingTypeLabel(b.buildingType);
            const metaLine =
              [typeLabel, b.floorsApprox != null ? `~${b.floorsApprox} floors` : null]
                .filter(Boolean)
                .join(" · ") || "No type yet";
            return (
              <div
                key={b.id}
                className="enterprise-card enterprise-card-hover group flex flex-col overflow-hidden"
              >
                <Link
                  href={`/projects/${projectId}/locations/${locationId}/buildings/${b.id}`}
                  className="flex flex-1 flex-col p-4 transition-colors hover:bg-[var(--enterprise-hover-surface)]/50"
                >
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)]">
                      <Building2 className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <h2 className="truncate text-sm font-semibold leading-snug text-[var(--enterprise-text)] group-hover:text-[var(--enterprise-primary)]">
                            {b.name}
                          </h2>
                          {b.code ? (
                            <span className="rounded-md bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enterprise-primary)]">
                              {b.code}
                            </span>
                          ) : null}
                        </div>
                        <div className="shrink-0">
                          <BuildingCardStatus building={b} />
                        </div>
                      </div>
                      <p className="text-[13px] leading-relaxed text-[var(--enterprise-text-muted)]">
                        {metaLine}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--enterprise-border)] pt-2.5 text-[11px] text-[var(--enterprise-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Boxes className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      {b.ifcCount} IFC
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      {b.pdfCount} PDF
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      {b.levelCount} level{b.levelCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center justify-end gap-0.5 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-2 py-1.5">
                  <button
                    type="button"
                    className="mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                    aria-label={`Edit ${b.name}`}
                    onClick={() => {
                      setEditing(b);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                    aria-label={`Delete ${b.name}`}
                    onClick={() => setDeleteTarget({ id: b.id, name: b.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="enterprise-dashed-add flex h-full min-h-[168px] flex-col items-center justify-center gap-1.5 rounded-2xl p-5 text-center"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <Plus className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-[var(--enterprise-text)]">Add building</p>
            <p className="text-[11px] text-[var(--enterprise-text-muted)]">
              Upload IFC and drawings
            </p>
          </button>
        </div>
      )}

      <BuildingFormDialog
        open={formOpen}
        mode={editing ? "edit" : "create"}
        initial={editing}
        isSaving={saving}
        onClose={() => {
          if (!saving) {
            setFormOpen(false);
            setEditing(null);
          }
        }}
        onSubmit={(input) => {
          if (editing) {
            updateMut.mutate(
              { id: editing.id, ...input },
              {
                onSuccess: () => {
                  toast.success("Building updated");
                  setFormOpen(false);
                  setEditing(null);
                },
                onError: (err: Error) => toast.error(err.message),
              },
            );
          } else {
            createMut.mutate(input, {
              onSuccess: (building) => {
                toast.success("Building created — add your files");
                setFormOpen(false);
                setBrowserBuilding({ id: building.id, name: building.name });
              },
              onError: (err: Error) => toast.error(err.message),
            });
          }
        }}
      />

      <BuildingFileBrowser
        open={browserBuilding != null}
        onClose={() => {
          const target = browserBuilding;
          setBrowserBuilding(null);
          if (target) {
            router.push(`/projects/${projectId}/locations/${locationId}/buildings/${target.id}`);
          }
        }}
        buildingId={browserBuilding?.id ?? ""}
        buildingName={browserBuilding?.name ?? ""}
        projectId={projectId}
        locationId={locationId}
        workspaceId={workspaceId}
      />

      <TypeDeleteConfirmDialog
        open={deleteTarget != null}
        title="Delete building?"
        entityName={deleteTarget?.name ?? ""}
        description="This permanently deletes the building, levels, mappings, and building uploads. Linked project files are only detached. This cannot be undone."
        confirmLabel="Delete building"
        isDeleting={deleteMut.isPending}
        onCancel={() => {
          if (!deleteMut.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMut.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success("Building deleted");
              setDeleteTarget(null);
            },
            onError: (err: Error) => toast.error(err.message),
          });
        }}
      />
    </div>
  );
}
