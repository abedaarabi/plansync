"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CloudSun, Image as ImageIcon, Plus } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useState } from "react";
import { nanoid } from "nanoid";
import {
  createFieldReport,
  fetchProjectFieldReports,
  ProRequiredError,
  type FieldReportRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { ProjectScopeHeader } from "./ProjectScopeHeader";

export function ProjectReportsClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState("");
  const [authorLabel, setAuthorLabel] = useState("");
  const [photoCount, setPhotoCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const { data: reports = [], isPending } = useQuery({
    queryKey: qk.projectFieldReports(projectId),
    queryFn: () => fetchProjectFieldReports(projectId),
  });

  const createMut = useMutation({
    mutationFn: (vars: {
      tempId: string;
      reportDateIso: string;
      weather?: string;
      authorLabel?: string;
      photoCount: number;
      issueCount: number;
      notes?: string;
    }) =>
      createFieldReport(projectId, {
        reportDate: vars.reportDateIso,
        weather: vars.weather,
        authorLabel: vars.authorLabel,
        photoCount: vars.photoCount,
        issueCount: vars.issueCount,
        notes: vars.notes,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.projectFieldReports(projectId) });
      const prev = qc.getQueryData<FieldReportRow[]>(qk.projectFieldReports(projectId));
      const optimistic: FieldReportRow = {
        id: vars.tempId,
        projectId,
        reportDate: vars.reportDateIso,
        weather: vars.weather?.trim() ? vars.weather.trim() : null,
        authorLabel: vars.authorLabel?.trim() ? vars.authorLabel.trim() : null,
        photoCount: vars.photoCount,
        issueCount: vars.issueCount,
        notes: vars.notes?.trim() ? vars.notes.trim() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<FieldReportRow[]>(qk.projectFieldReports(projectId), (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(qk.projectFieldReports(projectId), ctx.prev);
      if (e instanceof ProRequiredError) {
        setMsg("Pro subscription required to add field reports.");
        return;
      }
      setMsg(e.message);
    },
    onSuccess: (data, vars) => {
      qc.setQueryData<FieldReportRow[]>(qk.projectFieldReports(projectId), (old) =>
        (old ?? []).map((r) => (r.id === vars.tempId ? data : r)),
      );
      setOpen(false);
      setMsg(null);
    },
  });

  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <ProjectScopeHeader projectId={projectId} currentLabel="Field reports" />

        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Field reports
            </h1>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Daily logs scoped to this project.
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
            New report
          </button>
        </header>

        {open ? (
          <form
            className="enterprise-card mb-8 space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate({
                tempId: `optimistic-${nanoid()}`,
                reportDateIso: new Date(reportDate + "T12:00:00.000Z").toISOString(),
                weather: weather.trim() || undefined,
                authorLabel: authorLabel.trim() || undefined,
                photoCount,
                issueCount,
                notes: notes.trim() || undefined,
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-[var(--enterprise-text-muted)]">Report date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-[var(--enterprise-text-muted)]">Weather</label>
                <input
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  placeholder="52°F · Overcast"
                  className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-[var(--enterprise-text-muted)]">Author label</label>
                <input
                  value={authorLabel}
                  onChange={(e) => setAuthorLabel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--enterprise-text-muted)]">Photos</label>
                <input
                  type="number"
                  min={0}
                  value={photoCount}
                  onChange={(e) => setPhotoCount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--enterprise-text-muted)]">Issues</label>
                <input
                  type="number"
                  min={0}
                  value={issueCount}
                  onChange={(e) => setIssueCount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
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
              message="Loading field reports…"
              label="Loading field reports"
            />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">No field reports yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <article
                key={r.id}
                className="enterprise-glass group flex flex-col rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {new Date(r.reportDate).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </div>
                  <span className="enterprise-badge-neutral px-2 py-0.5 text-[10px] text-[var(--enterprise-text-muted)]">
                    Logged
                  </span>
                </div>
                {r.weather ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-[var(--enterprise-text)]">
                    <CloudSun
                      className="h-4 w-4 text-[var(--enterprise-primary)]"
                      strokeWidth={1.75}
                    />
                    {r.weather}
                  </div>
                ) : null}
                {r.authorLabel ? (
                  <p className="mt-3 text-xs text-[var(--enterprise-text-muted)]">
                    <span className="text-[var(--enterprise-text)]">{r.authorLabel}</span>
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3 border-t border-[var(--enterprise-border)] pt-4 text-xs text-[var(--enterprise-text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {r.photoCount} photos
                  </span>
                  <span>
                    Issues:{" "}
                    <span
                      className={
                        r.issueCount > 0
                          ? "font-medium text-[var(--enterprise-error)]"
                          : "text-[var(--enterprise-success)]"
                      }
                    >
                      {r.issueCount}
                    </span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
