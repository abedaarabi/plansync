"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseMemberMultiPicker } from "@/components/enterprise/EnterpriseMemberMultiPicker";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { RfiRelatedIssuesPicker } from "@/components/enterprise/RfiRelatedIssuesPicker";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchIssuesForProject,
  fetchProjectTeam,
  HttpError,
  patchProjectRfi,
  ProRequiredError,
  viewerHrefForRfi,
  type RfiRow,
} from "@/lib/api-client";
import {
  issueDateToInputValue,
  RFI_STATUS_LABEL,
  rfiStatusBadgeClass,
} from "@/lib/issueStatusStyle";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";
import { rfiBallInCourt } from "@/lib/rfisOverviewStats";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  rfi: RfiRow | null;
};

function normStatus(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

function rfiResponderIds(r: RfiRow): string[] {
  const ids = new Set<string>();
  if (r.assignedToUserId) ids.add(r.assignedToUserId);
  if (r.assignedTo?.id) ids.add(r.assignedTo.id);
  for (const a of r.assignees ?? []) {
    if (a.id) ids.add(a.id);
  }
  return [...ids];
}

// fallow-ignore-next-line complexity
export function RfiEditSlideOver({ open, onClose, projectId, rfi }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const { me } = useEnterpriseWorkspace();
  const meId = me?.user.id ?? null;

  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [fromDiscipline, setFromDiscipline] = useState("");
  const [dueYmd, setDueYmd] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [risk, setRisk] = useState<"" | "low" | "med" | "high">("");
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [localRfi, setLocalRfi] = useState<RfiRow | null>(null);

  useEffect(() => {
    if (!open || !rfi) return;
    setLocalRfi(rfi);
    setTitle(rfi.title);
    setQuestion(rfi.description ?? "");
    setFromDiscipline(rfi.fromDiscipline ?? "");
    setDueYmd(issueDateToInputValue(rfi.dueDate));
    setPriority(
      (rfi.priority || "MEDIUM").toUpperCase() === "HIGH"
        ? "HIGH"
        : (rfi.priority || "MEDIUM").toUpperCase() === "LOW"
          ? "LOW"
          : "MEDIUM",
    );
    const rk = (rfi.risk ?? "").toLowerCase();
    setRisk(rk === "low" || rk === "med" || rk === "high" ? rk : "");
    setAssignUserIds(rfiResponderIds(rfi));
    setIssueIds((rfi.issues ?? []).map((i) => i.id));
    setMsg(null);
  }, [open, rfi]);

  const { data: team } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId && open),
  });

  const { data: projectIssues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && open),
  });

  const assignablePickRows = useMemo(() => {
    return (team?.members ?? [])
      .filter((m) => m.access === "full" || m.access === "project")
      .map((m) => ({ userId: m.userId, name: m.name, email: m.email }));
  }, [team]);

  const active = localRfi ?? rfi;
  const st = active ? normStatus(active.status) : "";
  const isCreator = Boolean(meId && active?.creatorId === meId);
  const closed = st === "CLOSED";
  const viewerHref = active ? viewerHrefForRfi(active, projectId) : null;
  const detailHref = active ? `/projects/${projectId}/rfi/${active.id}` : "#";
  const ballInCourt = active ? rfiBallInCourt(active) : "—";

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Missing RFI.");
      return patchProjectRfi(projectId, active.id, {
        title: title.trim(),
        description: question.trim() || null,
        fromDiscipline: fromDiscipline.trim() || null,
        dueDate: dueYmd.trim() ? dueYmd.trim() : null,
        priority,
        risk: risk === "" ? null : risk,
        assigneeUserIds: assignUserIds,
        issueIds,
      });
    },
    onSuccess: (row) => {
      setLocalRfi(row);
      setIssueIds((row.issues ?? []).map((i) => i.id));
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      void qc.invalidateQueries({ queryKey: qk.projectRfi(projectId, row.id) });
      toast.success("RFI updated.");
      onClose();
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError
          ? "Pro subscription required."
          : e instanceof HttpError
            ? e.message
            : e.message;
      setMsg(text);
      toast.error(text);
    },
  });

  const statusMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!active) throw new Error("Missing RFI.");
      return patchProjectRfi(projectId, active.id, body);
    },
    onSuccess: (row) => {
      setLocalRfi(row);
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      toast.success("Status updated.");
      setMsg(null);
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError
          ? "Pro subscription required."
          : e instanceof HttpError
            ? e.message
            : e.message;
      setMsg(text);
      toast.error(text);
    },
  });

  if (!active) return null;

  const numLabel = `#${String(active.rfiNumber).padStart(3, "0")}`;
  const busy = saveMut.isPending || statusMut.isPending;

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!title.trim() || closed) return;
          saveMut.mutate();
        },
      }}
      ariaLabelledBy="rfi-edit-title"
      header={
        <SlideOverHeader
          icon={MessageSquareText}
          titleId="rfi-edit-title"
          title={title.trim() || "Edit RFI"}
          description={
            <>
              <span className="font-mono font-semibold tabular-nums">{numLabel}</span>
              {" · Ball in court: "}
              <span className="font-medium text-[var(--enterprise-text)]">{ballInCourt}</span>
            </>
          }
          badge={
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rfiStatusBadgeClass(st)}`}
            >
              {RFI_STATUS_LABEL[st] ?? st.replace(/_/g, " ")}
            </span>
          }
        />
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {st === "OPEN" && isCreator ? (
              <EnterpriseButton
                type="button"
                size="sm"
                loading={statusMut.isPending}
                disabled={assignUserIds.length === 0 && rfiResponderIds(active).length === 0}
                onClick={() =>
                  statusMut.mutate({
                    status: "IN_REVIEW",
                    ...(assignUserIds.length > 0 ? { assigneeUserIds: assignUserIds } : {}),
                  })
                }
              >
                Send for review
              </EnterpriseButton>
            ) : null}
            {st === "IN_REVIEW" ? (
              <EnterpriseButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => router.push(detailHref)}
              >
                Mark as answered
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </EnterpriseButton>
            ) : null}
            {st === "ANSWERED" && isCreator ? (
              <EnterpriseButton
                type="button"
                size="sm"
                loading={statusMut.isPending}
                onClick={() => statusMut.mutate({ status: "CLOSED" })}
              >
                Close RFI
              </EnterpriseButton>
            ) : null}
            {closed ? (
              <EnterpriseButton
                type="button"
                size="sm"
                variant="secondary"
                loading={statusMut.isPending}
                onClick={() => statusMut.mutate({ status: "IN_REVIEW" })}
              >
                Reopen
              </EnterpriseButton>
            ) : null}
          </div>
          <div className="flex w-full justify-end gap-2">
            <EnterpriseButton type="button" variant="secondary" onClick={onClose}>
              Cancel
            </EnterpriseButton>
            {!closed ? (
              <EnterpriseButton
                type="submit"
                loading={saveMut.isPending}
                disabled={!title.trim() || busy}
              >
                {saveMut.isPending ? "Saving…" : "Save changes"}
              </EnterpriseButton>
            ) : null}
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

        {st === "IN_REVIEW" ? (
          <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            Recording an official answer requires selecting a discussion message.{" "}
            <Link
              href={detailHref}
              className="font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Open full detail
            </Link>{" "}
            to mark as answered.
          </p>
        ) : null}

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Details</p>
          <div>
            <label htmlFor="rfi-edit-title-input" className={MOBILE_FIELD_LABEL}>
              Title *
            </label>
            <input
              id="rfi-edit-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
              disabled={closed || busy}
            />
          </div>
          <div>
            <label htmlFor="rfi-edit-question" className={MOBILE_FIELD_LABEL}>
              Question
            </label>
            <textarea
              id="rfi-edit-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className={MOBILE_FIELD_TEXTAREA}
              disabled={closed || busy}
            />
          </div>
        </div>

        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)] sm:col-span-2">
            Routing
          </p>
          <div>
            <label htmlFor="rfi-edit-discipline" className={MOBILE_FIELD_LABEL}>
              From discipline
            </label>
            <input
              id="rfi-edit-discipline"
              value={fromDiscipline}
              onChange={(e) => setFromDiscipline(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              disabled={closed || busy}
            />
          </div>
          <div>
            <label htmlFor="rfi-edit-due" className={MOBILE_FIELD_LABEL}>
              Due date
            </label>
            <input
              id="rfi-edit-due"
              type="date"
              value={dueYmd}
              onChange={(e) => setDueYmd(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              disabled={closed || busy}
            />
          </div>
          <div>
            <label htmlFor="rfi-edit-priority" className={MOBILE_FIELD_LABEL}>
              Priority
            </label>
            <select
              id="rfi-edit-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className={MOBILE_FIELD_INPUT}
              disabled={closed || busy}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label htmlFor="rfi-edit-risk" className={MOBILE_FIELD_LABEL}>
              Risk
            </label>
            <select
              id="rfi-edit-risk"
              value={risk}
              onChange={(e) => setRisk(e.target.value as typeof risk)}
              className={MOBILE_FIELD_INPUT}
              disabled={closed || busy}
            >
              <option value="">—</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Responders</p>
          <label className={MOBILE_FIELD_LABEL}>Who can answer</label>
          <div className="mt-1">
            {assignablePickRows.length === 0 ? (
              <p className="text-xs text-[var(--enterprise-text-muted)]">No members yet.</p>
            ) : (
              <EnterpriseMemberMultiPicker
                members={assignablePickRows}
                value={assignUserIds}
                onChange={setAssignUserIds}
                disabled={closed || busy}
                emptyMessage="No one matches that search."
              />
            )}
          </div>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            Related issues
          </p>
          <label className={MOBILE_FIELD_LABEL}>Linked site issues</label>
          <RfiRelatedIssuesPicker
            issues={projectIssues}
            value={issueIds}
            onChange={setIssueIds}
            disabled={closed || busy}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--enterprise-border)] pt-3">
          {viewerHref ? (
            <Link
              href={viewerHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              Open in viewer
              {active.file?.name ? (
                <span className="font-normal text-[var(--enterprise-text-muted)]">
                  ({active.file.name}
                  {active.pageNumber != null ? ` · p.${active.pageNumber}` : ""})
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            Open full detail
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}
