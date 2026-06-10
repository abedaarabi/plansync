"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { ProposalCoverEditor } from "@/components/enterprise/proposals/editor/ProposalCoverEditor";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  createProposalTemplate,
  deleteProposalTemplate,
  fetchProposalTemplates,
  patchProposalTemplate,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { OM_COMPACT_INPUT, OM_COMPACT_LABEL, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { FileText } from "lucide-react";

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
  const isAdmin = primary?.role === "ADMIN" || primary?.role === "SUPER_ADMIN";

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
    <div className={`mx-auto w-full max-w-3xl ${OM_PAGE_CLASS}`}>
      <OmSubPageHeader
        icon={FileText}
        title="Proposal templates"
        description="Reusable proposal bodies with merge variables."
        action={
          <Link
            href={base}
            className="inline-flex min-h-9 items-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-sm hover:bg-[var(--enterprise-hover-surface)]"
          >
            ← Proposals
          </Link>
        }
      />

      <ul className="divide-y divide-[var(--enterprise-border)] rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
        {data.templates.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
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

      <div className="enterprise-card p-3 sm:p-4">
        <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
          {editingId ? "Edit template" : "New template"}
        </h2>
        <label className="mt-3 block">
          <span className={OM_COMPACT_LABEL}>Name</span>
          <input
            className={OM_COMPACT_INPUT}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm text-slate-600">Body</span>
            <div className="flex flex-wrap gap-1.5">
              {VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-100"
                  onClick={() => setBody((b) => b + v)}
                  title={`Insert ${v}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <ProposalCoverEditor
            content={body}
            onChange={(html) => setBody(html)}
            placeholder="Write your template here. Use variable chips above to insert dynamic values."
          />
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
