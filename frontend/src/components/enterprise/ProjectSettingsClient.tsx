"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createProjectApiKey,
  fetchProjectSession,
  listProjectApiKeys,
  patchProject,
  patchProjectSettings,
  revokeProjectApiKey,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { isSuperAdmin, isWorkspaceManager } from "@/lib/workspaceRole";
import { isWorkspaceOmBillingClient } from "@/lib/workspaceSubscription";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { OccupantPortalLinksSettings } from "./OccupantPortalLinksSettings";
import { AccessRestricted } from "./AccessRestricted";

type Props = { projectId: string };

export function ProjectSettingsClient({ projectId }: Props) {
  const queryClient = useQueryClient();
  const { primary, loading: meLoading } = useEnterpriseWorkspace();
  const canEditSettings = isSuperAdmin(primary?.role);
  const canManageApiKeys = isWorkspaceManager(primary?.role);

  const { data: session, isPending } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  const mutation = useMutation({
    mutationFn: ({
      projectId: pid,
      patch,
    }: {
      projectId: string;
      patch: Parameters<typeof patchProjectSettings>[1];
    }) => patchProjectSettings(pid, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.projectSession(projectId) });
    },
  });

  const [occupantHeadlineDraft, setOccupantHeadlineDraft] = useState("");
  const [apiKeyNameDraft, setApiKeyNameDraft] = useState("");
  const [newApiKeyPlainText, setNewApiKeyPlainText] = useState<string | null>(null);

  const apiKeysQuery = useQuery({
    queryKey: qk.projectApiKeys(projectId),
    queryFn: () => listProjectApiKeys(projectId),
    enabled: canManageApiKeys,
  });

  const createApiKeyMutation = useMutation({
    mutationFn: (name: string) => createProjectApiKey(projectId, { name }),
    onSuccess: async (created) => {
      setNewApiKeyPlainText(created.apiKey);
      setApiKeyNameDraft("");
      await queryClient.invalidateQueries({ queryKey: qk.projectApiKeys(projectId) });
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => revokeProjectApiKey(projectId, keyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.projectApiKeys(projectId) });
    },
  });

  useEffect(() => {
    if (!session) return;
    setOccupantHeadlineDraft(session.settings.omTenantPortalUi?.headline ?? "");
  }, [session]);

  const opModeMutation = useMutation({
    mutationFn: (operationsMode: boolean) => patchProject(projectId, { operationsMode }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.projectSession(projectId) });
      await queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
    },
  });

  if (meLoading || isPending || !session) {
    return <EnterpriseLoadingState message="Loading settings…" label="Loading" />;
  }

  if (!canManageApiKeys) {
    return <AccessRestricted backHref={`/projects/${projectId}/home`} />;
  }

  const m = session.settings.modules;
  const c = session.settings.clientVisibility;
  const om = session.operationsMode;
  const ws = primary?.workspace;
  const omBilling = isWorkspaceOmBillingClient(ws);
  const billingHref = isSuperAdmin(primary?.role) ? "/organization?tab=billing" : "/organization";

  function toggleModule(key: keyof typeof m, value: boolean) {
    mutation.mutate({ projectId, patch: { modules: { [key]: value } } });
  }

  function toggleClient(key: keyof typeof c, value: boolean) {
    mutation.mutate({ projectId, patch: { clientVisibility: { [key]: value } } });
  }

  const row = (label: string, on: boolean, onToggle: (v: boolean) => void, disabled?: boolean) => (
    <div className="flex flex-col gap-2 border-b border-[var(--enterprise-border)] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-[var(--enterprise-text)]">{label}</span>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <span className="text-xs text-[var(--enterprise-text-muted)]">{on ? "On" : "Off"}</span>
        <input
          type="checkbox"
          className="h-5 w-10 min-h-[44px] min-w-[44px] cursor-pointer accent-[var(--enterprise-primary)]"
          checked={on}
          disabled={disabled || mutation.isPending}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </label>
    </div>
  );

  return (
    <div className="enterprise-animate-in space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)]"
          aria-hidden
        >
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
            Project settings
          </h1>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            {session.projectName} — modules and client portal visibility (Super Admin only).
          </p>
        </div>
      </header>

      <section className="enterprise-card divide-y divide-[var(--enterprise-border)] p-4 sm:p-6">
        <h2 className="pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Modules
        </h2>
        {!canEditSettings ? (
          <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
            Module toggles are editable by Super Admin only.
          </p>
        ) : (
          <>
            <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
              Disabled modules are hidden from the sidebar for everyone on this project.
            </p>
            {row("Issues", m.issues, (v) => toggleModule("issues", v))}
            {row("RFIs", m.rfis, (v) => toggleModule("rfis", v))}
            {row("Quantity Takeoff", m.takeoff, (v) => toggleModule("takeoff", v))}
            {row("Proposals", m.proposals, (v) => toggleModule("proposals", v))}
            {row("Punch List", m.punch, (v) => toggleModule("punch", v))}
            {row("Field Reports", m.fieldReports, (v) => toggleModule("fieldReports", v))}
            {row("Construction schedule", m.schedule, (v) => toggleModule("schedule", v))}
          </>
        )}
      </section>

      <section className="enterprise-card divide-y divide-[var(--enterprise-border)] p-4 sm:p-6">
        <h2 className="pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Operations &amp; Maintenance
        </h2>
        {!canEditSettings ? (
          <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
            O&amp;M module settings are editable by Super Admin only.
          </p>
        ) : (
          <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
            Turn on for handover buildings: the{" "}
            <strong className="font-medium text-[var(--enterprise-text)]">Handover</strong> hub
            (readiness snapshot), asset register, work orders, preventive maintenance, inspections,
            and occupant reporting. Set lifecycle stage to <strong>Handover &amp; FM</strong> from
            the project editor when you enter commissioning.
          </p>
        )}
        {!omBilling ? (
          <div className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <p className="font-medium text-amber-950">Enterprise plan required</p>
            <p className="mt-1.5 text-xs leading-relaxed text-amber-900/90">
              O&amp;M navigation and hubs are included with the{" "}
              <strong className="font-semibold">Enterprise</strong> workspace plan. Upgrade under{" "}
              <strong className="font-semibold">Organization → Plan &amp; billing</strong> so this
              project can use handover, assets, maintenance, inspections, and occupant reporting
              after you turn on Operations mode.
            </p>
            <div className="mt-3">
              {isSuperAdmin(primary?.role) ? (
                <Link
                  href={billingHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  Open Plan &amp; billing
                </Link>
              ) : (
                <p className="text-xs font-medium text-amber-900/90">
                  Ask a workspace Super Admin to upgrade the plan in Plan &amp; billing.
                </p>
              )}
            </div>
          </div>
        ) : null}
        {canEditSettings
          ? row("Operations mode", om, (v) => opModeMutation.mutate(v), opModeMutation.isPending)
          : null}
        {canEditSettings && om ? (
          <>
            {row("O&M: Assets", m.omAssets ?? true, (v) => toggleModule("omAssets", v))}
            {row("O&M: Maintenance (PPM)", m.omMaintenance ?? true, (v) =>
              toggleModule("omMaintenance", v),
            )}
            {row("O&M: Inspections", m.omInspections ?? true, (v) =>
              toggleModule("omInspections", v),
            )}
            {row("O&M: Occupant portal", m.omTenantPortal ?? true, (v) =>
              toggleModule("omTenantPortal", v),
            )}
            {m.omTenantPortal ? (
              <>
                <OccupantPortalLinksSettings projectId={projectId} />
                <div className="border-b border-[var(--enterprise-border)] py-4 last:border-0">
                  <label className="block text-sm font-medium text-[var(--enterprise-text)]">
                    Occupant page headline
                  </label>
                  <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                    Optional line shown at the top of the public occupant form (building or
                    equipment scan). Leave blank to use the default.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      maxLength={200}
                      value={occupantHeadlineDraft}
                      onChange={(e) => setOccupantHeadlineDraft(e.target.value)}
                      disabled={mutation.isPending}
                      placeholder="e.g. Report a maintenance issue for this building"
                      className="min-h-11 w-full max-w-xl rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
                    />
                    <button
                      type="button"
                      disabled={
                        mutation.isPending ||
                        occupantHeadlineDraft.trim() ===
                          (session.settings.omTenantPortalUi?.headline ?? "").trim()
                      }
                      onClick={() =>
                        mutation.mutate({
                          projectId,
                          patch: {
                            omTenantPortalUi: {
                              headline:
                                occupantHeadlineDraft.trim().length === 0
                                  ? null
                                  : occupantHeadlineDraft.trim(),
                            },
                          },
                        })
                      }
                      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Save headline
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="enterprise-card p-4 sm:p-6">
        <h2 className="pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Integration API keys
        </h2>
        <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
          Admin and Super Admin can create project-scoped API keys for integrations. New keys are
          shown once, then hidden.
        </p>
        {newApiKeyPlainText ? (
          <div className="mb-4 rounded-xl border border-emerald-300/80 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-900">Copy and store this key now</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block w-full overflow-x-auto rounded-lg border border-emerald-300/80 bg-white px-3 py-2 text-xs text-emerald-950">
                {newApiKeyPlainText}
              </code>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white"
                onClick={async () => {
                  await navigator.clipboard.writeText(newApiKeyPlainText);
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-400 bg-white px-4 text-sm font-semibold text-emerald-900"
                onClick={() => setNewApiKeyPlainText(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={apiKeyNameDraft}
            onChange={(e) => setApiKeyNameDraft(e.target.value)}
            placeholder="Key name (e.g. Power BI sync)"
            className="min-h-11 w-full max-w-xl rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
            disabled={createApiKeyMutation.isPending}
            maxLength={120}
          />
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            disabled={createApiKeyMutation.isPending}
            onClick={() => createApiKeyMutation.mutate(apiKeyNameDraft.trim() || "Integration key")}
          >
            {createApiKeyMutation.isPending ? "Creating..." : "Create key"}
          </button>
        </div>
        <div className="space-y-2">
          {apiKeysQuery.isLoading ? (
            <p className="text-xs text-[var(--enterprise-text-muted)]">Loading keys...</p>
          ) : null}
          {apiKeysQuery.data?.items?.length ? (
            apiKeysQuery.data.items.map((k) => (
              <div
                key={k.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--enterprise-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
                    {k.name}
                  </p>
                  <p className="text-xs text-[var(--enterprise-text-muted)]">
                    {k.keyPrefix}... | Created {new Date(k.createdAt).toLocaleString()} | Last used{" "}
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                  </p>
                  {k.revokedAt ? (
                    <p className="text-xs font-medium text-amber-700">
                      Revoked {new Date(k.revokedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                {!k.revokedAt ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-50"
                    disabled={revokeApiKeyMutation.isPending}
                    onClick={() => revokeApiKeyMutation.mutate(k.id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--enterprise-text-muted)]">No API keys yet.</p>
          )}
        </div>
      </section>

      {canEditSettings ? (
        <section className="enterprise-card divide-y divide-[var(--enterprise-border)] p-4 sm:p-6">
          <h2 className="pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Client visibility
          </h2>
          <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
            Controls what clients see in their portal when invited to this project.
          </p>
          {row("Show issues to client", c.showIssues, (v) => toggleClient("showIssues", v))}
          {row("Show RFIs to client", c.showRfis, (v) => toggleClient("showRfis", v))}
          {row("Show field reports", c.showFieldReports, (v) =>
            toggleClient("showFieldReports", v),
          )}
          {row("Show punch list", c.showPunchList, (v) => toggleClient("showPunchList", v))}
          {row("Allow client to comment", c.allowClientComment, (v) =>
            toggleClient("allowClientComment", v),
          )}
        </section>
      ) : null}

      {mutation.isError ? (
        <p className="text-sm text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : "Could not save."}
        </p>
      ) : null}
      {createApiKeyMutation.isError ? (
        <p className="text-sm text-red-600">
          {createApiKeyMutation.error instanceof Error
            ? createApiKeyMutation.error.message
            : "Could not create API key."}
        </p>
      ) : null}
      {revokeApiKeyMutation.isError ? (
        <p className="text-sm text-red-600">
          {revokeApiKeyMutation.error instanceof Error
            ? revokeApiKeyMutation.error.message
            : "Could not revoke API key."}
        </p>
      ) : null}
    </div>
  );
}
