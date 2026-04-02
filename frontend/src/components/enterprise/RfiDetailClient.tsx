"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Calendar, Clock, FileText, Link2, MapPin, Send, User, X } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { fetchProjectRfis } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

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

function formatFullDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function riskColor(risk: string | null): string {
  if (risk === "high") return "bg-red-50 text-[#EF4444]";
  if (risk === "med") return "bg-amber-50 text-amber-600";
  if (risk === "low") return "bg-[#10B981]/10 text-[#10B981]";
  return "bg-slate-50 text-[#64748B]";
}

export function RfiDetailClient({ projectId, rfiId }: { projectId: string; rfiId: string }) {
  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.projectRfis(projectId),
    queryFn: () => fetchProjectRfis(projectId),
  });

  const rfi = rows.find((r) => r.id === rfiId);
  const rfiNum = rfi ? String(rows.length - rows.indexOf(rfi)).padStart(3, "0") : "—";

  const [response, setResponse] = useState("");

  if (isPending) {
    return <EnterpriseLoadingState message="Loading RFI…" label="Loading RFI details" />;
  }

  if (!rfi) {
    return (
      <div
        className="border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]"
        style={{ borderRadius: "12px" }}
      >
        RFI not found.{" "}
        <Link href={`/projects/${projectId}/rfi`} className="text-[#2563EB] hover:underline">
          Back to RFIs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/projects/${projectId}/rfi`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] transition hover:text-[#0F172A]"
      >
        <ArrowLeft className="h-4 w-4" />
        RFIs
      </Link>

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          RFI #{rfiNum}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A]">{rfi.title}</h1>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A]">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[rfi.status] ?? "bg-slate-400"}`} />
          {STATUS_LABEL[rfi.status] ?? rfi.status}
        </span>
        {rfi.risk && (
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${riskColor(rfi.risk)}`}
          >
            {rfi.risk === "high" ? "High" : rfi.risk === "med" ? "Medium" : "Low"} Priority
          </span>
        )}
      </div>

      {/* Info grid */}
      <div
        className="grid gap-4 border border-[#E2E8F0] bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"
        style={{
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-[#94A3B8]">Assigned</p>
            <p className="text-sm font-medium text-[#0F172A]">{rfi.fromDiscipline ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-[#94A3B8]">Due</p>
            <p className="text-sm font-medium text-[#0F172A]">{formatFullDate(rfi.dueDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-[#64748B]">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-[#94A3B8]">Created</p>
            <p className="text-sm font-medium text-[#0F172A]">{formatFullDate(rfi.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-500">
            <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <p className="text-[11px] text-[#94A3B8]">Linked drawing</p>
            <p className="text-sm font-medium text-[#2563EB]">—</p>
          </div>
        </div>
      </div>

      {/* Question */}
      <div
        className="border border-[#E2E8F0] bg-white p-6"
        style={{
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Question</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#0F172A]">
          {rfi.description ?? "No description provided. Edit this RFI to add details."}
        </p>
        {/* Linked items */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#64748B]">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            No drawing linked
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#64748B]">
            <MapPin className="h-3 w-3" />
            No issue linked
          </span>
        </div>
      </div>

      {/* Response */}
      <div
        className="border border-[#E2E8F0] bg-white p-6"
        style={{
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Response</h2>
        {rfi.status === "ANSWERED" ? (
          <p className="mt-3 text-sm leading-relaxed text-[#0F172A]">Response has been provided.</p>
        ) : (
          <div className="mt-3">
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={4}
              className="w-full border border-[#E2E8F0] px-3 py-2.5 text-sm placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              style={{ borderRadius: "8px" }}
              placeholder="Awaiting response…"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
          style={{ borderRadius: "8px" }}
        >
          <Send className="h-4 w-4" />
          Send RFI
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F8FAFC]"
          style={{ borderRadius: "8px" }}
        >
          <Link2 className="h-4 w-4" />
          Link to Issue
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#64748B] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F8FAFC]"
          style={{ borderRadius: "8px" }}
        >
          <X className="h-4 w-4" />
          Close RFI
        </button>
      </div>
    </div>
  );
}
