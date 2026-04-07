"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { fetchProjectSession, patchProject, patchProjectSettings } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { isSuperAdmin } from "@/lib/workspaceRole";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { AccessRestricted } from "./AccessRestricted";

type Props = { projectId: string };

export function ProjectSettingsClient({ projectId }: Props) {
  const queryClient = useQueryClient();
  const { primary, loading: meLoading } = useEnterpriseWorkspace();

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

  if (!isSuperAdmin(primary?.role)) {
    return <AccessRestricted backHref={`/projects/${projectId}/home`} />;
  }

  const m = session.settings.modules;
  const c = session.settings.clientVisibility;
  const om = session.operationsMode;

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
        <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
          Disabled modules are hidden from the sidebar for everyone on this project.
        </p>
        {row("Issues", m.issues, (v) => toggleModule("issues", v))}
        {row("RFIs", m.rfis, (v) => toggleModule("rfis", v))}
        {row("Quantity Takeoff", m.takeoff, (v) => toggleModule("takeoff", v))}
        {row("Proposals", m.proposals, (v) => toggleModule("proposals", v))}
        {row("Punch List", m.punch, (v) => toggleModule("punch", v))}
        {row("Field Reports", m.fieldReports, (v) => toggleModule("fieldReports", v))}
      </section>

      <section className="enterprise-card divide-y divide-[var(--enterprise-border)] p-4 sm:p-6">
        <h2 className="pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Operations &amp; Maintenance
        </h2>
        <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
          Turn on for handover buildings: the{" "}
          <strong className="font-medium text-[var(--enterprise-text)]">Handover</strong> hub
          (readiness snapshot), asset register, work orders, preventive maintenance, inspections,
          and occupant reporting. Set lifecycle stage to <strong>Handover &amp; FM</strong> from the
          project editor when you enter commissioning.
        </p>
        {row("Operations mode", om, (v) => opModeMutation.mutate(v), opModeMutation.isPending)}
        {om ? (
          <>
            {row("O&M: Assets", m.omAssets ?? true, (v) => toggleModule("omAssets", v))}
            {row("O&M: Maintenance (PPM)", m.omMaintenance ?? true, (v) =>
              toggleModule("omMaintenance", v),
            )}
            {row("O&M: Inspections", m.omInspections ?? true, (v) =>
              toggleModule("omInspections", v),
            )}
            {row("O&M: Tenant portal", m.omTenantPortal ?? true, (v) =>
              toggleModule("omTenantPortal", v),
            )}
          </>
        ) : null}
      </section>

      <section className="enterprise-card divide-y divide-[var(--enterprise-border)] p-4 sm:p-6">
        <h2 className="pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Client visibility
        </h2>
        <p className="pb-4 text-xs text-[var(--enterprise-text-muted)]">
          Controls what clients see in their portal when invited to this project.
        </p>
        {row("Show issues to client", c.showIssues, (v) => toggleClient("showIssues", v))}
        {row("Show RFIs to client", c.showRfis, (v) => toggleClient("showRfis", v))}
        {row("Show field reports", c.showFieldReports, (v) => toggleClient("showFieldReports", v))}
        {row("Show punch list", c.showPunchList, (v) => toggleClient("showPunchList", v))}
        {row("Allow client to comment", c.allowClientComment, (v) =>
          toggleClient("allowClientComment", v),
        )}
      </section>

      {mutation.isError ? (
        <p className="text-sm text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : "Could not save."}
        </p>
      ) : null}
    </div>
  );
}
