"use client";

import { LayoutList, Pencil, Plus } from "lucide-react";
import type { MaterialTemplateField } from "@/lib/api-client";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { OM_COMPACT_INPUT } from "@/lib/omCompactStyles";
import type { MaterialFormState } from "./materialsUtils";

type Props = {
  open: boolean;
  editing: boolean;
  form: MaterialFormState;
  onFormChange: (next: MaterialFormState) => void;
  sortedTplFields: MaterialTemplateField[];
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export function MaterialsFormSlideOver({
  open,
  editing,
  form,
  onFormChange,
  sortedTplFields,
  saving,
  onClose,
  onSubmit,
}: Props) {
  function setField<K extends keyof MaterialFormState>(key: K, value: MaterialFormState[K]) {
    onFormChange({ ...form, [key]: value });
  }

  function setCustom(key: string, value: string) {
    onFormChange({
      ...form,
      custom: { ...form.custom, [key]: value },
    });
  }

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="materials-panel-title"
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          onSubmit();
        },
      }}
      header={
        <SlideOverHeader
          titleId="materials-panel-title"
          icon={editing ? Pencil : Plus}
          title={editing ? "Edit material" : "Add material"}
          description="Types merge by name (case-insensitive). Same type + name updates one row."
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" size="sm" loading={saving} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add material"}
          </EnterpriseButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="enterprise-type-label">Core details</p>
        </div>
        <div className="sm:col-span-2">
          <label className="enterprise-field-label">
            Material type <span className="text-[var(--enterprise-error)]">*</span>
          </label>
          <input
            required
            value={form.materialType}
            onChange={(e) => setField("materialType", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
            placeholder="e.g. Concrete, Structural Steel, Finishes"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="enterprise-field-label">
            Material name <span className="text-[var(--enterprise-error)]">*</span>
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
            placeholder="e.g. Ready-mix 25 MPa"
          />
        </div>
        <div>
          <label className="enterprise-field-label">SKU</label>
          <input
            value={form.sku}
            onChange={(e) => setField("sku", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
          />
        </div>
        <div>
          <label className="enterprise-field-label">Unit</label>
          <input
            value={form.unit}
            onChange={(e) => setField("unit", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
            placeholder="m³, kg, sf, ea…"
          />
        </div>
        <div>
          <label className="enterprise-field-label">Unit price</label>
          <input
            value={form.unitPrice}
            onChange={(e) => setField("unitPrice", e.target.value)}
            inputMode="decimal"
            className={`mt-1 ${OM_COMPACT_INPUT}`}
          />
        </div>
        <div>
          <label className="enterprise-field-label">Currency</label>
          <input
            value={form.currency}
            onChange={(e) => setField("currency", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
            placeholder="USD"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="enterprise-field-label">Supplier</label>
          <input
            value={form.supplier}
            onChange={(e) => setField("supplier", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="enterprise-field-label">Manufacturer</label>
          <input
            value={form.manufacturer}
            onChange={(e) => setField("manufacturer", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="enterprise-field-label">Specification</label>
          <input
            value={form.specification}
            onChange={(e) => setField("specification", e.target.value)}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
            placeholder="ASTM, grade, mix design…"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="enterprise-field-label">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            rows={2}
            className={`mt-1 ${OM_COMPACT_INPUT}`}
          />
        </div>
        {sortedTplFields.length > 0 ? (
          <div className="sm:col-span-2 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/45 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)]">
                <LayoutList className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                  Custom properties
                </p>
                <p className="enterprise-type-caption mt-0.5">
                  Defined in Catalog fields. Values sync to Excel import/export.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sortedTplFields.map((f) => (
                <div key={f.id} className={f.type === "text" ? "sm:col-span-2" : ""}>
                  <label className="enterprise-field-label">
                    {f.label}
                    {f.required ? <span className="text-[var(--enterprise-error)]"> *</span> : null}
                  </label>
                  <input
                    value={form.custom[f.key] ?? ""}
                    onChange={(e) => setCustom(f.key, e.target.value)}
                    inputMode={f.type === "text" ? undefined : "decimal"}
                    className={`mt-1 ${OM_COMPACT_INPUT} ${
                      f.type === "number" || f.type === "currency" ? "tabular-nums" : ""
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </EnterpriseSlideOver>
  );
}
