"use client";

import { useState } from "react";
import { Building2, MapPin, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LocationBuildingRow } from "@/lib/api-client/locations";
import { formatLocationPlace } from "@/lib/locations/buildingLabels";
import {
  useCreateBuildingMutation,
  useDeleteBuildingMutation,
  useLocationDetailQuery,
  useUpdateBuildingMutation,
} from "@/lib/locations/useBuildingQueries";
import { useEnterpriseWorkspace } from "../EnterpriseWorkspaceContext";
import { EnterpriseLoadingState } from "../EnterpriseLoadingState";
import { BuildingCard } from "./BuildingCard";
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
          {buildings.map((b) => (
            <BuildingCard
              key={b.id}
              building={b}
              projectId={projectId}
              locationId={locationId}
              onEdit={() => {
                setEditing(b);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteTarget({ id: b.id, name: b.name })}
            />
          ))}

          <button
            type="button"
            className="enterprise-dashed-add flex h-full min-h-[200px] flex-col items-center justify-center gap-1.5 rounded-2xl p-5 text-center"
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
