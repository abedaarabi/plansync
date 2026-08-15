"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { z } from "zod";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterpriseTextarea,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import type { LocationInput, LocationSummary } from "@/lib/api-client/locations";
import { geocodeLocationName } from "@/lib/openMeteoGeocode";
import { parseCoord } from "@/lib/projectGeo";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { ProjectLocationMap } from "@/components/enterprise/ProjectLocationMap";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: LocationSummary | null;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (input: LocationInput) => void;
};

const locationFormSchema = z.object({
  address: z.string(),
  city: z.string(),
  code: z.string(),
  country: z.string(),
  name: z.string().trim().min(1, "Enter a location name."),
  notes: z.string(),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;
type MapPin = { latitude: number; longitude: number } | null;

const EMPTY_FORM: LocationFormValues = {
  name: "",
  code: "",
  address: "",
  city: "",
  country: "",
  notes: "",
};

function placeQuery(form: Pick<LocationFormValues, "address" | "city" | "country">): string {
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
  const form = useEnterpriseForm(locationFormSchema, EMPTY_FORM);
  const [mapPin, setMapPin] = useState<MapPin>(null);
  const [geocodingLocation, setGeocodingLocation] = useState(false);
  const manualPinRef = useRef(false);
  const mapPinRef = useRef(mapPin);
  mapPinRef.current = mapPin;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (!open) return;
    manualPinRef.current = false;
    if (mode === "edit" && initial) {
      form.reset({
        name: initial.name,
        code: initial.code ?? "",
        address: initial.address ?? "",
        city: initial.city ?? "",
        country: initial.country ?? "",
        notes: initial.notes ?? "",
      });
      const latitude = parseCoord(initial.latitude);
      const longitude = parseCoord(initial.longitude);
      setMapPin(latitude != null && longitude != null ? { latitude, longitude } : null);
    } else {
      form.reset(EMPTY_FORM);
      setMapPin(null);
    }
  }, [form, initial, mode, open]);

  const [address, city, country] = form.watch(["address", "city", "country"]);
  const placeLine = placeQuery({ address, city, country });

  useEffect(() => {
    if (!open) return;
    const q = placeLine.trim();
    if (!q) {
      if (!manualPinRef.current) {
        setMapPin(null);
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
      if (
        q === initQ &&
        slat != null &&
        slng != null &&
        mapPinRef.current?.latitude != null &&
        mapPinRef.current?.longitude != null &&
        Math.abs(mapPinRef.current.latitude - slat) < 1e-5 &&
        Math.abs(mapPinRef.current.longitude - slng) < 1e-5
      ) {
        return;
      }
    }

    const t = window.setTimeout(() => {
      const latest = placeQuery(form.getValues()).trim();
      if (!latest || manualPinRef.current) return;
      setGeocodingLocation(true);
      void (async () => {
        try {
          const geo = await geocodeLocationName(latest);
          if (!geo || manualPinRef.current) return;
          if (placeQuery(form.getValues()).trim() !== latest) return;
          setMapPin({ latitude: geo.lat, longitude: geo.lng });
        } finally {
          setGeocodingLocation(false);
        }
      })();
    }, 550);

    return () => window.clearTimeout(t);
  }, [form, mode, open, placeLine]);

  const handleSubmit = (values: LocationFormValues) => {
    onSubmit({
      name: values.name.trim(),
      code: values.code || null,
      address: values.address || null,
      city: values.city || null,
      country: values.country || null,
      latitude: mapPin?.latitude ?? null,
      longitude: mapPin?.longitude ?? null,
      notes: values.notes || null,
    });
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
          <EnterpriseButton
            type="submit"
            form="location-form"
            variant="primary"
            size="md"
            fullWidth
            loading={isSaving}
            className="max-lg:min-h-[52px] sm:w-auto"
          >
            {isSaving ? "Saving…" : mode === "create" ? "Create location" : "Save changes"}
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            disabled={isSaving}
            onClick={onClose}
            className="max-lg:min-h-[52px] sm:w-auto"
          >
            Cancel
          </EnterpriseButton>
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

      <EnterpriseForm
        form={form}
        density="mobile"
        id="location-form"
        className="space-y-3"
        onSubmit={handleSubmit}
      >
        <EnterpriseFormField<LocationFormValues> name="name" label="Location name" required>
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseInput
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="e.g. Downtown Campus"
              autoFocus
            />
          )}
        </EnterpriseFormField>

        <EnterpriseFormField<LocationFormValues> name="code" label="Code">
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseInput
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="e.g. HQ, SITE-01"
            />
          )}
        </EnterpriseFormField>

        <EnterpriseFormField<LocationFormValues> name="address" label="Street address">
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseInput
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="Street and number (optional)"
              onChange={(event) => {
                manualPinRef.current = false;
                field.onChange(event);
              }}
            />
          )}
        </EnterpriseFormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <EnterpriseFormField<LocationFormValues> name="city" label="City">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="City"
                onChange={(event) => {
                  manualPinRef.current = false;
                  field.onChange(event);
                }}
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<LocationFormValues> name="country" label="Country">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="Country"
                onChange={(event) => {
                  manualPinRef.current = false;
                  field.onChange(event);
                }}
              />
            )}
          </EnterpriseFormField>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="enterprise-field-label mb-0">Map pin (optional)</p>
            {mapPin ? (
              <button
                type="button"
                className="text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
                onClick={() => {
                  manualPinRef.current = false;
                  setMapPin(null);
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
            latitude={mapPin?.latitude ?? 39.8283}
            longitude={mapPin?.longitude ?? -98.5795}
            zoom={mapPin ? 14 : 4}
            showMarker={Boolean(mapPin)}
            onPick={(lat, lng) => {
              manualPinRef.current = true;
              setMapPin({ latitude: lat, longitude: lng });
            }}
          />
        </div>

        <EnterpriseFormField<LocationFormValues> name="notes" label="Notes">
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseTextarea
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="Optional notes for the owner or team"
              rows={3}
            />
          )}
        </EnterpriseFormField>
      </EnterpriseForm>
    </EnterpriseResponsiveDialog>
  );
}
