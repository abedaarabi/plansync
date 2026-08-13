"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, FileText, Wrench } from "lucide-react";
import { toast } from "sonner";
import { IssueReferencePhotosField } from "@/components/enterprise/IssueReferencePhotosField";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import {
  WorkOrderAssetFields,
  formatOmAssetLocation,
} from "@/components/enterprise/WorkOrderAssetFields";
import { WorkOrderActivityTimeline } from "@/components/enterprise/WorkOrderActivityTimeline";
import { WorkOrderAssetDocsPanel } from "@/components/enterprise/WorkOrderAssetDocsPanel";
import {
  WorkOrderLocationFields,
  type WorkOrderLocationValue,
} from "@/components/enterprise/WorkOrderLocationFields";
import { WorkOrderProcedureField } from "@/components/enterprise/WorkOrderProcedureField";
import {
  fetchOmAssets,
  fetchOmVendors,
  formatIssueLockHint,
  patchIssue,
  postOmWorkspaceWorkOrderTemplate,
  ProRequiredError,
  viewerHrefForIssue,
  type IssueReferencePhotoRow,
  type IssueRow,
  type WorkOrderChecklistItem,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
} from "@/lib/issueStatusStyle";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { filterOmAssetsBySearch } from "@/lib/filterOmAssetsBySearch";
import { projectScopedHref } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";

type WorkspaceMember = { userId: string; name: string | null; email: string | null };

type Props = {
  open: boolean;
  issue: IssueRow | null;
  projectId: string;
  workspaceId?: string;
  onClose: () => void;
  members: WorkspaceMember[];
  onSaved: (row: IssueRow) => void;
};

// fallow-ignore-next-line complexity
export function WorkOrderEditSlideOver({
  open,
  issue,
  projectId,
  workspaceId,
  onClose,
  members,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const [assetId, setAssetId] = useState("");
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
  const [locValue, setLocValue] = useState<WorkOrderLocationValue>({
    buildingId: "",
    levelId: "",
    location: "",
  });
  const [locationTouched, setLocationTouched] = useState(false);
  const [structureTouched, setStructureTouched] = useState(false);
  const [photos, setPhotos] = useState<IssueReferencePhotoRow[]>([]);
  const [workOrderType, setWorkOrderType] = useState("CORRECTIVE");
  const [vendorId, setVendorId] = useState("");
  const [procedure, setProcedure] = useState<WorkOrderChecklistItem[]>([]);
  const [completionEvidenceRequired, setCompletionEvidenceRequired] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: vendors = [] } = useQuery({
    queryKey: qk.omVendors(projectId),
    queryFn: () => fetchOmVendors(projectId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || !issue) return;
    setAssetId(issue.assetId ?? "");
    setAssetSearch("");
    setTitle(issue.title);
    setDescription(issue.description ?? "");
    setAssigneeId(issue.assigneeId ?? "");
    setVendorName(issue.externalAssigneeName ?? "");
    setVendorEmail(issue.externalAssigneeEmail ?? "");
    setStatus(issue.status);
    setPriority(issue.priority ?? "MEDIUM");
    setStartDate(issueDateToInputValue(issue.startDate));
    setDueDate(issueDateToInputValue(issue.dueDate));
    setLocValue({
      buildingId: issue.buildingId ?? "",
      levelId: issue.levelId ?? "",
      location: issue.location ?? "",
    });
    setLocationTouched(false);
    setStructureTouched(false);
    setPhotos(issue.referencePhotos ?? []);
    setWorkOrderType(issue.workOrderType ?? "CORRECTIVE");
    setVendorId(issue.vendorId ?? "");
    setProcedure(issue.procedureJson ?? []);
    setCompletionEvidenceRequired(Boolean(issue.completionEvidenceRequired));
    setMsg(null);
  }, [open, issue]);

  const { data: assets = [], isPending: assetsPending } = useQuery({
    queryKey: qk.omAssets(projectId, assetSearch),
    queryFn: () => fetchOmAssets(projectId, { q: assetSearch }),
    enabled: open,
  });

  const filteredAssets = useMemo(
    () => filterOmAssetsBySearch(assets, assetSearch),
    [assets, assetSearch],
  );

  const selectedAsset = assets.find((a) => a.id === assetId) ?? null;

  useEffect(() => {
    if (!selectedAsset) return;
    if (!locationTouched) {
      const loc = formatOmAssetLocation(selectedAsset);
      if (loc && !issue?.location) {
        setLocValue((prev) => ({ ...prev, location: loc }));
      }
    }
    if (!structureTouched && !issue?.buildingId && !issue?.levelId) {
      setLocValue((prev) => ({
        ...prev,
        buildingId: selectedAsset.buildingId ?? prev.buildingId,
        levelId: selectedAsset.levelId ?? prev.levelId,
      }));
    }
  }, [
    selectedAsset,
    locationTouched,
    structureTouched,
    issue?.location,
    issue?.buildingId,
    issue?.levelId,
  ]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!issue) throw new Error("Missing work order.");
      return patchIssue(issue.id, {
        assetId: assetId || null,
        title: title.trim(),
        description: description.trim() || null,
        assigneeId: assigneeId || null,
        externalAssigneeName: vendorName.trim() || null,
        externalAssigneeEmail: vendorEmail.trim() || null,
        status,
        priority,
        startDate: startDate.trim() || null,
        dueDate: dueDate.trim() || null,
        location: locValue.location.trim() || null,
        buildingId: locValue.buildingId || null,
        levelId: locValue.levelId || null,
        workOrderType,
        vendorId: vendorId || null,
        procedureJson: procedure,
        completionEvidenceRequired,
      });
    },
    onSuccess: (row) => {
      onSaved(row);
      onClose();
      toast.success("Work order updated.");
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e);
      setMsg(text);
      toast.error(text);
    },
  });

  const publishProcMut = useMutation({
    mutationFn: () => {
      if (!workspaceId) throw new Error("No workspace selected.");
      return postOmWorkspaceWorkOrderTemplate(workspaceId, {
        name: title.trim() || "Work order procedure",
        description: description.trim() || null,
        workOrderType: (workOrderType as "CORRECTIVE") || "CORRECTIVE",
        priority,
        procedureJson: procedure,
      });
    },
    onSuccess: async () => {
      if (workspaceId) {
        await qc.invalidateQueries({
          queryKey: qk.omWorkspaceWorkOrderTemplates(workspaceId),
        });
      }
      toast.success("Saved to company procedures.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  if (!issue) return null;

  const assetsHref = projectScopedHref(projectId, "/om/assets", workspaceId);
  const viewerHref = viewerHrefForIssue(issue);
  const viewInModel = Boolean(viewerHref && issue.bimAnchor);
  const openOnDrawing = Boolean(viewerHref && issue.annotationId && !issue.bimAnchor);

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          saveMut.mutate();
        },
      }}
      ariaLabelledBy="wo-edit-title"
      header={
        <SlideOverHeader
          icon={Wrench}
          titleId="wo-edit-title"
          title="Edit work order"
          description="Update equipment, location, scope, and execution details."
        />
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          {workspaceId && procedure.length > 0 ? (
            <EnterpriseButton
              type="button"
              variant="secondary"
              fullWidth
              loading={publishProcMut.isPending}
              onClick={() => publishProcMut.mutate()}
            >
              Save as company procedure
            </EnterpriseButton>
          ) : null}
          <div className="flex w-full justify-end gap-2">
            <EnterpriseButton type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              type="submit"
              size="sm"
              loading={saveMut.isPending}
              disabled={!title.trim()}
            >
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </EnterpriseButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {msg ? (
          <div
            className="rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-3 py-2 text-sm text-[var(--enterprise-semantic-danger-text)]"
            role="alert"
          >
            {msg}
          </div>
        ) : null}

        {viewInModel || openOnDrawing ? (
          <div className="flex flex-wrap gap-2">
            {viewInModel && viewerHref ? (
              <Link
                href={viewerHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-xs font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)]"
              >
                <Box className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                View in model
              </Link>
            ) : null}
            {openOnDrawing && viewerHref ? (
              <Link
                href={viewerHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-xs font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)]"
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Open on drawing
              </Link>
            ) : null}
          </div>
        ) : null}

        <div
          className={`${MOBILE_FORM_SECTION} rounded-md border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] p-3`}
        >
          <p className="enterprise-type-label text-[var(--enterprise-semantic-info-text)]">
            Equipment
          </p>
          <WorkOrderAssetFields
            idPrefix="wo-edit"
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
              <Wrench
                className="mr-1 inline h-3.5 w-3.5 text-[var(--enterprise-primary)]"
                aria-hidden
              />
              <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                {selectedAsset.tag}
              </span>
              {" · "}
              {selectedAsset.name}
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
            <label htmlFor="wo-edit-type" className={MOBILE_FIELD_LABEL}>
              Work order type
            </label>
            <select
              id="wo-edit-type"
              value={workOrderType}
              onChange={(e) => setWorkOrderType(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              <option value="CORRECTIVE">Corrective</option>
              <option value="PREVENTIVE">Preventive</option>
              <option value="INSPECTION_FOLLOWUP">Inspection follow-up</option>
              <option value="TENANT">Tenant</option>
              <option value="OCCUPANT">Occupant</option>
            </select>
          </div>
          <div>
            <label htmlFor="wo-edit-title" className={MOBILE_FIELD_LABEL}>
              Work order title *
            </label>
            <input
              id="wo-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
            />
          </div>
          <div>
            <label htmlFor="wo-edit-description" className={MOBILE_FIELD_LABEL}>
              Scope / execution notes
            </label>
            <textarea
              id="wo-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={MOBILE_FIELD_TEXTAREA}
            />
          </div>
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
          idPrefix="wo-edit-loc"
          disabled={saveMut.isPending}
        />

        <div className={MOBILE_FORM_SECTION}>
          <IssueReferencePhotosField
            issueId={issue.id}
            photos={photos}
            onPhotosChange={setPhotos}
            disabled={saveMut.isPending}
          />
        </div>

        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <p className="enterprise-type-label col-span-full text-[var(--enterprise-text-muted)]">
            Execution
          </p>
          <div>
            <label htmlFor="wo-edit-status" className={MOBILE_FIELD_LABEL}>
              Status
            </label>
            <select
              id="wo-edit-status"
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
            <label htmlFor="wo-edit-priority" className={MOBILE_FIELD_LABEL}>
              Priority
            </label>
            <select
              id="wo-edit-priority"
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
            <label htmlFor="wo-edit-assignee" className={MOBILE_FIELD_LABEL}>
              Assigned technician
            </label>
            <select
              id="wo-edit-assignee"
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
            <label htmlFor="wo-edit-vendor-pick" className={MOBILE_FIELD_LABEL}>
              Vendor directory
            </label>
            <select
              id="wo-edit-vendor-pick"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              <option value="">None</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wo-edit-vendor-name" className={MOBILE_FIELD_LABEL}>
              External vendor (manual)
            </label>
            <input
              id="wo-edit-vendor-name"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="wo-edit-vendor-email" className={MOBILE_FIELD_LABEL}>
              Vendor email
            </label>
            <input
              id="wo-edit-vendor-email"
              type="email"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            Completion checklist
          </p>
          <WorkOrderProcedureField
            items={procedure}
            onChange={setProcedure}
            disabled={saveMut.isPending}
          />
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
            <label htmlFor="wo-edit-start" className={MOBILE_FIELD_LABEL}>
              Planned start
            </label>
            <input
              id="wo-edit-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="wo-edit-due" className={MOBILE_FIELD_LABEL}>
              Target completion
            </label>
            <input
              id="wo-edit-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>

        <WorkOrderActivityTimeline issue={issue} enabled={open} />
      </div>
    </EnterpriseSlideOver>
  );
}
