"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  fetchVendorWorkOrderMeta,
  patchVendorWorkOrder,
  type WorkOrderChecklistItem,
  type WorkOrderChecklistResult,
} from "@/lib/api-client";

type Props = { params: Promise<{ token: string }> };

export default function VendorWorkOrderPage({ params }: Props) {
  const { token } = use(params);
  const [results, setResults] = useState<Record<string, WorkOrderChecklistResult>>({});
  const [notes, setNotes] = useState("");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["vendorWo", token],
    queryFn: () => fetchVendorWorkOrderMeta(token),
  });

  const completeMut = useMutation({
    mutationFn: () =>
      patchVendorWorkOrder(token, {
        status: "RESOLVED",
        completionNotes: notes.trim() || undefined,
        procedureResultJson: Object.values(results),
      }),
    onSuccess: () => {
      toast.success("Work order marked complete. Thank you!");
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: () => patchVendorWorkOrder(token, { status: "IN_PROGRESS" }),
    onSuccess: () => void refetch(),
  });

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--enterprise-bg,#f8fafc)]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-[#b91c1c]">{error instanceof Error ? error.message : "Invalid link."}</p>
      </div>
    );
  }

  const checklist: WorkOrderChecklistItem[] = data.procedureJson ?? [];
  const done = data.status === "RESOLVED" || data.status === "CLOSED";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#f8fafc] to-white px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#bfdbfe] bg-[#eff6ff]">
            <Wrench className="h-7 w-7 text-[#2563eb]" />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            {data.projectName}
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#0f172a]">{data.title}</h1>
          {data.asset ? (
            <p className="mt-2 text-sm text-[#475569]">
              {data.asset.tag} — {data.asset.name}
            </p>
          ) : null}
        </header>

        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-[#64748b]">Status</p>
          <p className="mt-1 font-semibold text-[#0f172a]">{data.status.replace("_", " ")}</p>
          {data.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-[#334155]">{data.description}</p>
          ) : null}
        </div>

        {!done && data.status === "OPEN" ? (
          <button
            type="button"
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
            className="w-full rounded-xl bg-[#2563eb] py-3 text-sm font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            Start work
          </button>
        ) : null}

        {!done && checklist.length > 0 ? (
          <div className="space-y-3 rounded-2xl border border-[#e2e8f0] bg-white p-5">
            <p className="text-sm font-semibold text-[#0f172a]">Checklist</p>
            {checklist.map((it) => {
              const r = results[it.id] ?? { itemId: it.id, outcome: null, note: "" };
              return (
                <label key={it.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.outcome === "done" || r.outcome === "pass"}
                    onChange={(e) =>
                      setResults((prev) => ({
                        ...prev,
                        [it.id]: { ...r, outcome: e.target.checked ? "done" : null },
                      }))
                    }
                    className="mt-1"
                  />
                  <span>{it.label}</span>
                </label>
              );
            })}
          </div>
        ) : null}

        {!done ? (
          <>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Completion notes…"
              className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => completeMut.mutate()}
              disabled={completeMut.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#059669] py-3 text-sm font-bold text-white hover:bg-[#047857] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark complete
            </button>
          </>
        ) : (
          <p className="text-center text-sm font-semibold text-[#047857]">
            This work order is complete.
          </p>
        )}
      </div>
    </div>
  );
}
