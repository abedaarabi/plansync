"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Eye,
  KeyRound,
  Layers,
  Ruler,
  Settings,
  ShieldCheck,
  Webhook,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createProjectWebhook,
  createProjectApiKey,
  deleteProjectWebhook,
  fetchProjectSession,
  listProjectWebhooks,
  listProjectApiKeys,
  patchProject,
  patchProjectWebhook,
  patchProjectSettings,
  revokeProjectApiKey,
  type ProjectSessionResponse,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  EnterpriseButton,
  enterpriseButtonClassName,
} from "@/components/enterprise/EnterpriseButton";
import { isSuperAdmin, isWorkspaceManager } from "@/lib/workspaceRole";
import { isWorkspaceOmBillingClient } from "@/lib/workspaceSubscription";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { OccupantPortalLinksSettings } from "./OccupantPortalLinksSettings";
import { AccessRestricted } from "./AccessRestricted";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { ProjectCurrencyPicker } from "@/components/enterprise/ProjectCurrencyPicker";
import { ProjectMeasurementSystemPicker } from "@/components/enterprise/ProjectMeasurementSystemPicker";
import { OM_COMPACT_INPUT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { SettingsSection } from "@/components/enterprise/project-settings/SettingsSection";
import { SettingsToggleRow } from "@/components/enterprise/project-settings/SettingsToggleRow";
import { normalizeProjectCurrency, type ProjectCurrencyCode } from "@/lib/projectCurrency";
import {
  normalizeProjectMeasurementSystem,
  type ProjectMeasurementSystem,
} from "@/lib/projectMeasurement";

type Props = { projectId: string };

const API_KEY_SCOPE_OPTIONS = [
  "issues:read",
  "issues:write",
  "om:read",
  "om:write",
  "schedule:read",
  "schedule:write",
  "orchestration:read",
  "orchestration:write",
  "jobs:read",
  "jobs:write",
  "integrations:read",
  "integrations:write",
] as const;

// fallow-ignore-next-line complexity
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
  const [apiKeyServiceDraft, setApiKeyServiceDraft] = useState("");
  const [apiKeyScopesDraft, setApiKeyScopesDraft] = useState<string[]>([]);
  const [newApiKeyPlainText, setNewApiKeyPlainText] = useState<string | null>(null);
  const [webhookUrlDraft, setWebhookUrlDraft] = useState("");
  const [webhookEventsDraft, setWebhookEventsDraft] = useState("");
  const [modulesDraft, setModulesDraft] = useState<
    ProjectSessionResponse["settings"]["modules"] | null
  >(null);
  const [clientVisibilityDraft, setClientVisibilityDraft] = useState<
    ProjectSessionResponse["settings"]["clientVisibility"] | null
  >(null);
  const [currencyDraft, setCurrencyDraft] = useState<ProjectCurrencyCode | null>(null);
  const [measurementDraft, setMeasurementDraft] = useState<ProjectMeasurementSystem | null>(null);

  const apiKeysQuery = useQuery({
    queryKey: qk.projectApiKeys(projectId),
    queryFn: () => listProjectApiKeys(projectId),
    enabled: canManageApiKeys,
  });

  const webhooksQuery = useQuery({
    queryKey: [...qk.projectApiKeys(projectId), "webhooks"],
    queryFn: () => listProjectWebhooks(projectId),
    enabled: canManageApiKeys,
  });

  const createApiKeyMutation = useMutation({
    mutationFn: ({
      name,
      serviceLabel,
      scopes,
    }: {
      name: string;
      serviceLabel: string | null;
      scopes: string[];
    }) => createProjectApiKey(projectId, { name, serviceLabel, scopes }),
    onSuccess: async (created) => {
      setNewApiKeyPlainText(created.apiKey);
      setApiKeyNameDraft("");
      setApiKeyServiceDraft("");
      setApiKeyScopesDraft([]);
      await queryClient.invalidateQueries({ queryKey: qk.projectApiKeys(projectId) });
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => revokeProjectApiKey(projectId, keyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.projectApiKeys(projectId) });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: (payload: { url: string; events: string[] }) =>
      createProjectWebhook(projectId, payload),
    onSuccess: async () => {
      setWebhookUrlDraft("");
      setWebhookEventsDraft("");
      await queryClient.invalidateQueries({
        queryKey: [...qk.projectApiKeys(projectId), "webhooks"],
      });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ webhookId, isActive }: { webhookId: string; isActive: boolean }) =>
      patchProjectWebhook(projectId, webhookId, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...qk.projectApiKeys(projectId), "webhooks"],
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => deleteProjectWebhook(projectId, webhookId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...qk.projectApiKeys(projectId), "webhooks"],
      });
    },
  });

  useEffect(() => {
    if (!session) return;
    setOccupantHeadlineDraft(session.settings.omTenantPortalUi?.headline ?? "");
    setModulesDraft(session.settings.modules);
    setClientVisibilityDraft(session.settings.clientVisibility);
    setCurrencyDraft(normalizeProjectCurrency(session.currency));
    setMeasurementDraft(normalizeProjectMeasurementSystem(session.measurementSystem));
  }, [session]);

  const unitsMutation = useMutation({
    mutationFn: (body: {
      currency?: ProjectCurrencyCode;
      measurementSystem?: ProjectMeasurementSystem;
    }) => patchProject(projectId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.projectSession(projectId) });
      await queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      toast.success("Currency & units updated");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not update currency & units");
    },
  });

  const opModeMutation = useMutation({
    mutationFn: (operationsMode: boolean) => patchProject(projectId, { operationsMode }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.projectSession(projectId) });
      await queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
    },
  });

  const datacenterDefaultsMutation = useMutation({
    mutationFn: async () => {
      await patchProject(projectId, {
        operationsMode: true,
        projectType: "Data center",
      });
      await patchProjectSettings(projectId, {
        modules: {
          issues: true,
          rfis: false,
          takeoff: false,
          proposals: false,
          punch: true,
          fieldReports: true,
          omAssets: true,
          omMaintenance: true,
          omInspections: true,
          omTenantPortal: true,
          schedule: true,
        },
      });
    },
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

  const m = modulesDraft ?? session.settings.modules;
  const c = clientVisibilityDraft ?? session.settings.clientVisibility;
  const om = session.operationsMode;
  const ws = primary?.workspace;
  const omBilling = isWorkspaceOmBillingClient(ws);
  const billingHref = isSuperAdmin(primary?.role) ? "/organization?tab=billing" : "/organization";
  const enabledModuleCount = [
    m.issues,
    m.rfis,
    m.takeoff,
    m.proposals,
    m.punch,
    m.fieldReports,
    m.schedule,
  ].filter(Boolean).length;

  function toggleModule(key: keyof typeof m, value: boolean) {
    setModulesDraft((prev) => ({ ...(prev ?? m), [key]: value }));
    mutation.mutate({ projectId, patch: { modules: { [key]: value } } });
  }

  function toggleClient(key: keyof typeof c, value: boolean) {
    setClientVisibilityDraft((prev) => ({
      ...(prev ?? c),
      [key]: value,
    }));
    mutation.mutate({ projectId, patch: { clientVisibility: { [key]: value } } });
  }

  return (
    <div className={`${OM_PAGE_CLASS} enterprise-animate-in space-y-5`}>
      <OmSubPageHeader
        icon={Settings}
        title="Project settings"
        description="Modules, integrations, O&M, and what clients see on this project."
      />

      <div className="enterprise-card overflow-hidden">
        <div className="border-b border-[var(--enterprise-border)] bg-[linear-gradient(135deg,var(--enterprise-primary-soft),transparent_55%)] px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-border)]"
              aria-hidden
            >
              <Building2 className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                Active project
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                {session.projectName}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--enterprise-subtitle)]">
                Configure what your team uses day to day. Disabled modules disappear from the
                sidebar for everyone on this project.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="enterprise-badge-neutral">
                  {enabledModuleCount} construction module{enabledModuleCount === 1 ? "" : "s"} on
                </span>
                {om ? (
                  <span className="enterprise-badge-success">Operations mode</span>
                ) : (
                  <span className="enterprise-badge-neutral">Construction mode</span>
                )}
                {canEditSettings ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--enterprise-text-muted)]">
                    <ShieldCheck className="h-3 w-3 text-[var(--enterprise-primary)]" aria-hidden />
                    Super Admin
                  </span>
                ) : (
                  <span className="enterprise-badge-neutral">Admin · view / integrations</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-3 sm:px-6">
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            <span className="font-medium text-[var(--enterprise-text)]">Modules</span> — hide tools
            you are not using so the workspace stays focused.
          </p>
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            <span className="font-medium text-[var(--enterprise-text)]">Integrations</span> — API
            keys and webhooks for BI, automation, and partners.
          </p>
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            <span className="font-medium text-[var(--enterprise-text)]">Clients &amp; O&amp;M</span>{" "}
            — portal visibility and Enterprise handover features.
          </p>
        </div>
      </div>

      <SettingsSection
        icon={Ruler}
        title="Currency & units"
        description="Project currency and measurement system apply across budgets, takeoffs, PDF/BIM measurements, and new proposals."
      >
        {!canEditSettings ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            Currency and measurement settings are editable by Super Admin only.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="enterprise-field-label mb-2">Project currency</p>
              <ProjectCurrencyPicker
                value={currencyDraft ?? normalizeProjectCurrency(session.currency)}
                disabled={unitsMutation.isPending}
                idPrefix="settings-currency"
                onChange={(code) => {
                  setCurrencyDraft(code);
                  unitsMutation.mutate({ currency: code });
                }}
              />
            </div>
            <div>
              <p className="enterprise-field-label mb-2">Measurement system</p>
              <ProjectMeasurementSystemPicker
                value={
                  measurementDraft ?? normalizeProjectMeasurementSystem(session.measurementSystem)
                }
                disabled={unitsMutation.isPending}
                onChange={(system) => {
                  setMeasurementDraft(system);
                  unitsMutation.mutate({ measurementSystem: system });
                }}
              />
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        icon={Layers}
        title="Modules"
        description="Turn features on or off for this project. Changes apply immediately in the sidebar."
      >
        {!canEditSettings ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            Module toggles are editable by Super Admin only.
          </p>
        ) : (
          <>
            <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-3.5 py-3">
              <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                <span className="font-medium text-[var(--enterprise-text)]">
                  Data center profile
                </span>{" "}
                enables Operations mode and keeps schedule, issues, punch, field reporting, and
                O&amp;M active while turning off RFIs, takeoff, and proposals.
              </p>
              <EnterpriseButton
                type="button"
                variant="soft"
                size="sm"
                className="mt-2.5"
                loading={datacenterDefaultsMutation.isPending}
                onClick={() => datacenterDefaultsMutation.mutate()}
              >
                Apply data center defaults
              </EnterpriseButton>
            </div>
            <SettingsToggleRow
              label="Issues"
              description="Track construction issues on drawings"
              on={m.issues}
              onToggle={(v) => toggleModule("issues", v)}
            />
            <SettingsToggleRow
              label="RFIs"
              description="Request for information workflow"
              on={m.rfis}
              onToggle={(v) => toggleModule("rfis", v)}
            />
            <SettingsToggleRow
              label="Quantity takeoff"
              description="Calibrated quantities and materials (Pro+)"
              on={m.takeoff}
              onToggle={(v) => toggleModule("takeoff", v)}
            />
            <SettingsToggleRow
              label="Proposals"
              description="Estimates and client proposal portal (Pro+)"
              on={m.proposals}
              onToggle={(v) => toggleModule("proposals", v)}
            />
            <SettingsToggleRow
              label="Punch list"
              description="Closeout punch items and status"
              on={m.punch}
              onToggle={(v) => toggleModule("punch", v)}
            />
            <SettingsToggleRow
              label="Field reports"
              description="Daily / site field reporting"
              on={m.fieldReports}
              onToggle={(v) => toggleModule("fieldReports", v)}
            />
            <SettingsToggleRow
              label="Construction schedule"
              description="Project schedule and milestones"
              on={m.schedule}
              onToggle={(v) => toggleModule("schedule", v)}
            />
          </>
        )}
      </SettingsSection>

      <SettingsSection
        icon={KeyRound}
        title="Integration API keys"
        description="Project-scoped keys for Power BI, automation, and partner tools. New keys are shown once."
      >
        {newApiKeyPlainText ? (
          <div className="enterprise-alert-success px-4 py-3">
            <p className="text-xs font-semibold">Copy and store this key now</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="mobile-table-wrap block w-full overflow-x-auto rounded-lg border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs text-[var(--enterprise-text)]">
                {newApiKeyPlainText}
              </code>
              <EnterpriseButton
                type="button"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(newApiKeyPlainText)}
              >
                Copy
              </EnterpriseButton>
              <EnterpriseButton
                type="button"
                variant="soft"
                size="sm"
                onClick={() => setNewApiKeyPlainText(null)}
              >
                Dismiss
              </EnterpriseButton>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
              Key name
            </label>
            <input
              type="text"
              value={apiKeyNameDraft}
              onChange={(e) => setApiKeyNameDraft(e.target.value)}
              placeholder="e.g. Power BI sync"
              className={OM_COMPACT_INPUT}
              disabled={createApiKeyMutation.isPending}
              maxLength={120}
            />
          </div>
          <div className="min-w-0 sm:max-w-[12rem]">
            <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
              Service <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={apiKeyServiceDraft}
              onChange={(e) => setApiKeyServiceDraft(e.target.value)}
              placeholder="Service label"
              className={OM_COMPACT_INPUT}
              disabled={createApiKeyMutation.isPending}
              maxLength={120}
            />
          </div>
          <EnterpriseButton
            type="button"
            size="md"
            loading={createApiKeyMutation.isPending}
            onClick={() =>
              createApiKeyMutation.mutate({
                name: apiKeyNameDraft.trim() || "Integration key",
                serviceLabel: apiKeyServiceDraft.trim() || null,
                scopes: apiKeyScopesDraft,
              })
            }
          >
            Create key
          </EnterpriseButton>
        </div>

        <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 p-3">
          <p className="mb-2 text-xs font-medium text-[var(--enterprise-text-muted)]">
            Scopes — leave empty for full project access
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {API_KEY_SCOPE_OPTIONS.map((scope) => {
              const checked = apiKeyScopesDraft.includes(scope);
              return (
                <label
                  key={scope}
                  className="inline-flex items-center gap-2 text-xs text-[var(--enterprise-text)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setApiKeyScopesDraft((prev) =>
                        checked ? prev.filter((x) => x !== scope) : [...prev, scope],
                      )
                    }
                    className="accent-[var(--enterprise-primary)]"
                  />
                  <span className="font-mono text-[11px]">{scope}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {apiKeysQuery.isLoading ? (
            <p className="text-xs text-[var(--enterprise-text-muted)]">Loading keys…</p>
          ) : null}
          {apiKeysQuery.data?.items?.length ? (
            apiKeysQuery.data.items.map((k) => (
              <div
                key={k.id}
                className="flex flex-col gap-2 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                    {k.name}
                  </p>
                  {k.serviceLabel ? (
                    <p className="text-xs text-[var(--enterprise-text-muted)]">
                      Service: <span className="font-medium">{k.serviceLabel}</span>
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                    Scopes: {k.scopes.length > 0 ? k.scopes.join(", ") : "Full access"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                    <span className="rounded-md bg-[var(--enterprise-bg)] px-1.5 py-0.5 font-mono text-[11px]">
                      {k.keyPrefix}…
                    </span>{" "}
                    · Created {new Date(k.createdAt).toLocaleString()} · Last used{" "}
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                  </p>
                  {k.revokedAt ? (
                    <p className="mt-1 text-xs font-medium text-[var(--enterprise-semantic-warning-text)]">
                      Revoked {new Date(k.revokedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                {!k.revokedAt ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-surface)] px-3 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)] disabled:opacity-50"
                    disabled={revokeApiKeyMutation.isPending}
                    onClick={() => revokeApiKeyMutation.mutate(k.id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            ))
          ) : !apiKeysQuery.isLoading ? (
            <p className="rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-6 text-center text-xs text-[var(--enterprise-text-muted)]">
              No API keys yet. Create one to connect external tools.
            </p>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Webhook}
        title="Outbound webhooks"
        description="Receive signed activity events for this project at your HTTPS endpoint."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
              Endpoint URL
            </label>
            <input
              type="url"
              value={webhookUrlDraft}
              onChange={(e) => setWebhookUrlDraft(e.target.value)}
              placeholder="https://example.com/plansync-events"
              className={OM_COMPACT_INPUT}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--enterprise-text-muted)]">
              Events <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={webhookEventsDraft}
              onChange={(e) => setWebhookEventsDraft(e.target.value)}
              placeholder="Comma-separated, or leave blank for all"
              className={OM_COMPACT_INPUT}
            />
          </div>
          <EnterpriseButton
            type="button"
            size="md"
            loading={createWebhookMutation.isPending}
            disabled={createWebhookMutation.isPending || !webhookUrlDraft.trim()}
            onClick={() =>
              createWebhookMutation.mutate({
                url: webhookUrlDraft.trim(),
                events: webhookEventsDraft
                  .split(",")
                  .map((e) => e.trim())
                  .filter(Boolean),
              })
            }
          >
            Add webhook
          </EnterpriseButton>
        </div>
        <div className="space-y-2">
          {webhooksQuery.data?.items?.length ? (
            webhooksQuery.data.items.map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-2 rounded-md border border-[var(--enterprise-border)] p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                      {w.url}
                    </p>
                    <span
                      className={
                        w.isActive ? "enterprise-badge-success" : "enterprise-badge-neutral"
                      }
                    >
                      {w.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                    Events: {w.events.length > 0 ? w.events.join(", ") : "All activity events"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                    Last success:{" "}
                    {w.lastSuccessAt ? new Date(w.lastSuccessAt).toLocaleString() : "Never"} · Last
                    error: {w.lastErrorAt ? new Date(w.lastErrorAt).toLocaleString() : "None"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <EnterpriseButton
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={() =>
                      toggleWebhookMutation.mutate({ webhookId: w.id, isActive: !w.isActive })
                    }
                  >
                    {w.isActive ? "Disable" : "Enable"}
                  </EnterpriseButton>
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--enterprise-semantic-danger-border)] px-3 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)]"
                    onClick={() => deleteWebhookMutation.mutate(w.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-6 text-center text-xs text-[var(--enterprise-text-muted)]">
              No webhooks configured yet.
            </p>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Wrench}
        title="Operations & Maintenance"
        description="Handover, assets, work orders, maintenance, inspections, and occupant reporting."
        badge={
          omBilling ? (
            <span className="enterprise-badge-success">Enterprise</span>
          ) : (
            <span className="enterprise-badge-warning">Enterprise plan</span>
          )
        }
      >
        {!canEditSettings ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            O&amp;M module settings are editable by Super Admin only.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
            Turn on for handover buildings: the{" "}
            <strong className="font-medium text-[var(--enterprise-text)]">Handover</strong> hub,
            asset register, work orders, preventive maintenance, inspections, and occupant
            reporting. Set lifecycle stage to{" "}
            <strong className="font-medium text-[var(--enterprise-text)]">Handover &amp; FM</strong>{" "}
            from the project editor when you enter commissioning.
          </p>
        )}

        {!omBilling ? (
          <div className="enterprise-alert-warning px-4 py-3">
            <p className="text-sm font-semibold text-[var(--enterprise-text)]">
              Enterprise plan required
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
              O&amp;M navigation and hubs are included with Enterprise. Upgrade under Organization →
              Plan &amp; billing, then enable Operations mode here.
            </p>
            <div className="mt-3">
              {isSuperAdmin(primary?.role) ? (
                <Link
                  href={billingHref}
                  className={enterpriseButtonClassName({ variant: "primary", size: "md" })}
                >
                  Open Plan &amp; billing
                </Link>
              ) : (
                <p className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Ask a workspace Super Admin to upgrade the plan.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {canEditSettings ? (
          <SettingsToggleRow
            label="Operations mode"
            description="Switch this project into FM / handover workflows"
            on={om}
            onToggle={(v) => opModeMutation.mutate(v)}
            disabled={opModeMutation.isPending}
          />
        ) : null}

        {om ? (
          <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3.5 py-3">
            <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
              Existing issues stay in this project and are listed under{" "}
              <strong className="font-semibold text-[var(--enterprise-text)]">
                Construction issues
              </strong>
              .
            </p>
            {m.issues ? (
              <Link
                href={`/projects/${projectId}/issues?issueKind=CONSTRUCTION`}
                className={enterpriseButtonClassName({
                  variant: "soft",
                  size: "md",
                  className: "mt-2",
                })}
              >
                Open Construction issues
              </Link>
            ) : null}
          </div>
        ) : null}

        {canEditSettings && om ? (
          <>
            <SettingsToggleRow
              label="O&M: Assets"
              description="Asset register and QR links"
              on={m.omAssets ?? true}
              onToggle={(v) => toggleModule("omAssets", v)}
            />
            <SettingsToggleRow
              label="O&M: Maintenance (PPM)"
              description="Preventive maintenance schedules"
              on={m.omMaintenance ?? true}
              onToggle={(v) => toggleModule("omMaintenance", v)}
            />
            <SettingsToggleRow
              label="O&M: Inspections"
              description="Inspection templates and runs"
              on={m.omInspections ?? true}
              onToggle={(v) => toggleModule("omInspections", v)}
            />
            <SettingsToggleRow
              label="O&M: Occupant portal"
              description="Public / QR occupant reporting"
              on={m.omTenantPortal ?? true}
              onToggle={(v) => toggleModule("omTenantPortal", v)}
            />
            {m.omTenantPortal ? (
              <>
                <OccupantPortalLinksSettings projectId={projectId} />
                <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-3.5 py-3">
                  <label className="block text-sm font-medium text-[var(--enterprise-text)]">
                    Occupant page headline
                  </label>
                  <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                    Optional line at the top of the public occupant form. Leave blank for the
                    default.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      maxLength={200}
                      value={occupantHeadlineDraft}
                      onChange={(e) => setOccupantHeadlineDraft(e.target.value)}
                      disabled={mutation.isPending}
                      placeholder="e.g. Report a maintenance issue for this building"
                      className={`${OM_COMPACT_INPUT} max-w-xl`}
                    />
                    <EnterpriseButton
                      type="button"
                      size="md"
                      className="shrink-0"
                      loading={mutation.isPending}
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
                    >
                      Save headline
                    </EnterpriseButton>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </SettingsSection>

      {canEditSettings ? (
        <SettingsSection
          icon={Eye}
          title="Client visibility"
          description="Control what invited clients see in their portal for this project."
        >
          <SettingsToggleRow
            label="Show issues to client"
            on={c.showIssues}
            onToggle={(v) => toggleClient("showIssues", v)}
          />
          <SettingsToggleRow
            label="Show RFIs to client"
            on={c.showRfis}
            onToggle={(v) => toggleClient("showRfis", v)}
          />
          <SettingsToggleRow
            label="Show field reports"
            on={c.showFieldReports}
            onToggle={(v) => toggleClient("showFieldReports", v)}
          />
          <SettingsToggleRow
            label="Show punch list"
            on={c.showPunchList}
            onToggle={(v) => toggleClient("showPunchList", v)}
          />
          <SettingsToggleRow
            label="Show drawings to client"
            on={c.showDrawings}
            onToggle={(v) => toggleClient("showDrawings", v)}
          />
          <SettingsToggleRow
            label="Allow client to comment"
            on={c.allowClientComment}
            onToggle={(v) => toggleClient("allowClientComment", v)}
          />
        </SettingsSection>
      ) : null}

      {mutation.isError ? (
        <div className="enterprise-alert-danger text-sm">
          {mutation.error instanceof Error ? mutation.error.message : "Could not save."}
        </div>
      ) : null}
      {createApiKeyMutation.isError ? (
        <div className="enterprise-alert-danger text-sm">
          {createApiKeyMutation.error instanceof Error
            ? createApiKeyMutation.error.message
            : "Could not create API key."}
        </div>
      ) : null}
      {revokeApiKeyMutation.isError ? (
        <div className="enterprise-alert-danger text-sm">
          {revokeApiKeyMutation.error instanceof Error
            ? revokeApiKeyMutation.error.message
            : "Could not revoke API key."}
        </div>
      ) : null}
      {datacenterDefaultsMutation.isError ? (
        <div className="enterprise-alert-danger text-sm">
          {datacenterDefaultsMutation.error instanceof Error
            ? datacenterDefaultsMutation.error.message
            : "Could not apply data center defaults."}
        </div>
      ) : null}
    </div>
  );
}
