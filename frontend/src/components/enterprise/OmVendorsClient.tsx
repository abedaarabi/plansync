"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
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
import { OM_COMPACT_INPUT, OM_COMPACT_LABEL, OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type Props = { projectId: string };

function VendorFormFields({
  name,
  email,
  trade,
  onName,
  onEmail,
  onTrade,
  idPrefix,
}: {
  name: string;
  email: string;
  trade: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onTrade: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-name`} className={OM_COMPACT_LABEL}>
          Company name *
        </label>
        <input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => onName(e.target.value)}
          className={OM_COMPACT_INPUT}
          required
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-email`} className={OM_COMPACT_LABEL}>
          Email
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          className={OM_COMPACT_INPUT}
          placeholder="vendor@company.com"
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor={`${idPrefix}-trade`} className={OM_COMPACT_LABEL}>
          Trade
        </label>
        <input
          id={`${idPrefix}-trade`}
          value={trade}
          onChange={(e) => onTrade(e.target.value)}
          className={OM_COMPACT_INPUT}
          placeholder="HVAC, electrical, plumbing…"
        />
      </div>
    </>
  );
}

function VendorListCard({
  vendor,
  editing,
  editName,
  editEmail,
  editTrade,
  onEditName,
  onEditEmail,
  onEditTrade,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  saving,
}: {
  vendor: OmVendorRow;
  editing: boolean;
  editName: string;
  editEmail: string;
  editTrade: string;
  onEditName: (v: string) => void;
  onEditEmail: (v: string) => void;
  onEditTrade: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  if (editing) {
    return (
      <li className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-2.5 sm:p-3">
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <VendorFormFields
            idPrefix={`vendor-edit-${vendor.id}`}
            name={editName}
            email={editEmail}
            trade={editTrade}
            onName={onEditName}
            onEmail={onEditEmail}
            onTrade={onEditTrade}
          />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <EnterpriseButton type="submit" size="sm" loading={saving}>
              Save changes
            </EnterpriseButton>
            <EnterpriseButton type="button" size="sm" variant="secondary" onClick={onCancelEdit}>
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </EnterpriseButton>
          </div>
        </form>
      </li>
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [trade, setTrade] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTrade, setEditTrade] = useState("");

  const { data: vendors = [], isPending } = useQuery({
    queryKey: qk.omVendors(projectId),
    queryFn: () => fetchOmVendors(projectId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.omVendors(projectId) });

  const createMut = useMutation({
    mutationFn: () =>
      postOmVendor(projectId, {
        name: name.trim(),
        email: email.trim() || undefined,
        trade: trade.trim() || undefined,
      }),
    onSuccess: async () => {
      setName("");
      setEmail("");
      setTrade("");
      await invalidate();
      toast.success("Vendor added.");
    },
    onError: (e: Error) => toast.error(e instanceof ProRequiredError ? "Pro required." : e.message),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof patchOmVendor>[2] }) =>
      patchOmVendor(projectId, id, body),
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

  function startEdit(v: OmVendorRow) {
    setEditingId(v.id);
    setEditName(v.name);
    setEditEmail(v.email ?? "");
    setEditTrade(v.trade ?? "");
  }

  if (isPending) return <EnterpriseLoadingState message="Loading vendors…" label="Loading" />;

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={Building2}
        title="Vendors"
        description="Contractors and external maintenance partners for work orders."
      />

      <OmSectionCard
        title="Add vendor"
        description="Used when assigning work orders or sending vendor portal links."
      >
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createMut.mutate();
          }}
        >
          <VendorFormFields
            idPrefix="vendor-create"
            name={name}
            email={email}
            trade={trade}
            onName={setName}
            onEmail={setEmail}
            onTrade={setTrade}
          />
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
        </form>
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
          description={`${vendors.length} partner${vendors.length === 1 ? "" : "s"} on this project`}
        >
          <ul className="divide-y divide-[var(--enterprise-border)]/80 overflow-hidden rounded-lg border border-[var(--enterprise-border)]">
            {vendors.map((v) => (
              <VendorListCard
                key={v.id}
                vendor={v}
                editing={editingId === v.id}
                editName={editName}
                editEmail={editEmail}
                editTrade={editTrade}
                onEditName={setEditName}
                onEditEmail={setEditEmail}
                onEditTrade={setEditTrade}
                onStartEdit={() => startEdit(v)}
                onCancelEdit={() => setEditingId(null)}
                onSave={() => {
                  if (!editName.trim()) return;
                  patchMut.mutate({
                    id: v.id,
                    body: {
                      name: editName.trim(),
                      email: editEmail.trim() || null,
                      trade: editTrade.trim() || null,
                    },
                  });
                }}
                onDelete={() => deleteMut.mutate(v.id)}
                saving={patchMut.isPending}
              />
            ))}
          </ul>
        </OmSectionCard>
      )}
    </div>
  );
}
