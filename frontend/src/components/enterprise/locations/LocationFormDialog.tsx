"use client";

import { useEffect, useState } from "react";
import { Hash, MapPin, StickyNote } from "lucide-react";
import type { LocationInput, LocationSummary } from "@/lib/api-client/locations";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_TEXTAREA,
} from "@/lib/mobileFormStyles";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: LocationSummary | null;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (input: LocationInput) => void;
};

const empty: LocationInput = {
  name: "",
  code: "",
  address: "",
  city: "",
  country: "",
  notes: "",
};

export function LocationFormDialog({
  open,
  mode,
  initial,
  isSaving = false,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<LocationInput>(empty);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setForm({
        name: initial.name,
        code: initial.code ?? "",
        address: initial.address ?? "",
        city: initial.city ?? "",
        country: initial.country ?? "",
        notes: initial.notes ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [open, mode, initial]);

  const set =
    (key: keyof LocationInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isSaving ? () => {} : onClose}
      ariaLabelledBy="location-form-title"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      panelClassName="max-w-lg"
      footer={
        <>
          <button
            type="submit"
            form="location-form"
            disabled={isSaving || !form.name.trim()}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} enterprise-btn-primary`}
          >
            {isSaving ? "Saving…" : mode === "create" ? "Create location" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)]`}
          >
            Cancel
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)]">
          <MapPin className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2
            id="location-form-title"
            className="text-lg font-semibold text-[var(--enterprise-text)]"
          >
            {mode === "create" ? "Add location" : "Edit location"}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--enterprise-text-muted)]">
            Site details for your portfolio — buildings and models live under this location.
          </p>
        </div>
      </div>

      <form
        id="location-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          onSubmit({
            name: form.name.trim(),
            code: form.code || null,
            address: form.address || null,
            city: form.city || null,
            country: form.country || null,
            notes: form.notes || null,
          });
        }}
      >
        <label className="block">
          <span className={MOBILE_FIELD_LABEL}>Location name *</span>
          <input
            className={MOBILE_FIELD_INPUT}
            value={form.name ?? ""}
            onChange={set("name")}
            placeholder="e.g. Downtown Campus"
            required
            autoFocus
          />
        </label>

        <label className="block">
          <span className={`${MOBILE_FIELD_LABEL} inline-flex items-center gap-1.5`}>
            <Hash className="h-3.5 w-3.5" aria-hidden />
            Code
          </span>
          <input
            className={MOBILE_FIELD_INPUT}
            value={form.code ?? ""}
            onChange={set("code")}
            placeholder="e.g. HQ, SITE-01"
          />
        </label>

        <label className="block">
          <span className={MOBILE_FIELD_LABEL}>Street address</span>
          <input
            className={MOBILE_FIELD_INPUT}
            value={form.address ?? ""}
            onChange={set("address")}
            placeholder="Street and number"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={MOBILE_FIELD_LABEL}>City</span>
            <input
              className={MOBILE_FIELD_INPUT}
              value={form.city ?? ""}
              onChange={set("city")}
              placeholder="City"
            />
          </label>
          <label className="block">
            <span className={MOBILE_FIELD_LABEL}>Country</span>
            <input
              className={MOBILE_FIELD_INPUT}
              value={form.country ?? ""}
              onChange={set("country")}
              placeholder="Country"
            />
          </label>
        </div>

        <label className="block">
          <span className={`${MOBILE_FIELD_LABEL} inline-flex items-center gap-1.5`}>
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            Notes
          </span>
          <textarea
            className={MOBILE_FIELD_TEXTAREA}
            value={form.notes ?? ""}
            onChange={set("notes")}
            placeholder="Optional notes for the owner or team"
            rows={3}
          />
        </label>
      </form>
    </EnterpriseResponsiveDialog>
  );
}
