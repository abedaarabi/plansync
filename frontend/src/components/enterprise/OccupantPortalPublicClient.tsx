"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fetchOccupantMeta, postOccupantSubmit } from "@/lib/api-client";

type Props = { token: string };

export function OccupantPortalPublicClient({ token }: Props) {
  const [description, setDescription] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: meta,
    isPending,
    error,
  } = useQuery({
    queryKey: ["occupantMeta", token],
    queryFn: () => fetchOccupantMeta(token),
    retry: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !reporterName.trim() || !reporterEmail.trim()) {
      toast.error("Please fill in description, your name, and email.");
      return;
    }
    setSubmitting(true);
    try {
      await postOccupantSubmit(token, {
        description: description.trim(),
        floor: floor.trim() || undefined,
        room: room.trim() || undefined,
        reporterName: reporterName.trim(),
        reporterEmail: reporterEmail.trim(),
      });
      setSent(true);
      toast.success("Your request was submitted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "This link is not valid."}
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
          <Send className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Thank you</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Facilities has received your request. You will be contacted if more information is needed.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
          <Building2 className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Occupant request
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {meta.projectName}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Report a maintenance issue. No account required.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">What is the issue?</span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            placeholder="Describe the problem…"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Floor (optional)</span>
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Room (optional)</span>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Your name</span>
          <input
            required
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email</span>
          <input
            required
            type="email"
            value={reporterEmail}
            onChange={(e) => setReporterEmail(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {submitting ? "Sending…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
