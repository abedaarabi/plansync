"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Package, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  IssueReferencePhotosField,
  type IssuePendingPhoto,
} from "@/components/enterprise/IssueReferencePhotosField";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { WorkOrderAssetDocsPanel } from "@/components/enterprise/WorkOrderAssetDocsPanel";
import { WorkOrderProcedureField } from "@/components/enterprise/WorkOrderProcedureField";
import {
  createIssue,
  fetchOmAssets,
  fetchOmVendors,
  formatIssueLockHint,
  ProRequiredError,
  uploadIssueReferencePhotoFile,
  type IssueRow,
  type OmAssetRow,
  type WorkOrderChecklistItem,
} from "@/lib/api-client";
import { projectScopedHref } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
} from "@/lib/issueStatusStyle";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
type WorkspaceMember = { userId: string; name: string | null; email: string | null };

const WO_TYPES = [
  { value: "CORRECTIVE", label: "Corrective" },
  { value: "PREVENTIVE", label: "Preventive" },
  { value: "INSPECTION_FOLLOWUP", label: "Inspection follow-up" },
  { value: "TENANT", label: "Tenant" },
] as const;

function revokePendingPhotos(list: IssuePendingPhoto[]) {
  for (const p of list) URL.revokeObjectURL(p.previewUrl);
}

export function formatOmAssetLocation(a: OmAssetRow): string {
  const parts = [a.hall, a.rowLabel, a.rack, a.positionU].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  if (parts.length > 0) return parts.join(" / ");
  return a.locationLabel?.trim() || "";
}

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string | undefined;
  members: WorkspaceMember[];
  initialAssetId?: string;
  /** Prefill from tenant request */
  prefill?: {
    title?: string;
    description?: string;
    location?: string;
    assetId?: string;
    sourceOccupantIssueId?: string;
    workOrderType?: string;
  };
  onCreated: (row: IssueRow) => void | Promise<void>;
};

export function WorkOrderCreateSlideOver({
  open,
  onClose,
  projectId,
  workspaceId,
  members,
  initialAssetId,
  prefill,
  onCreated,
}: Props) {
  const [assetId, setAssetId] = useState("");
  const [workOrderType, setWorkOrderType] = useState("CORRECTIVE");
  const [vendorId, setVendorId] = useState("");
  const [procedure, setProcedure] = useState<WorkOrderChecklistItem[]>([]);
  const [completionEvidenceRequired, setCompletionEvidenceRequired] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  const [locationTouched, setLocationTouched] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<IssuePendingPhoto[]>([]);

  const reset = useCallback(() => {
    setPendingPhotos((prev) => {
      revokePendingPhotos(prev);
      return [];
    });
    setAssetId(prefill?.assetId ?? initialAssetId ?? "");
    setAssetSearch("");
    setTitle(prefill?.title ?? "");
    setDescription(prefill?.description ?? "");
    setWorkOrderType(prefill?.workOrderType ?? "CORRECTIVE");
    setVendorId("");
    setProcedure([]);
    setCompletionEvidenceRequired(false);
    setAssigneeId("");
    setVendorName("");
    setVendorEmail("");
    setStatus("OPEN");
    setPriority("MEDIUM");
    setStartDate("");
    setDueDate("");
    setLocation(prefill?.location ?? "");
    setLocationTouched(Boolean(prefill?.location));
    setMsg(null);
  }, [initialAssetId, prefill]);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  useEffect(() => {
    if (open) {
      setAssetId(prefill?.assetId ?? initialAssetId ?? "");
      setTitle(prefill?.title ?? "");
      setDescription(prefill?.description ?? "");
      setLocation(prefill?.location ?? "");
      setWorkOrderType(prefill?.workOrderType ?? "CORRECTIVE");
      setLocationTouched(Boolean(prefill?.location));
    }
  }, [open, initialAssetId, prefill]);

  const { data: vendors = [] } = useQuery({
    queryKey: qk.omVendors(projectId),
    queryFn: () => fetchOmVendors(projectId),
    enabled: open,
  });

  const { data: assets = [], isPending: assetsPending } = useQuery({
    queryKey: qk.omAssets(projectId, assetSearch),
    queryFn: () => fetchOmAssets(projectId, { q: assetSearch }),
    enabled: open,
  });

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const hay = [a.tag, a.name, a.category, a.locationLabel, a.manufacturer, a.model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [assets, assetSearch]);

  const selectedAsset = assets.find((a) => a.id === assetId) ?? null;

  useEffect(() => {
    if (!selectedAsset || locationTouched) return;
    const loc = formatOmAssetLocation(selectedAsset);
    if (loc) setLocation(loc);
  }, [selectedAsset, locationTouched]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Missing workspace.");
      if (!assetId) throw new Error("Select an asset for this work order.");
      return createIssue({
        workspaceId,
        projectId,
        assetId,
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId || undefined,
        externalAssigneeName: vendorName.trim() || undefined,
        externalAssigneeEmail: vendorEmail.trim() || undefined,
        status,
        priority,
        startDate: startDate.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        location: location.trim() || undefined,
        issueKind: "WORK_ORDER",
        workOrderType,
        procedureJson: procedure.length > 0 ? procedure : undefined,
        vendorId: vendorId || undefined,
        sourceOccupantIssueId: prefill?.sourceOccupantIssueId,
        completionEvidenceRequired,
      });
    },
    onSuccess: async (row) => {
      const pending = [...pendingPhotos];
      if (pending.length > 0) {
        try {
          for (const p of pending) {
            await uploadIssueReferencePhotoFile(row.id, p.file);
          }
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Work order created but some photos failed to upload.",
          );
        }
        revokePendingPhotos(pending);
      }
      await onCreated(row);
      handleClose();
      toast.success("Work order created.");
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e);
      setMsg(text);
      toast.error(text);
    },
  });

  const assetsHref = projectScopedHref(projectId, "/om/assets", workspaceId);

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={handleClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!title.trim() || !assetId) return;
          createMut.mutate();
        },
      }}
      ariaLabelledBy="wo-create-title"
      panelMaxWidthClass="max-w-[min(calc(100dvw-16px),560px)]"
      bodyClassName="px-5 py-5"
      header={
        <div className="flex items-start gap-3 pr-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
            <Wrench className="h-5 w-5 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label text-[var(--enterprise-primary)]">O&amp;M</p>
            <h2
              id="wo-create-title"
              className="text-lg font-bold tracking-tight text-[var(--enterprise-text)]"
            >
              New work order
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--enterprise-text-muted)]">
              Maintenance or repair tied to project equipment. Asset and title required.
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="submit"
            loading={createMut.isPending}
            disabled={!title.trim() || !assetId}
          >
            {createMut.isPending ? "Creating…" : "Create work order"}
          </EnterpriseButton>
        </>
      }
    >
      <div className="space-y-4">
        {msg ? (
          <div
            className="rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-3 py-2 text-sm text-[var(--enterprise-semantic-danger-text)]"
            role="alert"
          >
            {msg}
          </div>
        ) : null}

        <div
          className={`${MOBILE_FORM_SECTION} rounded-xl border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] p-3`}
        >
          <p className="enterprise-type-label text-[var(--enterprise-semantic-info-text)]">
            Equipment
          </p>
          <div>
            <label htmlFor="wo-asset-search" className={MOBILE_FIELD_LABEL}>
              Search assets
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
                aria-hidden
              />
              <input
                id="wo-asset-search"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className={`${MOBILE_FIELD_INPUT} pl-9`}
                placeholder="Tag, name, location…"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label htmlFor="wo-asset" className={MOBILE_FIELD_LABEL}>
              Asset *
            </label>
            {assetsPending ? (
              <p className="text-sm text-[var(--enterprise-text-muted)]">Loading assets…</p>
            ) : filteredAssets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--enterprise-border)] px-3 py-4 text-center">
                <Package
                  className="mx-auto h-8 w-8 text-[var(--enterprise-text-muted)]"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                  {assets.length === 0
                    ? "No assets on this project yet."
                    : "No assets match your search."}
                </p>
                {assets.length === 0 ? (
                  <Link
                    href={assetsHref}
                    className="mt-2 inline-block text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
                  >
                    Add assets in O&amp;M
                  </Link>
                ) : null}
              </div>
            ) : (
              <select
                id="wo-asset"
                value={assetId}
                onChange={(e) => {
                  setAssetId(e.target.value);
                  setLocationTouched(false);
                }}
                className={MOBILE_FIELD_SELECT}
                required
              >
                <option value="">Select equipment…</option>
                {filteredAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.tag} — {a.name}
                    {a.category ? ` (${a.category})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedAsset ? (
            <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 text-xs text-[var(--enterprise-text-muted)]">
              <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                {selectedAsset.tag}
              </span>
              {" · "}
              {selectedAsset.name}
              {selectedAsset.manufacturer || selectedAsset.model ? (
                <>
                  <br />
                  {[selectedAsset.manufacturer, selectedAsset.model].filter(Boolean).join(" · ")}
                </>
              ) : null}
              {formatOmAssetLocation(selectedAsset) ? (
                <>
                  <br />
                  Location: {formatOmAssetLocation(selectedAsset)}
                </>
              ) : null}
            </div>
          ) : null}
          {selectedAsset ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Asset manuals
              </p>
              <WorkOrderAssetDocsPanel
                projectId={projectId}
                assetId={selectedAsset.id}
                enabled={open}
              />
            </div>
          ) : null}
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Work scope</p>
          <div>
            <label htmlFor="wo-type" className={MOBILE_FIELD_LABEL}>
              Work order type
            </label>
            <select
              id="wo-type"
              value={workOrderType}
              onChange={(e) => setWorkOrderType(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              {WO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wo-title" className={MOBILE_FIELD_LABEL}>
              Work order title *
            </label>
            <input
              id="wo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
              placeholder="e.g. Replace air filter unit AHU-2"
            />
          </div>
          <div>
            <label htmlFor="wo-description" className={MOBILE_FIELD_LABEL}>
              Scope / execution notes
            </label>
            <textarea
              id="wo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={MOBILE_FIELD_TEXTAREA}
              placeholder="Steps, parts needed, safety notes…"
            />
          </div>
          <div>
            <label htmlFor="wo-location" className={MOBILE_FIELD_LABEL}>
              Work location
            </label>
            <input
              id="wo-location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setLocationTouched(true);
              }}
              className={MOBILE_FIELD_INPUT}
              placeholder="Filled from asset when selected"
            />
          </div>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Site photos</p>
          <IssueReferencePhotosField
            issueId={null}
            photos={[]}
            onPhotosChange={() => {}}
            pendingPhotos={pendingPhotos}
            onPendingPhotosChange={setPendingPhotos}
            disabled={createMut.isPending}
          />
        </div>

        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <p className="enterprise-type-label col-span-full text-[var(--enterprise-text-muted)]">
            Execution
          </p>
          <div>
            <label htmlFor="wo-status" className={MOBILE_FIELD_LABEL}>
              Status
            </label>
            <select
              id="wo-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              {ISSUE_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wo-priority" className={MOBILE_FIELD_LABEL}>
              Priority
            </label>
            <select
              id="wo-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              {ISSUE_PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {ISSUE_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wo-assignee" className={MOBILE_FIELD_LABEL}>
              Assigned technician
            </label>
            <select
              id="wo-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email || m.userId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wo-vendor-pick" className={MOBILE_FIELD_LABEL}>
              Vendor directory
            </label>
            <select
              id="wo-vendor-pick"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              <option value="">None</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.trade ? ` (${v.trade})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wo-vendor-name" className={MOBILE_FIELD_LABEL}>
              External vendor (manual)
            </label>
            <input
              id="wo-vendor-name"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              placeholder="If not in directory"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="wo-vendor-email" className={MOBILE_FIELD_LABEL}>
              Vendor email
            </label>
            <input
              id="wo-vendor-email"
              type="email"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              placeholder="Optional — for external assignee"
            />
          </div>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            Completion checklist
          </p>
          <WorkOrderProcedureField items={procedure} onChange={setProcedure} />
          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--enterprise-text)]">
            <input
              type="checkbox"
              checked={completionEvidenceRequired}
              onChange={(e) => setCompletionEvidenceRequired(e.target.checked)}
            />
            Require completion photo before closing
          </label>
        </div>

        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <p className="enterprise-type-label col-span-full text-[var(--enterprise-text-muted)]">
            Schedule
          </p>
          <div>
            <label htmlFor="wo-start" className={MOBILE_FIELD_LABEL}>
              Planned start
            </label>
            <input
              id="wo-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="wo-due" className={MOBILE_FIELD_LABEL}>
              Target completion
            </label>
            <input
              id="wo-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}
