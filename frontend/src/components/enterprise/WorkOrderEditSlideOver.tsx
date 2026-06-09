"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Package, Pencil, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { IssueReferencePhotosField } from "@/components/enterprise/IssueReferencePhotosField";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { formatOmAssetLocation } from "@/components/enterprise/WorkOrderCreateSlideOver";
import {
  fetchOmAssets,
  formatIssueLockHint,
  patchIssue,
  ProRequiredError,
  type IssueReferencePhotoRow,
  type IssueRow,
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
import { qk } from "@/lib/queryKeys";

type WorkspaceMember = { userId: string; name: string | null; email: string | null };

type Props = {
  open: boolean;
  issue: IssueRow | null;
  projectId: string;
  onClose: () => void;
  members: WorkspaceMember[];
  onSaved: (row: IssueRow) => void;
};

export function WorkOrderEditSlideOver({
  open,
  issue,
  projectId,
  onClose,
  members,
  onSaved,
}: Props) {
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
  const [location, setLocation] = useState("");
  const [locationTouched, setLocationTouched] = useState(false);
  const [photos, setPhotos] = useState<IssueReferencePhotoRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

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
    setLocation(issue.location ?? "");
    setLocationTouched(false);
    setPhotos(issue.referencePhotos ?? []);
    setMsg(null);
  }, [open, issue]);

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
    if (loc && !issue?.location) setLocation(loc);
  }, [selectedAsset, locationTouched, issue?.location]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!issue) throw new Error("Missing work order.");
      if (!assetId) throw new Error("Select an asset for this work order.");
      return patchIssue(issue.id, {
        assetId,
        title: title.trim(),
        description: description.trim() || null,
        assigneeId: assigneeId || null,
        externalAssigneeName: vendorName.trim() || null,
        externalAssigneeEmail: vendorEmail.trim() || null,
        status,
        priority,
        startDate: startDate.trim() || null,
        dueDate: dueDate.trim() || null,
        location: location.trim() || null,
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

  if (!issue) return null;

  const assetsHref = `/projects/${projectId}/om/assets`;

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!title.trim() || !assetId) return;
          saveMut.mutate();
        },
      }}
      ariaLabelledBy="wo-edit-title"
      panelMaxWidthClass="max-w-[min(calc(100dvw-16px),560px)]"
      bodyClassName="px-5 py-5"
      header={
        <div className="flex items-start gap-3 pr-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 shadow-[var(--enterprise-shadow-xs)]">
            <Pencil className="h-5 w-5 text-sky-600 dark:text-sky-400" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label text-sky-600 dark:text-sky-400">O&amp;M</p>
            <h2
              id="wo-edit-title"
              className="text-lg font-bold tracking-tight text-[var(--enterprise-text)]"
            >
              Edit work order
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--enterprise-text-muted)]">
              Update equipment, scope, and execution details.
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMut.isPending || !title.trim() || !assetId}
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-sky-700 disabled:opacity-60"
          >
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </button>
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
          className={`${MOBILE_FORM_SECTION} rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3`}
        >
          <p className="enterprise-type-label text-sky-700 dark:text-sky-300">Equipment</p>
          <div>
            <label htmlFor="wo-edit-asset-search" className={MOBILE_FIELD_LABEL}>
              Search assets
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
                aria-hidden
              />
              <input
                id="wo-edit-asset-search"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className={`${MOBILE_FIELD_INPUT} pl-9`}
                placeholder="Tag, name, location…"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label htmlFor="wo-edit-asset" className={MOBILE_FIELD_LABEL}>
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
                    className="mt-2 inline-block text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
                  >
                    Add assets in O&amp;M
                  </Link>
                ) : null}
              </div>
            ) : (
              <select
                id="wo-edit-asset"
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
              <Wrench
                className="mr-1 inline h-3.5 w-3.5 text-sky-600 dark:text-sky-400"
                aria-hidden
              />
              <span className="font-mono font-semibold text-[var(--enterprise-text)]">
                {selectedAsset.tag}
              </span>
              {" · "}
              {selectedAsset.name}
            </div>
          ) : null}
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Work scope</p>
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
          <div>
            <label htmlFor="wo-edit-location" className={MOBILE_FIELD_LABEL}>
              Work location
            </label>
            <input
              id="wo-edit-location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setLocationTouched(true);
              }}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>

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
            <label htmlFor="wo-edit-vendor-name" className={MOBILE_FIELD_LABEL}>
              External vendor
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
      </div>
    </EnterpriseSlideOver>
  );
}
