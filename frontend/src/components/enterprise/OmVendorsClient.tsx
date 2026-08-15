"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterpriseInput } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseOverviewKpiTile } from "@/components/enterprise/EnterpriseOverviewKpiTile";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSectionCard } from "@/components/enterprise/OmSectionCard";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import {
  deleteOmVendor,
  fetchOmVendors,
  patchOmVendor,
  postOmVendor,
  ProRequiredError,
  type OmVendorRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type VendorFilter = "ALL" | "WITH_EMAIL" | "WITH_TRADE" | "MISSING_CONTACT";

type Props = { projectId: string };

export const vendorFormSchema = z.object({
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  name: z.string().trim().min(1, "Enter a company name."),
  trade: z.string(),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

const VENDOR_FORM_DEFAULTS: VendorFormValues = { email: "", name: "", trade: "" };

function VendorFormFields({ tradeClassName }: { tradeClassName?: string }) {
  return (
    <>
      <EnterpriseFormField<VendorFormValues> name="name" label="Company name" required>
        {({ describedBy, field, id, invalid }) => (
          <EnterpriseInput
            {...field}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </EnterpriseFormField>
      <EnterpriseFormField<VendorFormValues> name="email" label="Email">
        {({ describedBy, field, id, invalid }) => (
          <EnterpriseInput
            {...field}
            id={id}
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            placeholder="vendor@company.com"
          />
        )}
      </EnterpriseFormField>
      <div className={tradeClassName}>
        <EnterpriseFormField<VendorFormValues> name="trade" label="Trade">
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseInput
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="HVAC, electrical, plumbing…"
            />
          )}
        </EnterpriseFormField>
      </div>
    </>
  );
}

function VendorEditForm({
  vendor,
  onCancel,
  onSave,
  saving,
}: {
  vendor: OmVendorRow;
  onCancel: () => void;
  onSave: (values: VendorFormValues) => void;
  saving: boolean;
}) {
  const form = useEnterpriseForm(vendorFormSchema, {
    email: vendor.email ?? "",
    name: vendor.name,
    trade: vendor.trade ?? "",
  });

  return (
    <li className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-2.5 sm:p-3">
      <EnterpriseForm
        form={form}
        density="compact"
        onSubmit={onSave}
        className="grid gap-2 sm:grid-cols-2"
      >
        <VendorFormFields />
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <EnterpriseButton type="submit" size="sm" loading={saving}>
            Save changes
          </EnterpriseButton>
          <EnterpriseButton type="button" size="sm" variant="secondary" onClick={onCancel}>
            <X className="h-4 w-4" aria-hidden />
            Cancel
          </EnterpriseButton>
        </div>
      </EnterpriseForm>
    </li>
  );
}

function VendorListCard({
  vendor,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  saving,
}: {
  vendor: OmVendorRow;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (values: VendorFormValues) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  if (editing) {
    return (
      <VendorEditForm
        key={vendor.id}
        vendor={vendor}
        onCancel={onCancelEdit}
        onSave={onSave}
        saving={saving}
      />
    );
  }

  const subtitle =
    vendor.email ??
    vendor.phone ??
    (vendor.trade && !vendor.email ? vendor.trade : null) ??
    "No contact details";

  return (
    <li className="flex items-center gap-2.5 border-l-[3px] border-l-[var(--enterprise-primary)] bg-[var(--enterprise-surface)] px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
        aria-hidden
      >
        <Building2 className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
            {vendor.name}
          </p>
          {vendor.trade ? (
            <span className="hidden shrink-0 rounded-md border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-1.5 py-px text-[10px] font-semibold text-[var(--enterprise-semantic-info-text)] sm:inline-flex">
              {vendor.trade}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] text-[var(--enterprise-text-muted)]">
          {vendor.email ? <Mail className="h-3 w-3 shrink-0 opacity-70" aria-hidden /> : null}
          <span className="truncate">{subtitle}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <EnterpriseButton
          size="sm"
          variant="ghost"
          className="!min-h-8 !px-2"
          onClick={onStartEdit}
          aria-label={`Edit ${vendor.name}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </EnterpriseButton>
        <EnterpriseButton
          size="sm"
          variant="ghost"
          className="!min-h-8 !px-2 text-[var(--enterprise-semantic-danger-text)]"
          onClick={onDelete}
          aria-label={`Delete ${vendor.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </EnterpriseButton>
      </div>
    </li>
  );
}

export function OmVendorsClient({ projectId }: Props) {
  const qc = useQueryClient();
  const createForm = useEnterpriseForm(vendorFormSchema, VENDOR_FORM_DEFAULTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VendorFilter>("ALL");

  const { data: vendors = [], isPending } = useQuery({
    queryKey: qk.omVendors(projectId),
    queryFn: () => fetchOmVendors(projectId),
  });

  const stats = useMemo(() => {
    let withEmail = 0;
    let withTrade = 0;
    let missingContact = 0;
    for (const v of vendors) {
      if (v.email?.trim()) withEmail += 1;
      if (v.trade?.trim()) withTrade += 1;
      if (!v.email?.trim() && !v.phone?.trim()) missingContact += 1;
    }
    return { total: vendors.length, withEmail, withTrade, missingContact };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    if (filter === "WITH_EMAIL") return vendors.filter((v) => Boolean(v.email?.trim()));
    if (filter === "WITH_TRADE") return vendors.filter((v) => Boolean(v.trade?.trim()));
    if (filter === "MISSING_CONTACT") {
      return vendors.filter((v) => !v.email?.trim() && !v.phone?.trim());
    }
    return vendors;
  }, [vendors, filter]);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.omVendors(projectId) });

  const createMut = useMutation({
    mutationFn: (values: VendorFormValues) =>
      postOmVendor(projectId, {
        name: values.name.trim(),
        email: values.email.trim() || undefined,
        trade: values.trade.trim() || undefined,
      }),
    onSuccess: async () => {
      createForm.reset(VENDOR_FORM_DEFAULTS);
      await invalidate();
      toast.success("Vendor added.");
    },
    onError: (e: Error) => toast.error(e instanceof ProRequiredError ? "Pro required." : e.message),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: VendorFormValues }) =>
      patchOmVendor(projectId, id, {
        name: values.name.trim(),
        email: values.email.trim() || null,
        trade: values.trade.trim() || null,
      }),
    onSuccess: async () => {
      setEditingId(null);
      await invalidate();
      toast.success("Vendor updated.");
    },
    onError: (e: Error) => toast.error(e instanceof ProRequiredError ? "Pro required." : e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOmVendor(projectId, id),
    onSuccess: async () => {
      if (editingId) setEditingId(null);
      await invalidate();
      toast.success("Vendor removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <EnterpriseLoadingState message="Loading vendors…" label="Loading" />;

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={Building2}
        title="Vendors"
        description="Contractors and external maintenance partners for work orders."
      />

      {vendors.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <EnterpriseOverviewKpiTile
            label="Total"
            value={stats.total}
            borderClass="border-l-[var(--enterprise-primary)]"
            active={filter === "ALL"}
            onClick={() => setFilter("ALL")}
          />
          <EnterpriseOverviewKpiTile
            label="With email"
            value={stats.withEmail}
            borderClass="border-l-[var(--enterprise-semantic-success-text)]"
            active={filter === "WITH_EMAIL"}
            onClick={() => setFilter("WITH_EMAIL")}
          />
          <EnterpriseOverviewKpiTile
            label="With trade"
            value={stats.withTrade}
            borderClass="border-l-[var(--enterprise-primary)]"
            active={filter === "WITH_TRADE"}
            onClick={() => setFilter("WITH_TRADE")}
          />
          <EnterpriseOverviewKpiTile
            label="No contact"
            value={stats.missingContact}
            borderClass={
              stats.missingContact > 0
                ? "border-l-[var(--enterprise-semantic-warning-text)]"
                : "border-l-[var(--enterprise-border)]"
            }
            hint="Missing email and phone"
            active={filter === "MISSING_CONTACT"}
            onClick={() => setFilter("MISSING_CONTACT")}
          />
        </div>
      ) : null}

      <OmSectionCard
        title="Add vendor"
        description="Used when assigning work orders or sending vendor portal links."
      >
        <EnterpriseForm
          form={createForm}
          density="compact"
          onSubmit={(values) => createMut.mutate(values)}
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
        >
          <VendorFormFields tradeClassName="sm:col-span-2 lg:col-span-1" />
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <EnterpriseButton
              type="submit"
              size="sm"
              loading={createMut.isPending}
              className="w-full lg:w-auto"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </EnterpriseButton>
          </div>
        </EnterpriseForm>
      </OmSectionCard>

      {vendors.length === 0 ? (
        <OmEmptyState
          icon={Building2}
          title="No vendors yet"
          description="Add HVAC, electrical, or other contractors to assign on work orders and email magic links."
        />
      ) : (
        <OmSectionCard
          title="Vendor directory"
          description={
            filter === "ALL"
              ? `${vendors.length} partner${vendors.length === 1 ? "" : "s"} on this project`
              : `${filteredVendors.length} of ${vendors.length} shown`
          }
        >
          {filteredVendors.length === 0 ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              No vendors match this filter.{" "}
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className="font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                Clear filter
              </button>
            </p>
          ) : (
            <ul className="divide-y divide-[var(--enterprise-border)]/80 overflow-hidden rounded-lg border border-[var(--enterprise-border)]">
              {filteredVendors.map((v) => (
                <VendorListCard
                  key={v.id}
                  vendor={v}
                  editing={editingId === v.id}
                  onStartEdit={() => setEditingId(v.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(values) => patchMut.mutate({ id: v.id, values })}
                  onDelete={() => deleteMut.mutate(v.id)}
                  saving={patchMut.isPending}
                />
              ))}
            </ul>
          )}
        </OmSectionCard>
      )}
    </div>
  );
}
