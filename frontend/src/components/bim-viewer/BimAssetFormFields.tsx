"use client";

import type { ReactNode } from "react";
import type { AssetFormDraft } from "@/components/enterprise/OmAssetFormFields";
import type { OmAssetBimAnchor } from "@/lib/api-client/operations-maintenance-assets";
import { BimAssetDocumentsSection } from "./BimAssetDocumentsSection";
import { BimAssetImageField } from "./BimAssetImageField";

const fieldClass =
  "bim-focus-ring w-full rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_55%,transparent)] px-2.5 py-2 text-[12px] leading-snug text-[var(--bim-text)] shadow-sm placeholder:text-[var(--bim-text-muted)] outline-none transition focus:border-[var(--bim-accent)]/55";
const dateFieldClass = `${fieldClass} tabular-nums [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:[filter:brightness(0)_invert(1)]`;
const labelClass = "mb-1 block text-[10px] font-medium text-[var(--bim-text-muted)]";
const sectionTitleClass =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]";

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

export function BimAssetFormFields(props: {
  draft: AssetFormDraft;
  onChange: (next: AssetFormDraft) => void;
  bimAnchor: OmAssetBimAnchor | null | undefined;
  level: string | null | undefined;
  projectId: string;
  editAssetId?: string;
  hasExistingImage?: boolean;
  pendingImage: File | null;
  onPendingImageChange: (file: File | null) => void;
  removeImage: boolean;
  onRemoveImageChange: (remove: boolean) => void;
  imageHint?: string | null;
  busy: boolean;
  showDocuments: boolean;
}) {
  const { draft, onChange: setDraft, busy } = props;

  return (
    <div className="bim-dock-scroll space-y-3 px-3 py-2.5">
      <section className="space-y-2 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_35%,transparent)] p-2.5">
        <p className={sectionTitleClass}>From model</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
          <div>
            <dt className="text-[var(--bim-text-muted)]">Level</dt>
            <dd className="font-medium text-[var(--bim-text)]">{props.level || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--bim-text-muted)]">Type</dt>
            <dd className="truncate font-medium text-[var(--bim-text)]">
              {props.bimAnchor?.ifcType || "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[var(--bim-text-muted)]">IFC GUID</dt>
            <dd className="break-all font-mono text-[10px] text-[var(--bim-text)]">
              {props.bimAnchor?.ifcGuid || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <BimAssetImageField
        projectId={props.projectId}
        assetId={props.editAssetId}
        hasExistingImage={props.hasExistingImage}
        pendingFile={props.pendingImage}
        onPendingFileChange={props.onPendingImageChange}
        removeExisting={props.removeImage}
        onRemoveExistingChange={props.onRemoveImageChange}
        disabled={busy}
        hint={props.imageHint}
      />

      <section className="space-y-2.5">
        <p className={sectionTitleClass}>Identity</p>
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
            placeholder="Air handling unit"
            disabled={busy}
          />
        </Field>
        <Field label="Category">
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className={fieldClass}
            placeholder="e.g. HVAC"
            disabled={busy}
          />
        </Field>
      </section>

      <section className="space-y-2.5">
        <p className={sectionTitleClass}>Manufacturer & model</p>
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
      </section>

      <section className="space-y-2.5">
        <p className={sectionTitleClass}>Location</p>
        <Field label="Location label">
          <input
            value={draft.locationLabel}
            onChange={(e) => setDraft({ ...draft, locationLabel: e.target.value })}
            className={fieldClass}
            placeholder="e.g. Roof · East plant room"
            disabled={busy}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Hall">
            <input
              value={draft.hall}
              onChange={(e) => setDraft({ ...draft, hall: e.target.value })}
              className={fieldClass}
              placeholder="Hall A"
              disabled={busy}
            />
          </Field>
          <Field label="Row">
            <input
              value={draft.rowLabel}
              onChange={(e) => setDraft({ ...draft, rowLabel: e.target.value })}
              className={fieldClass}
              placeholder="Row 05"
              disabled={busy}
            />
          </Field>
          <Field label="Rack">
            <input
              value={draft.rack}
              onChange={(e) => setDraft({ ...draft, rack: e.target.value })}
              className={fieldClass}
              placeholder="R12"
              disabled={busy}
            />
          </Field>
          <Field label="U position">
            <input
              value={draft.positionU}
              onChange={(e) => setDraft({ ...draft, positionU: e.target.value })}
              className={fieldClass}
              placeholder="U42"
              disabled={busy}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-2.5">
        <p className={sectionTitleClass}>Lifecycle & notes</p>
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
          <Field label="Last service" className="col-span-2 sm:col-span-1">
            <input
              type="date"
              value={draft.lastServiceAt}
              onChange={(e) => setDraft({ ...draft, lastServiceAt: e.target.value })}
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
            placeholder="Specs, supplier contacts, access instructions…"
            disabled={busy}
          />
        </Field>
      </section>

      {props.showDocuments && props.editAssetId ? (
        <BimAssetDocumentsSection projectId={props.projectId} assetId={props.editAssetId} />
      ) : (
        <p className="rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_25%,transparent)] px-2.5 py-2 text-[11px] text-[var(--bim-text-muted)]">
          After you create the asset, you can upload manuals and certificates from the asset panel
          or by editing again.
        </p>
      )}
    </div>
  );
}
