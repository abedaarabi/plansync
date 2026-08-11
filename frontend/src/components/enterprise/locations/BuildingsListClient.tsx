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
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";
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
  const isProPlus = isWorkspaceProPlusClient(primary?.workspace);
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
      <div className="enterprise-card flex flex-col items-center gap-3 rounded-md px-6 py-12 text-center">
        <p className="text-sm font-medium text-[var(--enterprise-text)]">
          Couldn’t load this location
        </p>
        <button
          type="button"
          className="enterprise-btn-primary mobile-touch-target rounded-md px-4 py-2 text-sm"
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
    <div className="enterprise-animate-in space-y-4 pb-8">
      <header className="mb-1 flex flex-col gap-3 border-b border-[var(--enterprise-border)] pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
            <MapPin
              className="h-4 w-4 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label">Location</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="enterprise-type-title truncate">{location?.name}</h1>
              {location?.code ? (
                <span className="enterprise-badge-neutral rounded px-1.5 py-0.5 text-xs font-semibold">
                  {location.code}
                </span>
              ) : null}
            </div>
            <p className="enterprise-type-subtitle mt-1">
              {place ?? "No address yet"}
              {" · "}
              {buildings.length} building{buildings.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {buildings.length > 0 ? (
          <button
            type="button"
            className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold"
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
        <div className="enterprise-card flex flex-col items-center gap-3 px-5 py-10 text-center sm:py-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
            <Building2
              className="h-4 w-4 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="max-w-sm space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
              Add your first building
            </h2>
            <p className="enterprise-type-subtitle text-[0.9375rem] leading-relaxed">
              Create a building, then upload an IFC model and PDF drawings to start setup.
            </p>
          </div>
          <button
            type="button"
            className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold"
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
            className="enterprise-dashed-add flex h-full min-h-[12.5rem] flex-col items-center justify-center gap-1.5 rounded-md p-5 text-center"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <Plus className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-[var(--enterprise-text)]">Add building</p>
            <p className="text-xs text-[var(--enterprise-text-muted)]">Upload IFC and drawings</p>
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
                setFormOpen(false);
                if (!isProPlus) {
                  toast.message("Building created", {
                    description: "BIM / IFC upload requires Pro — upgrade under Billing.",
                  });
                  router.push(
                    `/projects/${projectId}/locations/${locationId}/buildings/${building.id}`,
                  );
                  return;
                }
                toast.success("Building created — add your files");
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
