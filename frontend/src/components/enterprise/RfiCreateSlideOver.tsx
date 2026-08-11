"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseMemberMultiPicker } from "@/components/enterprise/EnterpriseMemberMultiPicker";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { RfiRelatedIssuesPicker } from "@/components/enterprise/RfiRelatedIssuesPicker";
import {
  groupSheetRows,
  sheetRowsForProject,
} from "@/components/enterprise/issueCreateSheetPicker";
import {
  createProjectRfi,
  fetchIssuesForProject,
  fetchProjectTeam,
  fetchProjects,
  ProRequiredError,
  type RfiRow,
} from "@/lib/api-client";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  isPro: boolean;
  workspaceId?: string;
  onCreated: (rfi: RfiRow) => void;
};

// fallow-ignore-next-line complexity
export function RfiCreateSlideOver({
  open,
  onClose,
  projectId,
  isPro,
  workspaceId,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [fromDiscipline, setFromDiscipline] = useState("");
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [dueYmd, setDueYmd] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [risk, setRisk] = useState<"" | "low" | "med" | "high">("");
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [sheetPick, setSheetPick] = useState("");
  const [pageNum, setPageNum] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTitle("");
    setQuestion("");
    setFromDiscipline("");
    setAssignUserIds([]);
    setDueYmd("");
    setPriority("MEDIUM");
    setRisk("");
    setIssueIds([]);
    setSheetPick("");
    setPageNum("");
    setMsg(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  const { data: team } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId && open),
  });

  const { data: issues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && open && isPro),
  });

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(workspaceId ?? ""),
    queryFn: () => fetchProjects(workspaceId!),
    enabled: Boolean(workspaceId && open && isPro),
  });

  const project = projects.find((p) => p.id === projectId);
  const sheetGrouped = useMemo(
    () => (project ? groupSheetRows(sheetRowsForProject(project)) : []),
    [project],
  );

  const assignablePickRows = useMemo(() => {
    return (team?.members ?? [])
      .filter((m) => m.access === "full" || m.access === "project")
      .map((m) => ({ userId: m.userId, name: m.name, email: m.email }));
  }, [team]);

  const createMut = useMutation({
    mutationFn: () => {
      let fileId: string | undefined;
      let fileVersionId: string | undefined;
      if (issueIds.length === 0 && sheetPick.includes("|")) {
        const [f, v] = sheetPick.split("|");
        if (f && v) {
          fileId = f;
          fileVersionId = v;
        }
      }
      const pn = pageNum.trim() ? parseInt(pageNum, 10) : undefined;
      return createProjectRfi(projectId, {
        title: title.trim(),
        description: question.trim(),
        fromDiscipline: fromDiscipline.trim() || undefined,
        assigneeUserIds: assignUserIds.length > 0 ? assignUserIds : undefined,
        dueDate: dueYmd.trim() ? dueYmd.trim() : null,
        priority,
        risk: risk === "" ? null : risk,
        issueIds: issueIds.length > 0 ? issueIds : undefined,
        fileId,
        fileVersionId,
        pageNumber: Number.isFinite(pn) ? pn : undefined,
      });
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      handleClose();
      onCreated(data);
    },
    onError: (e: Error) => {
      if (e instanceof ProRequiredError) setMsg("Pro subscription required.");
      else setMsg(e.message);
    },
  });

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={handleClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!title.trim() || !question.trim()) return;
          createMut.mutate();
        },
      }}
      ariaLabelledBy="rfi-create-title"
      header={
        <SlideOverHeader
          icon={MessageSquareText}
          titleId="rfi-create-title"
          title="New RFI"
          description="Title and question required. Assign responders before review."
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="submit"
            size="sm"
            loading={createMut.isPending}
            disabled={!title.trim() || !question.trim()}
          >
            {createMut.isPending ? "Creating…" : "Create RFI"}
          </EnterpriseButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Details</p>
          <div>
            <label htmlFor="rfi-title" className={MOBILE_FIELD_LABEL}>
              Title *
            </label>
            <input
              id="rfi-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
              placeholder="Wall thickness clarification"
            />
          </div>
          <div>
            <label htmlFor="rfi-question" className={MOBILE_FIELD_LABEL}>
              Question *
            </label>
            <textarea
              id="rfi-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              required
              className={MOBILE_FIELD_TEXTAREA}
              placeholder="Describe what needs an official answer…"
            />
          </div>
        </div>
        <div className={`${MOBILE_FORM_SECTION} grid gap-4`}>
          <div>
            <label htmlFor="rfi-from-discipline" className={MOBILE_FIELD_LABEL}>
              From discipline
            </label>
            <input
              id="rfi-from-discipline"
              value={fromDiscipline}
              onChange={(e) => setFromDiscipline(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              placeholder="GC, Structural, MEP…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={MOBILE_FIELD_LABEL}>Responders (optional)</label>
            <div className="mt-1">
              {assignablePickRows.length === 0 ? (
                <p className="text-xs text-[var(--enterprise-text-muted)]">No members yet.</p>
              ) : (
                <EnterpriseMemberMultiPicker
                  members={assignablePickRows}
                  value={assignUserIds}
                  onChange={setAssignUserIds}
                  disabled={createMut.isPending}
                  emptyMessage="No one matches that search."
                />
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Search and add people. Any selected person can receive the review and submit the
              answer. Leave empty to assign later.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="rfi-due" className={MOBILE_FIELD_LABEL}>
              Due date
            </label>
            <input
              id="rfi-due"
              type="date"
              value={dueYmd}
              onChange={(e) => setDueYmd(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="rfi-priority" className={MOBILE_FIELD_LABEL}>
              Priority
            </label>
            <select
              id="rfi-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className={MOBILE_FIELD_INPUT}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label htmlFor="rfi-risk" className={MOBILE_FIELD_LABEL}>
              Risk
            </label>
            <select
              id="rfi-risk"
              value={risk}
              onChange={(e) => setRisk(e.target.value as typeof risk)}
              className={MOBILE_FIELD_INPUT}
            >
              <option value="">—</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            Related issues
          </p>
          <label className={MOBILE_FIELD_LABEL}>Link site issues (optional)</label>
          <RfiRelatedIssuesPicker
            issues={issues}
            value={issueIds}
            onChange={(ids) => {
              setIssueIds(ids);
              if (ids.length > 0) setSheetPick("");
            }}
            disabled={createMut.isPending}
          />
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            {issueIds.length > 0
              ? `${issueIds.length} linked · sheet defaults from the first issue unless you pick a drawing below.`
              : "Search and select one or more issues, or leave empty and link a drawing below."}
          </p>
        </div>
        {issueIds.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="rfi-sheet" className={MOBILE_FIELD_LABEL}>
                Link to drawing (optional)
              </label>
              <select
                id="rfi-sheet"
                value={sheetPick}
                onChange={(e) => setSheetPick(e.target.value)}
                className={MOBILE_FIELD_INPUT}
              >
                <option value="">— Select sheet & revision —</option>
                {sheetGrouped.map(({ group, items }) => (
                  <optgroup key={group} label={group}>
                    {items.map(({ file, version }) => (
                      <option key={`${file.id}|${version.id}`} value={`${file.id}|${version.id}`}>
                        {file.name} · v{version.version}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {project && sheetGrouped.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                  No drawings in this project yet. Add PDFs under Files, then link a sheet here.
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="rfi-page" className={MOBILE_FIELD_LABEL}>
                Page (optional)
              </label>
              <input
                id="rfi-page"
                type="number"
                min={1}
                value={pageNum}
                onChange={(e) => setPageNum(e.target.value)}
                className={MOBILE_FIELD_INPUT}
                placeholder="1"
              />
            </div>
          </div>
        ) : null}
        {msg ? (
          <p className="text-sm text-[var(--enterprise-semantic-danger-text)]" role="alert">
            {msg}
          </p>
        ) : null}
      </div>
    </EnterpriseSlideOver>
  );
}
