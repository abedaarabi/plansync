"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  assetDraftToCreateBody,
  type AssetFormDraft,
} from "@/components/enterprise/OmAssetFormFields";
import {
  createOmAsset,
  uploadOmAssetImageFile,
  type OmAssetBimAnchor,
  type OmAssetRow,
} from "@/lib/api-client/operations-maintenance-assets";
import { ProRequiredError } from "@/lib/api-client/errors";
import { BimGlassDock } from "./BimGlassDock";

const fieldClass =
  "bim-focus-ring w-full rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_55%,transparent)] px-2.5 py-2 text-[12px] leading-snug text-[var(--bim-text)] shadow-sm placeholder:text-[var(--bim-text-muted)] outline-none transition focus:border-[var(--bim-accent)]/55";
const dateFieldClass = `${fieldClass} tabular-nums [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:[filter:brightness(0)_invert(1)]`;
const labelClass = "mb-1 block text-[10px] font-medium text-[var(--bim-text-muted)]";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className ?? "block"}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function BimAssetFormSlider(props: {
  open: boolean;
  projectId: string;
  fileId: string;
  fileVersionId: string;
  modelName: string;
  bimAnchor: OmAssetBimAnchor;
  initialDraft: AssetFormDraft;
  pendingPhoto?: File;
  onClose: () => void;
  onCreated: (asset: OmAssetRow) => void;
}) {
  const [draft, setDraft] = useState(props.initialDraft);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const pendingPhoto = props.pendingPhoto ?? null;

  useEffect(() => {
    if (!props.open) return;
    setDraft(props.initialDraft);
  }, [props.open, props.initialDraft]);

  useEffect(() => {
    if (!pendingPhoto) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingPhoto);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPhoto]);

  const level = props.bimAnchor.spatialPath?.[0] ?? draft.locationLabel;
  const linkedLabel = props.bimAnchor.name || props.bimAnchor.ifcType || "element";

  const createMut = useMutation({
    mutationFn: async () => {
      const base = assetDraftToCreateBody(draft);
      const row = await createOmAsset(props.projectId, {
        ...base,
        fileId: props.fileId,
        fileVersionId: props.fileVersionId,
        pageNumber: null,
        annotationId: null,
        bimAnchor: props.bimAnchor,
      });
      if (pendingPhoto) {
        return uploadOmAssetImageFile(props.projectId, row.id, pendingPhoto);
      }
      return row;
    },
    onSuccess: (row) => {
      toast.success("Asset created and linked to this element.");
      props.onCreated(row);
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const busy = createMut.isPending;
  const canSave = draft.tag.trim().length > 0 && draft.name.trim().length > 0 && !busy;

  return (
    <BimGlassDock
      side="right"
      open={props.open}
      title="New asset"
      subtitle={`Linked to ${linkedLabel}${level ? ` · ${level}` : ""} · ${props.modelName}`}
      onClose={props.onClose}
      closeOnOutsideClick={false}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="bim-dock-scroll space-y-3 px-3 py-2.5">
          {previewUrl ? (
            <div className="overflow-hidden rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_40%,transparent)]">
              <img
                src={previewUrl}
                alt="Captured element"
                className="max-h-40 w-full object-cover"
              />
              <p className="px-2.5 py-1.5 text-[10px] text-[var(--bim-text-muted)]">
                Captured from the 3D view
              </p>
            </div>
          ) : null}

          <section className="space-y-2 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_35%,transparent)] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
              From model
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div>
                <dt className="text-[var(--bim-text-muted)]">Level</dt>
                <dd className="font-medium text-[var(--bim-text)]">{level || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--bim-text-muted)]">Type</dt>
                <dd className="truncate font-medium text-[var(--bim-text)]">
                  {props.bimAnchor.ifcType || "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[var(--bim-text-muted)]">IFC GUID</dt>
                <dd className="break-all font-mono text-[10px] text-[var(--bim-text)]">
                  {props.bimAnchor.ifcGuid}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-2.5">
            <Field label="Tag (required)">
              <input
                value={draft.tag}
                onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                className={fieldClass}
                placeholder="AHU-01"
                disabled={busy}
                autoFocus
              />
            </Field>
            <Field label="Name (required)">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={fieldClass}
                disabled={busy}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Category">
                <input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className={fieldClass}
                  disabled={busy}
                />
              </Field>
              <Field label="Location / level">
                <input
                  value={draft.locationLabel}
                  onChange={(e) => setDraft({ ...draft, locationLabel: e.target.value })}
                  className={fieldClass}
                  disabled={busy}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Manufacturer">
                <input
                  value={draft.manufacturer}
                  onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                  className={fieldClass}
                  disabled={busy}
                />
              </Field>
              <Field label="Model">
                <input
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  className={fieldClass}
                  disabled={busy}
                />
              </Field>
            </div>
            <Field label="Serial number">
              <input
                value={draft.serialNumber}
                onChange={(e) => setDraft({ ...draft, serialNumber: e.target.value })}
                className={fieldClass}
                disabled={busy}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Install date">
                <input
                  type="date"
                  value={draft.installDate}
                  onChange={(e) => setDraft({ ...draft, installDate: e.target.value })}
                  className={dateFieldClass}
                  disabled={busy}
                />
              </Field>
              <Field label="Warranty expires">
                <input
                  type="date"
                  value={draft.warrantyExpires}
                  onChange={(e) => setDraft({ ...draft, warrantyExpires: e.target.value })}
                  className={dateFieldClass}
                  disabled={busy}
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                className={`${fieldClass} resize-y`}
                disabled={busy}
              />
            </Field>
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--bim-chrome-border)] px-3 py-2.5">
          <button
            type="button"
            onClick={props.onClose}
            disabled={busy}
            className="bim-focus-ring rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--bim-text-muted)] transition hover:bg-[color-mix(in_srgb,var(--bim-panel)_70%,transparent)] hover:text-[var(--bim-text)] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => createMut.mutate()}
            disabled={!canSave}
            className="bim-focus-ring rounded-lg bg-[var(--bim-accent)] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Create asset"}
          </button>
        </footer>
      </div>
    </BimGlassDock>
  );
}
