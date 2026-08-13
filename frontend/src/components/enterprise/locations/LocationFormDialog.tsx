"use client";

import { useEffect, useRef, useState } from "react";
import { Hash, MapPin, StickyNote } from "lucide-react";
import type { LocationInput, LocationSummary } from "@/lib/api-client/locations";
import { geocodeLocationName } from "@/lib/openMeteoGeocode";
import { parseCoord } from "@/lib/projectGeo";
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
import { ProjectLocationMap } from "@/components/enterprise/ProjectLocationMap";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: LocationSummary | null;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (input: LocationInput) => void;
};

type FormState = {
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
};

const empty: FormState = {
  name: "",
  code: "",
  address: "",
  city: "",
  country: "",
  notes: "",
  latitude: null,
  longitude: null,
};

function placeQuery(form: Pick<FormState, "address" | "city" | "country">): string {
  return [form.address, form.city, form.country]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
}

// fallow-ignore-next-line complexity
export function LocationFormDialog({
  open,
  mode,
  initial,
  isSaving = false,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [geocodingLocation, setGeocodingLocation] = useState(false);
  const manualPinRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (!open) return;
    manualPinRef.current = false;
    if (mode === "edit" && initial) {
      setForm({
        name: initial.name,
        code: initial.code ?? "",
        address: initial.address ?? "",
        city: initial.city ?? "",
        country: initial.country ?? "",
        notes: initial.notes ?? "",
        latitude: parseCoord(initial.latitude),
        longitude: parseCoord(initial.longitude),
      });
    } else {
      setForm(empty);
    }
  }, [open, mode, initial]);

  const placeLine = placeQuery(form);

  useEffect(() => {
    if (!open) return;
    const q = placeLine.trim();
    if (!q) {
      if (!manualPinRef.current) {
        setForm((prev) =>
          prev.latitude == null && prev.longitude == null
            ? prev
            : { ...prev, latitude: null, longitude: null },
        );
      }
      setGeocodingLocation(false);
      return;
    }
    if (manualPinRef.current) return;

    const init = initialRef.current;
    if (mode === "edit" && init) {
      const initQ = placeQuery({
        address: init.address ?? "",
        city: init.city ?? "",
        country: init.country ?? "",
      });
      const slat = parseCoord(init.latitude);
      const slng = parseCoord(init.longitude);
      const curLat = formRef.current.latitude;
      const curLng = formRef.current.longitude;
      if (
        q === initQ &&
        slat != null &&
        slng != null &&
        curLat != null &&
        curLng != null &&
        Math.abs(curLat - slat) < 1e-5 &&
        Math.abs(curLng - slng) < 1e-5
      ) {
        return;
      }
    }

    const t = window.setTimeout(() => {
      const latest = placeQuery(formRef.current).trim();
      if (!latest || manualPinRef.current) return;
      setGeocodingLocation(true);
      void (async () => {
        try {
          const geo = await geocodeLocationName(latest);
          if (!geo || manualPinRef.current) return;
          if (placeQuery(formRef.current).trim() !== latest) return;
          setForm((prev) => ({ ...prev, latitude: geo.lat, longitude: geo.lng }));
        } finally {
          setGeocodingLocation(false);
        }
      })();
    }, 550);

    return () => window.clearTimeout(t);
  }, [open, mode, placeLine]);

  const set =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (key === "address" || key === "city" || key === "country") {
        manualPinRef.current = false;
      }
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
          const pinSet = form.latitude != null && form.longitude != null;
          onSubmit({
            name: form.name.trim(),
            code: form.code || null,
            address: form.address || null,
            city: form.city || null,
            country: form.country || null,
            latitude: pinSet ? form.latitude : null,
            longitude: pinSet ? form.longitude : null,
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
            placeholder="Street and number (optional)"
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

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={MOBILE_FIELD_LABEL}>Map pin (optional)</p>
            {form.latitude != null && form.longitude != null ? (
              <button
                type="button"
                className="text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
                onClick={() => {
                  manualPinRef.current = false;
                  setForm((prev) => ({ ...prev, latitude: null, longitude: null }));
                }}
              >
                Clear pin
              </button>
            ) : null}
          </div>
          <p className="text-xs leading-snug text-[var(--enterprise-text-muted)]">
            {geocodingLocation
              ? "Looking up address…"
              : "Pin updates from the address above, or click the map to place it."}
          </p>
          <ProjectLocationMap
            height={200}
            latitude={form.latitude ?? 39.8283}
            longitude={form.longitude ?? -98.5795}
            zoom={form.latitude != null && form.longitude != null ? 14 : 4}
            showMarker={form.latitude != null && form.longitude != null}
            onPick={(lat, lng) => {
              manualPinRef.current = true;
              setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
            }}
          />
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
