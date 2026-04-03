"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  createProposalTemplate,
  deleteProposalTemplate,
  fetchProposalTemplates,
  patchProposalTemplate,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

const VARS = [
  "{{client.name}}",
  "{{client.company}}",
  "{{project.name}}",
  "{{proposal.total}}",
  "{{proposal.expiry}}",
  "{{takeoff.table}}",
  "{{company.name}}",
  "{{user.name}}",
  "{{user.title}}",
  "{{proposal.reference}}",
];

export function ProposalTemplatesClient({
  projectId,
  workspaceId: wsFromPath,
}: {
  projectId: string;
  workspaceId?: string;
}) {
  const qc = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isAdmin = primary?.role === "ADMIN";

  const base = wsFromPath
    ? `/workspaces/${wsFromPath}/projects/${projectId}/proposals`
    : `/projects/${projectId}/proposals`;

  const { data, isPending } = useQuery({
    queryKey: qk.proposalTemplates(wid ?? ""),
    queryFn: () => fetchProposalTemplates(wid!),
    enabled: Boolean(wid),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!wid) throw new Error("No workspace");
      if (editingId) {
        await patchProposalTemplate(wid, editingId, { name, body });
      } else {
        await createProposalTemplate(wid, { name, body });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.proposalTemplates(wid ?? "") });
      toast.success("Saved");
      setEditingId(null);
      setName("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => {
      if (!wid) throw new Error("No workspace");
      return deleteProposalTemplate(wid, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.proposalTemplates(wid ?? "") });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ctxLoading || !wid) return <EnterpriseLoadingState label="Loading…" />;
  if (isPending || !data) return <EnterpriseLoadingState label="Loading templates…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={base} className="text-sm font-medium text-[#2563EB] hover:underline">
        ← Proposals
      </Link>
      <h1 className="text-xl font-semibold text-[#0F172A]">Proposal templates</h1>

      <ul className="space-y-2">
        {data.templates.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <span className="font-medium">{t.name}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-sm text-[#2563EB]"
                onClick={() => {
                  setEditingId(t.id);
                  setName(t.name);
                  setBody(t.body);
                }}
              >
                Edit
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => {
                    if (confirm("Delete this template?")) delMut.mutate(t.id);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">{editingId ? "Edit template" : "New template"}</h2>
        <label className="mt-4 block text-sm">
          <span className="text-slate-600">Name</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="text-slate-600">Body</span>
          <textarea
            className="mt-1 min-h-[220px] w-full rounded-lg border border-slate-200 p-3 font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Insert</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {VARS.map((v) => (
              <button
                key={v}
                type="button"
                className="rounded-full bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700"
                onClick={() => setBody((b) => `${b}${v}`)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={saveMut.isPending || !name.trim() || !body.trim()}
            onClick={() => saveMut.mutate()}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save template
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setName("");
                setBody("");
              }}
              className="text-sm text-slate-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
