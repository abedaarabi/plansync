"use client";

import { useState } from "react";
import { Building2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { LocationSummary } from "@/lib/api-client/locations";
import { formatLocationPlace } from "@/lib/locations/buildingLabels";
import {
  useCreateLocationMutation,
  useDeleteLocationMutation,
  useLocationsQuery,
  useUpdateLocationMutation,
} from "@/lib/locations/useBuildingQueries";
import { EnterpriseLoadingState } from "../EnterpriseLoadingState";
import { LocationFormDialog } from "./LocationFormDialog";
import { TypeDeleteConfirmDialog } from "./TypeDeleteConfirmDialog";

type Props = { projectId: string };

export function LocationsListClient({ projectId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocationSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationSummary | null>(null);

  const { data, isPending, isError, refetch } = useLocationsQuery(projectId);
  const createMut = useCreateLocationMutation(projectId);
  const updateMut = useUpdateLocationMutation(projectId);
  const deleteMut = useDeleteLocationMutation(projectId);

  if (isPending && !data) return <EnterpriseLoadingState label="Loading locations…" />;

  if (isError && !data) {
    return (
      <div className="enterprise-card flex flex-col items-center gap-3 rounded-md px-6 py-12 text-center">
        <p className="text-sm font-medium text-[var(--enterprise-text)]">Couldn’t load locations</p>
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

  const locations = data ?? [];
  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="enterprise-animate-in space-y-4 pb-8">
      <header className="mb-1 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--enterprise-border)] pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
            <MapPin
              className="h-4 w-4 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label">Portfolio</p>
            <h1 className="enterprise-type-title">Locations</h1>
            <p className="enterprise-type-subtitle mt-1">
              Sites and campuses — each location holds one or more buildings.
            </p>
          </div>
        </div>
        {locations.length > 0 ? (
          <button
            type="button"
            className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add location
          </button>
        ) : null}
      </header>

      {locations.length === 0 ? (
        <div className="enterprise-card flex flex-col items-center gap-3 px-5 py-10 text-center sm:py-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
            <MapPin
              className="h-4 w-4 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="max-w-sm space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
              Add your first location
            </h2>
            <p className="enterprise-type-subtitle text-[0.9375rem] leading-relaxed">
              Create a site to organize buildings, upload IFC models, and match drawings to levels.
            </p>
          </div>
          <button
            type="button"
            className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add location
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => {
            const place = formatLocationPlace(loc);
            return (
              <div
                key={loc.id}
                className="enterprise-card enterprise-card-hover group flex flex-col overflow-hidden"
              >
                <Link
                  href={`/projects/${projectId}/locations/${loc.id}`}
                  className="flex flex-1 flex-col p-4 transition-colors hover:bg-[var(--enterprise-hover-surface)]/50"
                >
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
                      <MapPin
                        className="h-4 w-4 text-[var(--enterprise-text-muted)]"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="truncate text-sm font-semibold leading-snug text-[var(--enterprise-text)] group-hover:text-[var(--enterprise-primary)]">
                          {loc.name}
                        </h2>
                        {loc.code ? (
                          <span className="enterprise-badge-neutral rounded px-1.5 py-0.5 text-xs font-semibold">
                            {loc.code}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                        {place ?? "No address yet"}
                      </p>
                    </div>
                  </div>
                  <div className="enterprise-type-caption mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--enterprise-border)] pt-2.5">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      {loc.buildingCount} building{loc.buildingCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center justify-end gap-0.5 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/40 px-2 py-1.5">
                  <button
                    type="button"
                    className="mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                    aria-label={`Edit ${loc.name}`}
                    onClick={() => {
                      setEditing(loc);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                    aria-label={`Delete ${loc.name}`}
                    onClick={() => setDeleteTarget(loc)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="enterprise-dashed-add flex h-full min-h-[10.5rem] flex-col items-center justify-center gap-1.5 rounded-md p-5 text-center"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <Plus className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-[var(--enterprise-text)]">Add location</p>
            <p className="text-xs text-[var(--enterprise-text-muted)]">
              Create a site for buildings
            </p>
          </button>
        </div>
      )}

      <LocationFormDialog
        open={dialogOpen}
        mode={editing ? "edit" : "create"}
        initial={editing}
        isSaving={saving}
        onClose={() => {
          if (!saving) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
        onSubmit={(input) => {
          if (editing) {
            updateMut.mutate(
              { id: editing.id, ...input },
              {
                onSuccess: () => {
                  toast.success("Location updated");
                  setDialogOpen(false);
                  setEditing(null);
                },
                onError: (err: Error) => toast.error(err.message),
              },
            );
          } else {
            createMut.mutate(input, {
              onSuccess: () => {
                toast.success("Location created");
                setDialogOpen(false);
              },
              onError: (err: Error) => toast.error(err.message),
            });
          }
        }}
      />

      <TypeDeleteConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete location?"
        entityName={deleteTarget?.name ?? ""}
        description="This permanently deletes the location, all buildings under it, levels, mappings, and building uploads. This cannot be undone."
        confirmLabel="Delete location"
        isDeleting={deleteMut.isPending}
        onCancel={() => {
          if (!deleteMut.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMut.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success("Location deleted");
              setDeleteTarget(null);
            },
            onError: (err: Error) => toast.error(err.message),
          });
        }}
      />
    </div>
  );
}
