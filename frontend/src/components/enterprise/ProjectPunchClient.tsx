"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Download, Plus } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
  applyPunchTemplate,
  bulkPatchPunchItems,
  createPunchItem,
  createPunchTemplate,
  fetchProject,
  fetchProjectPunch,
  fetchPunchTemplates,
  fetchWorkspaceMembers,
  patchPunchItem,
  punchExportCsvUrl,
  ProRequiredError,
  type PunchRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

export function ProjectPunchClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDateYmd, setDueDateYmd] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [templateIdToApply, setTemplateIdToApply] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateRows, setTemplateRows] = useState("Safety walk|Level 1|General");

  const { data: items = [], isPending } = useQuery({
    queryKey: qk.projectPunch(projectId),
    queryFn: () => fetchProjectPunch(projectId),
  });
  const { data: project } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
  const workspaceId = project?.workspaceId ?? "";
  const { data: membersResp } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId || "none"),
    queryFn: () => fetchWorkspaceMembers(workspaceId),
    enabled: workspaceId.length > 0,
  });
  const members = membersResp?.members ?? [];
  const { data: templates = [] } = useQuery({
    queryKey: qk.projectPunchTemplates(projectId),
    queryFn: () => fetchPunchTemplates(projectId),
  });

  const createMut = useMutation({
    mutationFn: (vars: {
      tempId: string;
      title: string;
      location: string;
      trade: string;
      notes?: string;
      assigneeId?: string;
      dueDateYmd?: string;
    }) =>
      createPunchItem(projectId, {
        title: vars.title,
        location: vars.location,
        trade: vars.trade,
        notes: vars.notes,
        assigneeId: vars.assigneeId ?? null,
        dueDateYmd: vars.dueDateYmd ?? null,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.projectPunch(projectId) });
      const prev = qc.getQueryData<PunchRow[]>(qk.projectPunch(projectId));
      const optimistic: PunchRow = {
        id: vars.tempId,
        projectId,
        title: vars.title,
        location: vars.location,
        trade: vars.trade,
        priority: "P2",
        status: "OPEN",
        assigneeId: vars.assigneeId ?? null,
        dueDate: vars.dueDateYmd ? new Date(vars.dueDateYmd).toISOString() : null,
        completedAt: null,
        templateId: null,
        assignee: null,
        notes: vars.notes?.trim() ? vars.notes.trim() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.projectPunch(projectId), ctx.prev);
      if (e instanceof ProRequiredError) setMsg("Pro subscription required.");
      else setMsg(e.message);
    },
    onSuccess: (data, vars) => {
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) =>
        (old ?? []).map((r) => (r.id === vars.tempId ? data : r)),
      );
      setOpen(false);
      setTitle("");
      setLocation("");
      setTrade("");
      setAssigneeId("");
      setDueDateYmd("");
      setNotes("");
      setMsg(null);
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patchPunchItem(projectId, id, { status }),
    onSuccess: (row) => {
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) =>
        (old ?? []).map((r) => (r.id === row.id ? row : r)),
      );
    },
  });

  const bulkMut = useMutation({
    mutationFn: (vars: { ids: string[]; assigneeId?: string | null; status?: string }) =>
      bulkPatchPunchItems(projectId, vars),
    onSuccess: async () => {
      setSelectedIds([]);
      await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
    },
  });

  const applyTemplateMut = useMutation({
    mutationFn: (templateId: string) => applyPunchTemplate(projectId, templateId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
      setTemplateIdToApply("");
    },
  });

  const createTemplateMut = useMutation({
    mutationFn: () =>
      createPunchTemplate(projectId, {
        name: templateName,
        items: templateRows
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [rowTitle, rowLocation, rowTrade] = line.split("|");
            return {
              title: rowTitle?.trim() || "Punch item",
              location: rowLocation?.trim() || "TBD",
              trade: rowTrade?.trim() || "General",
            };
          }),
      }),
    onSuccess: async () => {
      setTemplateName("");
      await qc.invalidateQueries({ queryKey: qk.projectPunchTemplates(projectId) });
    },
  });

  const filtered = useMemo(
    () => items.filter((item) => (statusFilter === "ALL" ? true : item.status === statusFilter)),
    [items, statusFilter],
  );

  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Punch list
            </h1>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Full workflow with templates, lifecycle, bulk operations, and export.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={punchExportCsvUrl(projectId)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-3 text-xs font-semibold text-white shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
        </header>

        <div className="enterprise-card mb-6 grid gap-3 p-4 sm:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
          >
            {["ALL", "OPEN", "IN_PROGRESS", "READY_FOR_GC", "CLOSED"].map((s) => (
              <option key={s} value={s}>
                Filter: {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={templateIdToApply}
              onChange={(e) => setTemplateIdToApply(e.target.value)}
              className="w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            >
              <option value="">Apply template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => templateIdToApply && applyTemplateMut.mutate(templateIdToApply)}
              className="rounded-lg border px-3 py-2 text-xs"
            >
              Apply
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            >
              <option value="">Bulk status...</option>
              {["OPEN", "IN_PROGRESS", "READY_FOR_GC", "CLOSED"].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!bulkStatus || selectedIds.length === 0}
              onClick={() => bulkMut.mutate({ ids: selectedIds, status: bulkStatus })}
              className="rounded-lg border px-3 py-2 text-xs disabled:opacity-60"
            >
              Update
            </button>
          </div>
        </div>

        <div className="enterprise-card mb-6 grid gap-2 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
            <textarea
              value={templateRows}
              onChange={(e) => setTemplateRows(e.target.value)}
              rows={2}
              placeholder="title|location|trade (one per line)"
              className="sm:col-span-2 rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => templateName.trim() && createTemplateMut.mutate()}
              className="rounded-lg border px-3 py-2 text-xs"
            >
              Save template
            </button>
          </div>
        </div>

        {open ? (
          <form
            className="enterprise-card mb-8 space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !location.trim() || !trade.trim()) return;
              createMut.mutate({
                tempId: `optimistic-${nanoid()}`,
                title: title.trim(),
                location: location.trim(),
                trade: trade.trim(),
                assigneeId: assigneeId || undefined,
                dueDateYmd: dueDateYmd || undefined,
                notes: notes.trim() || undefined,
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                required
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="Trade"
                className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                required
              />
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dueDateYmd}
                onChange={(e) => setDueDateYmd(e.target.value)}
                className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes"
              className="w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
            />
            {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {createMut.isPending ? "Saving..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {isPending ? (
          <div className="py-12">
            <EnterpriseLoadingState
              variant="minimal"
              message="Loading punch list..."
              label="Loading punch list"
            />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">No punch items yet.</p>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="enterprise-glass flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={(e) =>
                      setSelectedIds((old) =>
                        e.target.checked ? [...old, p.id] : old.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      p.priority === "P1"
                        ? "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]"
                        : p.priority === "P2"
                          ? "border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]"
                          : "border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]"
                    }`}
                  >
                    <CircleAlert className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[var(--enterprise-primary)]">
                      {p.priority}
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--enterprise-text)]">
                      {p.title || p.location}
                    </p>
                    <p className="text-xs text-[var(--enterprise-text-muted)]">
                      {p.location} | {p.trade}
                    </p>
                    <p className="text-xs text-[var(--enterprise-text-muted)]">
                      {p.assignee?.name ?? "Unassigned"}
                      {p.dueDate ? ` | Due ${p.dueDate.slice(0, 10)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={p.status}
                    onChange={(e) => patchMut.mutate({ id: p.id, status: e.target.value })}
                    className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-[11px] font-medium"
                  >
                    {["OPEN", "IN_PROGRESS", "READY_FOR_GC", "CLOSED"].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
