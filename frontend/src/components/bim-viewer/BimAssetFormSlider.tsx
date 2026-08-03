"use client";

import { useMutation } from "@tanstack/react-query";
import { Package, X } from "lucide-react";
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

const fieldClass =
  "w-full rounded-lg border border-slate-600/70 bg-slate-900/60 px-2.5 py-2 text-[12px] leading-snug text-slate-100 shadow-sm placeholder:text-slate-500 outline-none transition focus:border-[var(--viewer-primary)]/55 focus:ring-2 focus:ring-[var(--viewer-primary)]/20";
const dateFieldClass = `${fieldClass} tabular-nums [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:[filter:brightness(0)_invert(1)]`;
const labelClass = "mb-1 block text-[10px] font-medium text-slate-400";

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

  if (!props.open) return null;

  const busy = createMut.isPending;
  const canSave = draft.tag.trim().length > 0 && draft.name.trim().length > 0 && !busy;

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="bim-asset-form-title"
      className="absolute left-0 top-0 z-40 flex h-full w-full min-w-0 max-w-[min(420px,calc(100dvw-1rem))] flex-col overflow-x-hidden border-r border-slate-700/80 bg-slate-950 shadow-[16px_0_48px_-12px_rgba(0,0,0,0.55)]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/90 bg-slate-950 px-5 py-3.5">
        <div className="min-w-0 space-y-0.5 pr-2">
          <h2
            id="bim-asset-form-title"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white"
          >
            <Package className="h-4 w-4 text-teal-400" strokeWidth={2} aria-hidden />
            New asset
          </h2>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Linked to {props.bimAnchor.name || props.bimAnchor.ifcType || "element"}
            {level ? ` · ${level}` : ""} in {props.modelName}.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          disabled={busy}
          className="viewer-focus-ring shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-x-none px-5 py-4 [scrollbar-color:rgba(71,85,105,0.5)_transparent] [scrollbar-width:thin]">
        {previewUrl ? (
          <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40">
            <img src={previewUrl} alt="Captured element" className="max-h-44 w-full object-cover" />
            <p className="px-3 py-2 text-[10px] text-slate-500">Captured from the 3D view</p>
          </div>
        ) : null}

        <section className="space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-900/35 p-2.5 ring-1 ring-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-300/80">
            From model
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
            <div>
              <dt className="text-slate-500">Level</dt>
              <dd className="font-medium text-slate-200">{level || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="truncate font-medium text-slate-200">
                {props.bimAnchor.ifcType || "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">IFC GUID</dt>
              <dd className="break-all font-mono text-[10px] text-slate-300">
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
          <div className="grid grid-cols-2 gap-2.5">
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
          <div className="grid grid-cols-2 gap-2.5">
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
          <div className="grid grid-cols-2 gap-2.5">
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
              rows={4}
              className={`${fieldClass} resize-y`}
              disabled={busy}
            />
          </Field>
        </section>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-800/90 bg-slate-950/90 px-5 py-3">
        <button
          type="button"
          onClick={props.onClose}
          disabled={busy}
          className="viewer-focus-ring rounded-lg px-3 py-2 text-[12px] font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => createMut.mutate()}
          disabled={!canSave}
          className="viewer-focus-ring rounded-lg bg-teal-600 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-teal-500 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Create asset"}
        </button>
      </footer>
    </aside>
  );
}
