"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { Plus } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  createProjectRfi,
  fetchProjectRfis,
  ProRequiredError,
  type RfiRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

type StatusFilter = "ALL" | "OPEN" | "ANSWERED" | "CLOSED" | "OVERDUE";

const STATUS_DOT: Record<string, string> = {
  OPEN: "bg-[#EF4444]",
  ANSWERED: "bg-[#10B981]",
  CLOSED: "bg-slate-400",
  PENDING: "bg-amber-400",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  ANSWERED: "Answered",
  CLOSED: "Closed",
  PENDING: "Pending",
};

export function ProjectRfisClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const nowMs = useTickNowMs();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [fromDiscipline, setFromDiscipline] = useState("");
  const [risk, setRisk] = useState<"" | "low" | "med" | "high">("");
  const [msg, setMsg] = useState<string | null>(null);

  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.projectRfis(projectId),
    queryFn: () => fetchProjectRfis(projectId),
  });

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    if (filter === "OVERDUE") {
      return rows.filter(
        (r) =>
          r.dueDate &&
          new Date(r.dueDate).getTime() < nowMs &&
          r.status !== "CLOSED" &&
          r.status !== "ANSWERED",
      );
    }
    return rows.filter((r) => r.status === filter);
  }, [rows, filter, nowMs]);

  const createMut = useMutation({
    mutationFn: (vars: {
      tempId: string;
      title: string;
      fromDiscipline?: string;
      risk: "" | "low" | "med" | "high";
    }) =>
      createProjectRfi(projectId, {
        title: vars.title,
        fromDiscipline: vars.fromDiscipline,
        risk: vars.risk === "" ? null : vars.risk,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.projectRfis(projectId) });
      const prev = qc.getQueryData<RfiRow[]>(qk.projectRfis(projectId));
      const optimistic: RfiRow = {
        id: vars.tempId,
        projectId,
        title: vars.title,
        description: null,
        status: "OPEN",
        fromDiscipline: vars.fromDiscipline?.trim() || null,
        dueDate: null,
        risk: vars.risk === "" ? null : vars.risk,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<RfiRow[]>(qk.projectRfis(projectId), (old) => [optimistic, ...(old ?? [])]);
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.projectRfis(projectId), ctx.prev);
      setMsg(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
    onSuccess: (data, vars) => {
      qc.setQueryData<RfiRow[]>(qk.projectRfis(projectId), (old) =>
        (old ?? []).map((r) => (r.id === vars.tempId ? data : r)),
      );
      setCreateOpen(false);
      setTitle("");
      setFromDiscipline("");
      setRisk("");
      setMsg(null);
    },
  });

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "ANSWERED", label: "Answered" },
    { key: "CLOSED", label: "Closed" },
    { key: "OVERDUE", label: "Overdue" },
  ];

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  }

  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">RFIs</h1>
          <button
            type="button"
            onClick={() => {
              setMsg(null);
              setCreateOpen((o) => !o);
            }}
            className="inline-flex items-center gap-2 bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
            style={{ borderRadius: "8px" }}
          >
            <Plus className="h-4 w-4" />
            New RFI
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-[#2563EB] text-white"
                  : "border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
              }`}
              style={{ borderRadius: "6px" }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Create form */}
        {createOpen && (
          <form
            className="border border-[#E2E8F0] bg-white p-5"
            style={{ borderRadius: "12px" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              createMut.mutate({
                tempId: `optimistic-${nanoid()}`,
                title: title.trim(),
                fromDiscipline: fromDiscipline.trim() || undefined,
                risk,
              });
            }}
          >
            <p className="text-sm font-semibold text-[#0F172A]">New RFI</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-[#64748B]">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  style={{ borderRadius: "8px" }}
                  placeholder="Wall thickness clarification"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B]">Assigned to</label>
                <input
                  value={fromDiscipline}
                  onChange={(e) => setFromDiscipline(e.target.value)}
                  className="mt-1 w-full border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  style={{ borderRadius: "8px" }}
                  placeholder="Architect"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-[#64748B]">Risk</label>
              <select
                value={risk}
                onChange={(e) => setRisk(e.target.value as typeof risk)}
                className="mt-1 w-full max-w-xs border border-[#E2E8F0] px-3 py-2 text-sm"
                style={{ borderRadius: "8px" }}
              >
                <option value="">—</option>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            {msg && <p className="mt-2 text-sm text-[#EF4444]">{msg}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ borderRadius: "8px" }}
              >
                {createMut.isPending ? "Saving…" : "Create RFI"}
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]"
                style={{ borderRadius: "8px" }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Table */}
        {isPending ? (
          <div className="py-12">
            <EnterpriseLoadingState
              variant="minimal"
              message="Loading RFIs…"
              label="Loading project RFIs"
            />
          </div>
        ) : (
          <div
            className="overflow-hidden border border-[#E2E8F0] bg-white"
            style={{
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                    <th className="px-4 py-3 w-14">#</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-[#64748B]">
                        {rows.length === 0
                          ? "No RFIs yet. Create one to get started."
                          : "No RFIs match this filter."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const num = String(rows.length - rows.indexOf(r)).padStart(3, "0");
                      return (
                        <tr
                          key={r.id}
                          className="cursor-pointer border-b border-[#E2E8F0]/80 transition hover:bg-[#F8FAFC]"
                          onClick={() => router.push(`/projects/${projectId}/rfi/${r.id}`)}
                        >
                          <td className="px-4 py-3 tabular-nums text-[#94A3B8]">{num}</td>
                          <td className="max-w-[280px] px-4 py-3 font-medium text-[#0F172A]">
                            {r.title}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 rounded-full ${STATUS_DOT[r.status] ?? "bg-slate-400"}`}
                              />
                              <span className="text-xs font-medium text-[#0F172A]">
                                {STATUS_LABEL[r.status] ?? r.status.replace(/_/g, " ")}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">{r.fromDiscipline ?? "—"}</td>
                          <td className="px-4 py-3 tabular-nums text-[#64748B]">
                            {formatDate(r.dueDate)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
