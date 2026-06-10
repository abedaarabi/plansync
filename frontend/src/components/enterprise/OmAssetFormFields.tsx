"use client";

import { useMemo, type ReactNode } from "react";
import { Search } from "lucide-react";
import { sortedVersions } from "@/components/file-explorer/fileExplorerUtils";
import { OmAssetImageField } from "@/components/enterprise/OmAssetImageField";
import type { OmAssetRow } from "@/lib/api-client";
import type { createOmAsset } from "@/lib/api-client";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import type { CloudFile, FileVersion } from "@/types/projects";

export type AssetFormDraft = {
  tag: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  locationLabel: string;
  hall: string;
  rowLabel: string;
  rack: string;
  positionU: string;
  installDate: string;
  warrantyExpires: string;
  lastServiceAt: string;
  notes: string;
  attachFileId: string;
  attachFileVersionId: string;
};

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

export function dateInputToIsoNullable(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return `${t}T12:00:00.000Z`;
}

export function emptyAssetDraft(): AssetFormDraft {
  return {
    tag: "",
    name: "",
    category: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    locationLabel: "",
    hall: "",
    rowLabel: "",
    rack: "",
    positionU: "",
    installDate: "",
    warrantyExpires: "",
    lastServiceAt: "",
    notes: "",
    attachFileId: "",
    attachFileVersionId: "",
  };
}

export function assetDraftFromRow(a: OmAssetRow): AssetFormDraft {
  return {
    tag: a.tag,
    name: a.name,
    category: a.category ?? "",
    manufacturer: a.manufacturer ?? "",
    model: a.model ?? "",
    serialNumber: a.serialNumber ?? "",
    locationLabel: a.locationLabel ?? "",
    hall: a.hall ?? "",
    rowLabel: a.rowLabel ?? "",
    rack: a.rack ?? "",
    positionU: a.positionU ?? "",
    installDate: isoToDateInput(a.installDate),
    warrantyExpires: isoToDateInput(a.warrantyExpires),
    lastServiceAt: isoToDateInput(a.lastServiceAt),
    notes: a.notes ?? "",
    attachFileId: a.fileId ?? "",
    attachFileVersionId: a.fileVersionId ?? "",
  };
}

export function assetDraftToCreateBody(d: AssetFormDraft): Parameters<typeof createOmAsset>[1] {
  const hasFile = d.attachFileId.trim().length > 0 && d.attachFileVersionId.trim().length > 0;
  return {
    tag: d.tag.trim(),
    name: d.name.trim(),
    category: d.category.trim() || null,
    manufacturer: d.manufacturer.trim() || null,
    model: d.model.trim() || null,
    serialNumber: d.serialNumber.trim() || null,
    locationLabel: d.locationLabel.trim() || null,
    hall: d.hall.trim() || null,
    rowLabel: d.rowLabel.trim() || null,
    rack: d.rack.trim() || null,
    positionU: d.positionU.trim() || null,
    installDate: dateInputToIsoNullable(d.installDate),
    warrantyExpires: dateInputToIsoNullable(d.warrantyExpires),
    lastServiceAt: dateInputToIsoNullable(d.lastServiceAt),
    notes: d.notes.trim() || null,
    ...(hasFile
      ? {
          fileId: d.attachFileId.trim(),
          fileVersionId: d.attachFileVersionId.trim(),
          pageNumber: null,
          annotationId: null,
        }
      : {}),
  };
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${MOBILE_FORM_SECTION} sm:col-span-2`}>
      <div className="mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

type Props = {
  draft: AssetFormDraft;
  onChange: (next: AssetFormDraft) => void;
  formKey: string;
  projectId: string;
  pdfFiles: CloudFile[];
  drawingSearch: string;
  onDrawingSearchChange: (q: string) => void;
  imageField?: {
    assetId?: string;
    hasExistingImage?: boolean;
    pendingFile: File | null;
    onPendingFileChange: (file: File | null) => void;
    removeExisting?: boolean;
    onRemoveExistingChange?: (remove: boolean) => void;
    disabled?: boolean;
  };
};

export function OmAssetFormFields({
  draft,
  onChange,
  formKey,
  projectId,
  pdfFiles,
  drawingSearch,
  onDrawingSearchChange,
  imageField,
}: Props) {
  const filteredPdfs = useMemo(() => {
    const q = drawingSearch.trim().toLowerCase();
    if (!q) return pdfFiles;
    return pdfFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [pdfFiles, drawingSearch]);

  const selectedFile = pdfFiles.find((f) => f.id === draft.attachFileId);
  const versions = selectedFile ? sortedVersions(selectedFile) : [];

  const field = MOBILE_FIELD_INPUT;
  const label = MOBILE_FIELD_LABEL;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {imageField ? (
        <FormSection
          title="Equipment photo"
          description="Optional — helps field teams identify this asset in the register."
        >
          <OmAssetImageField
            projectId={projectId}
            assetId={imageField.assetId}
            hasExistingImage={imageField.hasExistingImage}
            pendingFile={imageField.pendingFile}
            onPendingFileChange={imageField.onPendingFileChange}
            removeExisting={imageField.removeExisting}
            onRemoveExistingChange={imageField.onRemoveExistingChange}
            disabled={imageField.disabled}
            embedded
          />
        </FormSection>
      ) : null}

      <FormSection title="Identity" description="Tag and name are required.">
        <label className="block text-sm">
          <span className={label}>Tag (e.g. AHU-01)</span>
          <input
            id={`asset-form-${formKey}-tag`}
            value={draft.tag}
            onChange={(e) => onChange({ ...draft, tag: e.target.value })}
            className={field}
            placeholder="AHU-01"
          />
        </label>
        <label className="block text-sm">
          <span className={label}>Name</span>
          <input
            id={`asset-form-${formKey}-name`}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className={field}
            placeholder="Air handling unit"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className={label}>Category</span>
          <input
            id={`asset-form-${formKey}-category`}
            value={draft.category}
            onChange={(e) => onChange({ ...draft, category: e.target.value })}
            className={field}
            placeholder="e.g. HVAC"
          />
        </label>
      </FormSection>

      <FormSection title="Manufacturer & model">
        <label className="block text-sm">
          <span className={label}>Manufacturer</span>
          <input
            value={draft.manufacturer}
            onChange={(e) => onChange({ ...draft, manufacturer: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className={label}>Model</span>
          <input
            value={draft.model}
            onChange={(e) => onChange({ ...draft, model: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className={label}>Serial number</span>
          <input
            value={draft.serialNumber}
            onChange={(e) => onChange({ ...draft, serialNumber: e.target.value })}
            className={field}
          />
        </label>
      </FormSection>

      <FormSection
        title="Location"
        description="Use a free-text label and/or structured hall / row / rack fields."
      >
        <label className="block text-sm sm:col-span-2">
          <span className={label}>Location label</span>
          <input
            value={draft.locationLabel}
            onChange={(e) => onChange({ ...draft, locationLabel: e.target.value })}
            className={field}
            placeholder="e.g. Roof · East plant room"
          />
        </label>
        <label className="block text-sm">
          <span className={label}>Hall</span>
          <input
            value={draft.hall}
            onChange={(e) => onChange({ ...draft, hall: e.target.value })}
            className={field}
            placeholder="Hall A"
          />
        </label>
        <label className="block text-sm">
          <span className={label}>Row</span>
          <input
            value={draft.rowLabel}
            onChange={(e) => onChange({ ...draft, rowLabel: e.target.value })}
            className={field}
            placeholder="Row 05"
          />
        </label>
        <label className="block text-sm">
          <span className={label}>Rack</span>
          <input
            value={draft.rack}
            onChange={(e) => onChange({ ...draft, rack: e.target.value })}
            className={field}
            placeholder="R12"
          />
        </label>
        <label className="block text-sm">
          <span className={label}>U position</span>
          <input
            value={draft.positionU}
            onChange={(e) => onChange({ ...draft, positionU: e.target.value })}
            className={field}
            placeholder="U42"
          />
        </label>
      </FormSection>

      <FormSection title="Lifecycle & notes">
        <label className="block text-sm">
          <span className={label}>Install date</span>
          <input
            type="date"
            value={draft.installDate}
            onChange={(e) => onChange({ ...draft, installDate: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className={label}>Warranty expires</span>
          <input
            type="date"
            value={draft.warrantyExpires}
            onChange={(e) => onChange({ ...draft, warrantyExpires: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className={label}>Last service</span>
          <input
            type="date"
            value={draft.lastServiceAt}
            onChange={(e) => onChange({ ...draft, lastServiceAt: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className={label}>Notes</span>
          <textarea
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            rows={3}
            className={MOBILE_FIELD_TEXTAREA}
            placeholder="Specs, supplier contacts, access instructions…"
          />
        </label>
      </FormSection>

      <FormSection
        title="Linked drawing"
        description='Attach a PDF revision now, or use "Place on drawing" after save to drop an equipment pin.'
      >
        <div className="relative sm:col-span-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
            strokeWidth={2}
            aria-hidden
          />
          <input
            value={drawingSearch}
            onChange={(e) => onDrawingSearchChange(e.target.value)}
            placeholder="Search project PDFs…"
            className={`${field} pl-10`}
            aria-label="Search drawings"
          />
        </div>
        {pdfFiles.length === 0 ? (
          <p className="text-sm text-[var(--enterprise-text-muted)] sm:col-span-2">
            No PDF drawings in this project yet. Add drawings elsewhere, then link them here.
          </p>
        ) : (
          <>
            <label className="block text-sm sm:col-span-2">
              <span className={label}>Document</span>
              <select
                value={draft.attachFileId}
                onChange={(e) => {
                  const fid = e.target.value;
                  const f = pdfFiles.find((x) => x.id === fid);
                  const v0 = f ? sortedVersions(f)[0] : undefined;
                  onChange({
                    ...draft,
                    attachFileId: fid,
                    attachFileVersionId: v0?.id ?? "",
                  });
                }}
                className={MOBILE_FIELD_SELECT}
              >
                <option value="">— None —</option>
                {filteredPdfs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedFile ? (
              <label className="block text-sm sm:col-span-2">
                <span className={label}>Revision</span>
                <select
                  value={draft.attachFileVersionId}
                  onChange={(e) => onChange({ ...draft, attachFileVersionId: e.target.value })}
                  className={MOBILE_FIELD_SELECT}
                >
                  {versions.map((v: FileVersion) => (
                    <option key={v.id} value={v.id}>
                      v{v.version}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        )}
      </FormSection>
    </div>
  );
}
