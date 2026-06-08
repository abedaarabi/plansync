"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createOrchestrationApproval,
  createOrchestrationEnvironment,
  createOrchestrationRun,
  createOrchestrationWorkflow,
  createProjectJobRun,
  fetchOrchestrationEnvironments,
  fetchOrchestrationRuns,
  fetchOrchestrationWorkflows,
  fetchProjectJobRuns,
  fetchProjectSession,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "./EnterpriseLoadingState";
import { AccessRestricted } from "./AccessRestricted";

type Props = { projectId: string };

const orchestrationStepsSeed = [
  { name: "Pre-checks and lock window", stepType: "check" },
  { name: "Power and cooling verification", stepType: "validation" },
  { name: "Network path validation", stepType: "validation" },
  { name: "Cutover execution", stepType: "action" },
  { name: "Post-change health checks", stepType: "check" },
];

export function DatacenterOpsClient({ projectId }: Props) {
  const qc = useQueryClient();
  const [environmentName, setEnvironmentName] = useState("");
  const [environmentRegion, setEnvironmentRegion] = useState("");
  const [environmentAz, setEnvironmentAz] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [workflowEnvironmentId, setWorkflowEnvironmentId] = useState("");

  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });
  const envQuery = useQuery({
    queryKey: ["orchestration", projectId, "environments"],
    queryFn: () => fetchOrchestrationEnvironments(projectId),
    enabled: Boolean(session?.uiMode === "internal"),
  });
  const workflowsQuery = useQuery({
    queryKey: ["orchestration", projectId, "workflows"],
    queryFn: () => fetchOrchestrationWorkflows(projectId),
    enabled: Boolean(session?.uiMode === "internal"),
  });
  const runsQuery = useQuery({
    queryKey: ["orchestration", projectId, "runs"],
    queryFn: () => fetchOrchestrationRuns(projectId),
    enabled: Boolean(session?.uiMode === "internal"),
  });
  const jobRunsQuery = useQuery({
    queryKey: ["job-runs", projectId],
    queryFn: () => fetchProjectJobRuns(projectId),
    enabled: Boolean(session?.uiMode === "internal"),
  });

  const createEnvironment = useMutation({
    mutationFn: () =>
      createOrchestrationEnvironment(projectId, {
        name: environmentName.trim(),
        region: environmentRegion.trim(),
        availabilityZone: environmentAz.trim() || null,
      }),
    onSuccess: async () => {
      setEnvironmentName("");
      setEnvironmentRegion("");
      setEnvironmentAz("");
      await qc.invalidateQueries({ queryKey: ["orchestration", projectId, "environments"] });
      toast.success("Environment created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createWorkflow = useMutation({
    mutationFn: () =>
      createOrchestrationWorkflow(projectId, {
        name: workflowName.trim(),
        description: workflowDescription.trim() || null,
        environmentId: workflowEnvironmentId || null,
        steps: orchestrationStepsSeed,
      }),
    onSuccess: async () => {
      setWorkflowName("");
      setWorkflowDescription("");
      setWorkflowEnvironmentId("");
      await qc.invalidateQueries({ queryKey: ["orchestration", projectId, "workflows"] });
      toast.success("Workflow created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRun = useMutation({
    mutationFn: (workflowId: string) => createOrchestrationRun(projectId, workflowId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orchestration", projectId, "runs"] });
      toast.success("Run queued.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveRun = useMutation({
    mutationFn: ({ runId, status }: { runId: string; status: "APPROVED" | "REJECTED" }) =>
      createOrchestrationApproval(projectId, runId, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orchestration", projectId, "runs"] });
      toast.success("Approval recorded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createJobRun = useMutation({
    mutationFn: () =>
      createProjectJobRun(projectId, {
        kind: "orchestration-health-check",
        payloadJson: { source: "datacenter-ops-dashboard" },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["job-runs", projectId] });
      toast.success("Job run created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availableWorkflows = workflowsQuery.data ?? [];
  const environments = envQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const jobRuns = jobRunsQuery.data ?? [];
  const workflowById = useMemo(
    () => new Map(availableWorkflows.map((w) => [w.id, w])),
    [availableWorkflows],
  );

  if (sessionPending || !session) {
    return <EnterpriseLoadingState message="Loading datacenter orchestration…" label="Loading" />;
  }
  if (session.uiMode !== "internal") {
    return <AccessRestricted backHref={`/projects/${projectId}/home`} />;
  }

  return (
    <div className="mobile-app-page w-full min-w-0 max-w-full space-y-6">
      <header className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5">
        <h1 className="text-2xl font-semibold text-[var(--enterprise-text)]">
          Datacenter orchestration
        </h1>
        <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
          Configure environments and orchestration workflows, then track runs and approvals.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Environments
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            value={environmentName}
            onChange={(e) => setEnvironmentName(e.target.value)}
            placeholder="Name (e.g. prod-us-east)"
            className="min-h-11 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
          />
          <input
            value={environmentRegion}
            onChange={(e) => setEnvironmentRegion(e.target.value)}
            placeholder="Region"
            className="min-h-11 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
          />
          <input
            value={environmentAz}
            onChange={(e) => setEnvironmentAz(e.target.value)}
            placeholder="Availability zone (optional)"
            className="min-h-11 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
          />
          <button
            type="button"
            disabled={
              !environmentName.trim() || !environmentRegion.trim() || createEnvironment.isPending
            }
            onClick={() => createEnvironment.mutate()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add environment
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {environments.map((env) => (
            <li
              key={env.id}
              className="rounded-lg border border-[var(--enterprise-border)] p-3 text-sm"
            >
              <span className="font-medium text-[var(--enterprise-text)]">{env.name}</span>
              <span className="text-[var(--enterprise-text-muted)]">
                {" "}
                · {env.region}
                {env.availabilityZone ? ` · ${env.availabilityZone}` : ""}
              </span>
            </li>
          ))}
          {environments.length === 0 ? (
            <li className="text-sm text-[var(--enterprise-text-muted)]">No environments yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Workflows
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow name"
            className="min-h-11 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
          />
          <input
            value={workflowDescription}
            onChange={(e) => setWorkflowDescription(e.target.value)}
            placeholder="Description (optional)"
            className="min-h-11 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
          />
          <select
            value={workflowEnvironmentId}
            onChange={(e) => setWorkflowEnvironmentId(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 text-sm text-[var(--enterprise-text)]"
          >
            <option value="">Environment (optional)</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!workflowName.trim() || createWorkflow.isPending}
            onClick={() => createWorkflow.mutate()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add workflow
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {availableWorkflows.map((workflow) => (
            <li
              key={workflow.id}
              className="rounded-lg border border-[var(--enterprise-border)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--enterprise-text)]">
                    {workflow.name}
                  </p>
                  <p className="text-xs text-[var(--enterprise-text-muted)]">
                    {workflow.environment ? `${workflow.environment.name} · ` : ""}
                    {workflow.steps.length} steps
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => createRun.mutate(workflow.id)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
                >
                  Start run
                </button>
              </div>
            </li>
          ))}
          {availableWorkflows.length === 0 ? (
            <li className="text-sm text-[var(--enterprise-text-muted)]">No workflows yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Runs and approvals
        </h2>
        <ul className="mt-3 space-y-2">
          {runs.map((run) => (
            <li key={run.id} className="rounded-lg border border-[var(--enterprise-border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--enterprise-text)]">
                    {workflowById.get(run.workflow.id)?.name ?? run.workflow.name}
                  </p>
                  <p className="text-xs text-[var(--enterprise-text-muted)]">
                    {run.status} · {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveRun.mutate({ runId: run.id, status: "APPROVED" })}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300 px-3 text-xs font-semibold text-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => approveRun.mutate({ runId: run.id, status: "REJECTED" })}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
          {runs.length === 0 ? (
            <li className="text-sm text-[var(--enterprise-text-muted)]">No runs yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Job runs
          </h2>
          <button
            type="button"
            onClick={() => createJobRun.mutate()}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
          >
            Create job run
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {jobRuns.map((run) => (
            <li
              key={run.id}
              className="rounded-lg border border-[var(--enterprise-border)] p-3 text-sm"
            >
              <span className="font-medium text-[var(--enterprise-text)]">{run.kind}</span>
              <span className="text-[var(--enterprise-text-muted)]">
                {" "}
                · {run.status} · {new Date(run.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
          {jobRuns.length === 0 ? (
            <li className="text-sm text-[var(--enterprise-text-muted)]">No job runs yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
