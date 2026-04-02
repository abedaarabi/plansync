"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Plus } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useState } from "react";
import { nanoid } from "nanoid";
import {
  createPunchItem,
  fetchProjectPunch,
  ProRequiredError,
  type PunchRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { ProjectScopeHeader } from "./ProjectScopeHeader";

export function ProjectPunchClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const { data: items = [], isPending } = useQuery({
    queryKey: qk.projectPunch(projectId),
    queryFn: () => fetchProjectPunch(projectId),
  });

  const createMut = useMutation({
    mutationFn: (vars: { tempId: string; location: string; trade: string; notes?: string }) =>
      createPunchItem(projectId, {
        location: vars.location,
        trade: vars.trade,
        notes: vars.notes,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.projectPunch(projectId) });
      const prev = qc.getQueryData<PunchRow[]>(qk.projectPunch(projectId));
      const optimistic: PunchRow = {
        id: vars.tempId,
        projectId,
        location: vars.location,
        trade: vars.trade,
        priority: "P2",
        status: "OPEN",
        notes: vars.notes?.trim() ? vars.notes.trim() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.projectPunch(projectId), ctx.prev);
      if (e instanceof ProRequiredError) {
        setMsg("Pro subscription required to add punch items.");
        return;
      }
      setMsg(e.message);
    },
    onSuccess: (data, vars) => {
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) =>
        (old ?? []).map((r) => (r.id === vars.tempId ? data : r)),
      );
      setOpen(false);
      setLocation("");
      setTrade("");
      setNotes("");
      setMsg(null);
    },
  });

  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <ProjectScopeHeader projectId={projectId} currentLabel="Punch list" />

        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Punch list
            </h1>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Field punch items for this project only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMsg(null);
              setOpen((o) => !o);
            }}
            className="inline-flex h-9 items-center gap-2 self-start rounded-lg bg-[var(--enterprise-primary)] px-3 text-xs font-semibold text-white shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Add item
          </button>
        </header>

        {open ? (
          <form
            className="enterprise-card mb-8 space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!location.trim() || !trade.trim()) return;
              createMut.mutate({
                tempId: `optimistic-${nanoid()}`,
                location: location.trim(),
                trade: trade.trim(),
                notes: notes.trim() || undefined,
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-[var(--enterprise-text-muted)]">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-[var(--enterprise-text-muted)]">Trade</label>
                <input
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--enterprise-text-muted)]">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
              />
            </div>
            {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {createMut.isPending ? "Saving…" : "Create"}
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
              message="Loading punch list…"
              label="Loading punch list"
            />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">No punch items yet.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((p) => (
              <div
                key={p.id}
                className="enterprise-glass flex flex-col gap-3 rounded-xl p-4 transition-transform duration-200 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      p.priority === "P1"
                        ? "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]"
                        : p.priority === "P2"
                          ? "border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]"
                          : "border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]"
                    }`}
                  >
                    <CircleAlert className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[var(--enterprise-primary)]">
                      {p.priority}
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--enterprise-text)]">{p.location}</p>
                    <p className="text-xs text-[var(--enterprise-text-muted)]">{p.trade}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <span className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-[11px] font-medium text-[var(--enterprise-text-muted)]">
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
