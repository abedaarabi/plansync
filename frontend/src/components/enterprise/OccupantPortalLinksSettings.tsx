"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Copy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchOccupantTokens,
  fetchRevokedOccupantTokens,
  postOccupantToken,
  ProRequiredError,
  revokeOccupantToken,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";

type Props = { projectId: string };

export function OccupantPortalLinksSettings({ projectId }: Props) {
  const qc = useQueryClient();
  const { primary } = useEnterpriseWorkspace();
  const hubHref = primary
    ? `/workspaces/${primary.workspace.id}/projects/${projectId}/om/tenant-portal`
    : `/projects/${projectId}/om/tenant-portal`;

  const { data: tokens = [], isPending: tokensPending } = useQuery({
    queryKey: qk.occupantTokens(projectId),
    queryFn: () => fetchOccupantTokens(projectId),
  });

  const { data: revoked = [], isPending: revokedPending } = useQuery({
    queryKey: qk.occupantTokensRevoked(projectId),
    queryFn: () => fetchRevokedOccupantTokens(projectId),
  });

  const createMut = useMutation({
    mutationFn: (label: string) => postOccupantToken(projectId, { label }),
    onSuccess: async (_, label) => {
      await qc.invalidateQueries({ queryKey: qk.occupantTokens(projectId) });
      toast.success(
        label.startsWith("Optional") ? "Optional building link added." : "Building link created.",
      );
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const revokeMut = useMutation({
    mutationFn: (tokenId: string) => revokeOccupantToken(projectId, tokenId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.occupantTokens(projectId) });
      await qc.invalidateQueries({ queryKey: qk.occupantTokensRevoked(projectId) });
      toast.success("Link revoked.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const canRevokeAny = tokens.length > 1;

  return (
    <div className="space-y-4 border-b border-[var(--enterprise-border)] py-4 last:border-0">
      <div>
        <h3 className="text-sm font-medium text-[var(--enterprise-text)]">Building entry links</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
          Active URLs for the public occupant form. Keep at least one link. Revoke old links after
          rotation. Overview and shortcuts are on the{" "}
          <Link href={hubHref} className="font-semibold text-[var(--enterprise-primary)] underline">
            Occupant hub
          </Link>
          .
        </p>
      </div>

      {tokensPending ? (
        <p className="flex items-center gap-2 text-sm text-[var(--enterprise-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading links…
        </p>
      ) : (
        <ul className="space-y-3">
          {tokens.map((t, idx) => {
            const url = `${origin}/occupant/${t.token}`;
            const isPrimary = idx === 0;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3 sm:p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPrimary ? (
                        <span className="rounded-md bg-[var(--enterprise-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                          Primary
                        </span>
                      ) : null}
                      <span className="text-sm font-semibold text-[var(--enterprise-text)]">
                        {t.label}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] leading-snug text-[var(--enterprise-text-muted)] sm:text-xs">
                      {url}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">
                      Created {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          toast.success("URL copied.");
                        } catch {
                          toast.error("Could not copy.");
                        }
                      }}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)] sm:min-h-0 sm:flex-initial"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={!canRevokeAny || revokeMut.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Revoke this building link? Scans using it will stop working. This cannot be undone.",
                          )
                        )
                          return;
                        revokeMut.mutate(t.id);
                      }}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-surface)] px-3 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)] disabled:opacity-50 sm:min-h-0 sm:flex-initial"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => createMut.mutate("Optional building link")}
          disabled={createMut.isPending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-4 text-sm font-semibold text-[var(--enterprise-text)] sm:w-auto"
        >
          <Link2 className="h-4 w-4" />
          Add optional building link
        </button>
      </div>

      <details className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-[var(--enterprise-text)] sm:text-sm">
          Revoked links ({revokedPending ? "…" : revoked.length})
        </summary>
        {revokedPending ? (
          <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">Loading…</p>
        ) : revoked.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">None yet.</p>
        ) : (
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {revoked.map((r) => (
              <li
                key={r.id}
                className="border-t border-[var(--enterprise-border)]/70 pt-2 text-xs first:border-t-0 first:pt-0"
              >
                <span className="font-medium text-[var(--enterprise-text)]">{r.label}</span>
                <span className="text-[var(--enterprise-text-muted)]"> · …{r.tokenSuffix}</span>
                <p className="text-[var(--enterprise-text-muted)]">
                  Revoked {new Date(r.revokedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
