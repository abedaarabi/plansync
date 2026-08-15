"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  IssueReferencePhotosField,
  type IssuePendingPhoto,
} from "@/components/enterprise/IssueReferencePhotosField";
import {
  WorkOrderAssetFields,
  formatOmAssetLocation,
} from "@/components/enterprise/WorkOrderAssetFields";
import { WorkOrderAssetDocsPanel } from "@/components/enterprise/WorkOrderAssetDocsPanel";
import {
  WorkOrderLocationFields,
  type WorkOrderLocationValue,
} from "@/components/enterprise/WorkOrderLocationFields";
import { WorkOrderProcedureField } from "@/components/enterprise/WorkOrderProcedureField";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterpriseSelect,
  EnterpriseTextarea,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import {
  createIssue,
  fetchOmAssets,
  fetchOmVendors,
  fetchOmWorkspaceWorkOrderTemplates,
  formatIssueLockHint,
  ProRequiredError,
  uploadIssueReferencePhotoFile,
  type IssueRow,
  type WorkOrderChecklistItem,
  type WorkspaceWorkOrderTemplateRow,
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
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { filterOmAssetsBySearch } from "@/lib/filterOmAssetsBySearch";

type WorkspaceMember = { userId: string; name: string | null; email: string | null };

const WO_TYPES = [
  { value: "CORRECTIVE", label: "Corrective" },
  { value: "PREVENTIVE", label: "Preventive" },
  { value: "INSPECTION_FOLLOWUP", label: "Inspection follow-up" },
  { value: "TENANT", label: "Tenant" },
] as const;

export const workOrderCreateSchema = z.object({
  description: z.string(),
  title: z.string().trim().min(1, "Enter a work order title."),
});

type WorkOrderCreateValues = z.infer<typeof workOrderCreateSchema>;

function revokePendingPhotos(list: IssuePendingPhoto[]) {
  for (const p of list) URL.revokeObjectURL(p.previewUrl);
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

// fallow-ignore-next-line complexity
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
  const form = useEnterpriseForm(workOrderCreateSchema, { description: "", title: "" });
  const [assetId, setAssetId] = useState("");
  const [workOrderType, setWorkOrderType] = useState("CORRECTIVE");
  const [vendorId, setVendorId] = useState("");
  const [procedure, setProcedure] = useState<WorkOrderChecklistItem[]>([]);
  const [completionEvidenceRequired, setCompletionEvidenceRequired] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [locValue, setLocValue] = useState<WorkOrderLocationValue>({
    buildingId: "",
    levelId: "",
    location: "",
  });
  const [locationTouched, setLocationTouched] = useState(false);
  const [structureTouched, setStructureTouched] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<IssuePendingPhoto[]>([]);
  const [templateId, setTemplateId] = useState("");

  const reset = useCallback(() => {
    setPendingPhotos((prev) => {
      revokePendingPhotos(prev);
      return [];
    });
    setAssetId(prefill?.assetId ?? initialAssetId ?? "");
    setAssetSearch("");
    form.reset({ title: prefill?.title ?? "" });
    form.setValue("description", prefill?.description ?? "");
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
    setLocValue({
      buildingId: "",
      levelId: "",
      location: prefill?.location ?? "",
    });
    setLocationTouched(Boolean(prefill?.location));
    setStructureTouched(false);
    setTemplateId("");
    setMsg(null);
  }, [form, initialAssetId, prefill]);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  useEffect(() => {
    if (open) {
      setAssetId(prefill?.assetId ?? initialAssetId ?? "");
      form.reset({ title: prefill?.title ?? "" });
      form.setValue("description", prefill?.description ?? "");
      setLocValue({
        buildingId: "",
        levelId: "",
        location: prefill?.location ?? "",
      });
      setWorkOrderType(prefill?.workOrderType ?? "CORRECTIVE");
      setLocationTouched(Boolean(prefill?.location));
      setStructureTouched(false);
    }
  }, [form, open, initialAssetId, prefill]);

  const { data: vendors = [] } = useQuery({
    queryKey: qk.omVendors(projectId),
    queryFn: () => fetchOmVendors(projectId),
    enabled: open,
  });

  const { data: companyTemplates = [] } = useQuery({
    queryKey: qk.omWorkspaceWorkOrderTemplates(workspaceId ?? ""),
    queryFn: () => fetchOmWorkspaceWorkOrderTemplates(workspaceId!),
    enabled: open && Boolean(workspaceId),
  });

  const { data: assets = [], isPending: assetsPending } = useQuery({
    queryKey: qk.omAssets(projectId, assetSearch),
    queryFn: () => fetchOmAssets(projectId, { q: assetSearch }),
    enabled: open,
  });

  function applyCompanyTemplate(tpl: WorkspaceWorkOrderTemplateRow) {
    setTemplateId(tpl.id);
    setWorkOrderType(tpl.workOrderType || "CORRECTIVE");
    if (tpl.priority) setPriority(tpl.priority);
    const steps = Array.isArray(tpl.procedureJson)
      ? tpl.procedureJson.map((item) => ({
          id: item.id,
          label: item.label,
          type: item.type ?? ("checkbox" as const),
          required: item.required,
        }))
      : [];
    setProcedure(steps);
    form.setValue(
      "title",
      (() => {
        const prev = form.getValues("title");
        const trimmed = prev.trim();
        if (!trimmed) return tpl.name;
        if (trimmed.startsWith(`${tpl.name}:`) || trimmed.startsWith(`${tpl.name} —`)) return prev;
        return `${tpl.name}: ${trimmed}`;
      })(),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  const filteredAssets = useMemo(
    () => filterOmAssetsBySearch(assets, assetSearch),
    [assets, assetSearch],
  );

  const selectedAsset = assets.find((a) => a.id === assetId) ?? null;

  useEffect(() => {
    if (!selectedAsset) return;
    if (!locationTouched) {
      const loc = formatOmAssetLocation(selectedAsset);
      if (loc) {
        setLocValue((prev) => ({ ...prev, location: loc }));
      }
    }
    if (!structureTouched) {
      setLocValue((prev) => ({
        ...prev,
        buildingId: selectedAsset.buildingId ?? prev.buildingId,
        levelId: selectedAsset.levelId ?? prev.levelId,
      }));
    }
  }, [selectedAsset, locationTouched, structureTouched]);

  const createMut = useMutation({
    mutationFn: async (values: WorkOrderCreateValues) => {
      if (!workspaceId) throw new Error("Missing workspace.");
      return createIssue({
        workspaceId,
        projectId,
        assetId: assetId || null,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        assigneeId: assigneeId || undefined,
        externalAssigneeName: vendorName.trim() || undefined,
        externalAssigneeEmail: vendorEmail.trim() || undefined,
        status,
        priority,
        startDate: startDate.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        location: locValue.location.trim() || undefined,
        buildingId: locValue.buildingId || null,
        levelId: locValue.levelId || null,
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
        noValidate: true,
        onSubmit: form.handleSubmit((values) => createMut.mutate(values)),
      }}
      ariaLabelledBy="wo-create-title"
      header={
        <SlideOverHeader
          icon={ClipboardList}
          titleId="wo-create-title"
          title="New work order"
          description="Maintenance or repair work. Title required; asset and location optional."
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" size="sm" loading={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create work order"}
          </EnterpriseButton>
        </>
      }
    >
      <EnterpriseForm
        form={form}
        formId="work-order-create-form"
        onSubmit={(values) => createMut.mutate(values)}
        className="space-y-4"
      >
        {msg ? (
          <div
            className="rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-3 py-2 text-sm text-[var(--enterprise-semantic-danger-text)]"
            role="alert"
          >
            {msg}
          </div>
        ) : null}

        <div
          className={`${MOBILE_FORM_SECTION} rounded-md border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] p-3`}
        >
          <p className="enterprise-type-label text-[var(--enterprise-semantic-info-text)]">
            Equipment
          </p>
          <WorkOrderAssetFields
            idPrefix="wo"
            assets={assets}
            assetsPending={assetsPending}
            filteredAssets={filteredAssets}
            assetId={assetId}
            assetSearch={assetSearch}
            onAssetSearchChange={setAssetSearch}
            onAssetIdChange={(id) => {
              setAssetId(id);
              setLocationTouched(false);
              setStructureTouched(false);
            }}
            assetsHref={assetsHref}
          />
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
          {workspaceId && companyTemplates.length > 0 ? (
            <div>
              <label htmlFor="wo-company-template" className={MOBILE_FIELD_LABEL}>
                From company template
              </label>
              <EnterpriseSelect
                id="wo-company-template"
                value={templateId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setTemplateId("");
                    return;
                  }
                  const tpl = companyTemplates.find((t) => t.id === id);
                  if (tpl) applyCompanyTemplate(tpl);
                }}
              >
                <option value="">None — start blank</option>
                {companyTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.workOrderType
                      ? ` (${t.workOrderType.replaceAll("_", " ").toLowerCase()})`
                      : ""}
                  </option>
                ))}
              </EnterpriseSelect>
            </div>
          ) : null}
          <div>
            <label htmlFor="wo-type" className={MOBILE_FIELD_LABEL}>
              Work order type
            </label>
            <EnterpriseSelect
              id="wo-type"
              value={workOrderType}
              onChange={(e) => setWorkOrderType(e.target.value)}
            >
              {WO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </EnterpriseSelect>
          </div>
          <EnterpriseFormField<WorkOrderCreateValues>
            name="title"
            label="Work order title"
            required
          >
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="e.g. Replace air filter unit AHU-2"
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<WorkOrderCreateValues>
            name="description"
            label="Scope / execution notes"
          >
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseTextarea
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                rows={3}
                placeholder="Steps, parts needed, safety notes…"
              />
            )}
          </EnterpriseFormField>
        </div>

        <WorkOrderLocationFields
          projectId={projectId}
          workspaceId={workspaceId}
          value={locValue}
          onChange={(next) => {
            setLocValue(next);
            setStructureTouched(true);
          }}
          onLocationTextChange={() => setLocationTouched(true)}
          idPrefix="wo-create-loc"
          disabled={createMut.isPending}
        />

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
      </EnterpriseForm>
    </EnterpriseSlideOver>
  );
}
