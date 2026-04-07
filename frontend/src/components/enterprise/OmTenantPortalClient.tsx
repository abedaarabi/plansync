"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { fetchOccupantTokens, postOccupantToken, ProRequiredError } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

type Props = { projectId: string };

export function OmTenantPortalClient({ projectId }: Props) {
  const qc = useQueryClient();
  const {
    data: tokens = [],
    isPending,
    error,
  } = useQuery({
    queryKey: qk.occupantTokens(projectId),
    queryFn: () => fetchOccupantTokens(projectId),
  });

  const createMut = useMutation({
    mutationFn: () => postOccupantToken(projectId, { label: "Building link" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.occupantTokens(projectId) });
      toast.success("New portal link created.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  if (isPending) {
    return <EnterpriseLoadingState message="Loading portal links…" label="Loading" />;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof Error ? error.message : "Could not load links."}
      </p>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--enterprise-border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]"
            aria-hidden
          >
            <Building2 className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Tenant portal
            </h1>
            <p className="mt-1.5 text-sm text-[var(--enterprise-text-muted)]">
              Share a link with occupants to report issues without logging in. Requests create work
              orders and notify workspace admins.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          New link
        </button>
      </header>

      {tokens.length === 0 ? (
        <div className="enterprise-card px-4 py-12 text-center text-sm text-[var(--enterprise-text-muted)]">
          No active links. Create one and share the URL with tenants.
        </div>
      ) : (
        <ul className="space-y-3">
          {tokens.map((t) => {
            const url = `${origin}/occupant/${t.token}`;
            return (
              <li key={t.id} className="enterprise-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--enterprise-text)]">{t.label}</p>
                    <p className="mt-1 break-all font-mono text-xs text-[var(--enterprise-text-muted)]">
                      {url}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Copied to clipboard.");
                      } catch {
                        toast.error("Could not copy.");
                      }
                    }}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
