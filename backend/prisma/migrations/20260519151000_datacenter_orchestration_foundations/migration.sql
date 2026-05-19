-- AlterTable
ALTER TABLE "ProjectApiKey"
ADD COLUMN "serviceLabel" TEXT,
ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Asset"
ADD COLUMN "hall" TEXT,
ADD COLUMN "rowLabel" TEXT,
ADD COLUMN "rack" TEXT,
ADD COLUMN "positionU" TEXT;

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrchestrationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrchestrationApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProjectWebhook" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSuccessAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorMessage" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "JobRunStatus" NOT NULL DEFAULT 'QUEUED',
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "correlationId" TEXT,
  "payloadJson" JSONB,
  "resultJson" JSONB,
  "errorJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationEnvironment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "availabilityZone" TEXT,
  "isProduction" BOOLEAN NOT NULL DEFAULT false,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrchestrationEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationWorkflow" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "environmentId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrchestrationWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationWorkflowStep" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stepType" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "timeoutSeconds" INTEGER,
  "configJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrchestrationWorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationWorkflowDependency" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "fromStepId" TEXT NOT NULL,
  "toStepId" TEXT NOT NULL,
  "condition" TEXT NOT NULL DEFAULT 'on_success',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrchestrationWorkflowDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationRun" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "environmentId" TEXT,
  "requestedById" TEXT,
  "status" "OrchestrationRunStatus" NOT NULL DEFAULT 'QUEUED',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "changeWindowStart" TIMESTAMP(3),
  "changeWindowEnd" TIMESTAMP(3),
  "summaryJson" JSONB,
  "errorJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrchestrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationRunStep" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "workflowStepId" TEXT NOT NULL,
  "status" "OrchestrationRunStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "logsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrchestrationRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationApproval" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "approverId" TEXT,
  "status" "OrchestrationApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrchestrationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectWebhook_projectId_isActive_idx" ON "ProjectWebhook"("projectId", "isActive");
CREATE INDEX "ProjectWebhook_createdById_idx" ON "ProjectWebhook"("createdById");
CREATE INDEX "JobRun_workspaceId_createdAt_idx" ON "JobRun"("workspaceId", "createdAt");
CREATE INDEX "JobRun_projectId_createdAt_idx" ON "JobRun"("projectId", "createdAt");
CREATE INDEX "JobRun_projectId_kind_idx" ON "JobRun"("projectId", "kind");
CREATE UNIQUE INDEX "OrchestrationEnvironment_projectId_name_key" ON "OrchestrationEnvironment"("projectId", "name");
CREATE INDEX "OrchestrationEnvironment_projectId_region_idx" ON "OrchestrationEnvironment"("projectId", "region");
CREATE UNIQUE INDEX "OrchestrationWorkflow_projectId_name_key" ON "OrchestrationWorkflow"("projectId", "name");
CREATE INDEX "OrchestrationWorkflow_projectId_isActive_idx" ON "OrchestrationWorkflow"("projectId", "isActive");
CREATE INDEX "OrchestrationWorkflowStep_workflowId_sortOrder_idx" ON "OrchestrationWorkflowStep"("workflowId", "sortOrder");
CREATE UNIQUE INDEX "OrchestrationWorkflowDependency_workflowId_fromStepId_toStepId_key" ON "OrchestrationWorkflowDependency"("workflowId", "fromStepId", "toStepId");
CREATE INDEX "OrchestrationWorkflowDependency_workflowId_fromStepId_idx" ON "OrchestrationWorkflowDependency"("workflowId", "fromStepId");
CREATE INDEX "OrchestrationWorkflowDependency_workflowId_toStepId_idx" ON "OrchestrationWorkflowDependency"("workflowId", "toStepId");
CREATE INDEX "OrchestrationRun_projectId_createdAt_idx" ON "OrchestrationRun"("projectId", "createdAt");
CREATE INDEX "OrchestrationRun_workflowId_createdAt_idx" ON "OrchestrationRun"("workflowId", "createdAt");
CREATE INDEX "OrchestrationRun_status_createdAt_idx" ON "OrchestrationRun"("status", "createdAt");
CREATE UNIQUE INDEX "OrchestrationRunStep_runId_workflowStepId_key" ON "OrchestrationRunStep"("runId", "workflowStepId");
CREATE INDEX "OrchestrationRunStep_runId_status_idx" ON "OrchestrationRunStep"("runId", "status");
CREATE INDEX "OrchestrationApproval_runId_status_idx" ON "OrchestrationApproval"("runId", "status");
CREATE INDEX "OrchestrationApproval_approverId_idx" ON "OrchestrationApproval"("approverId");

-- AddForeignKey
ALTER TABLE "ProjectWebhook" ADD CONSTRAINT "ProjectWebhook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWebhook" ADD CONSTRAINT "ProjectWebhook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrchestrationEnvironment" ADD CONSTRAINT "OrchestrationEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationWorkflow" ADD CONSTRAINT "OrchestrationWorkflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationWorkflow" ADD CONSTRAINT "OrchestrationWorkflow_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "OrchestrationEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrchestrationWorkflow" ADD CONSTRAINT "OrchestrationWorkflow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrchestrationWorkflowStep" ADD CONSTRAINT "OrchestrationWorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OrchestrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationWorkflowDependency" ADD CONSTRAINT "OrchestrationWorkflowDependency_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OrchestrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationWorkflowDependency" ADD CONSTRAINT "OrchestrationWorkflowDependency_fromStepId_fkey" FOREIGN KEY ("fromStepId") REFERENCES "OrchestrationWorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationWorkflowDependency" ADD CONSTRAINT "OrchestrationWorkflowDependency_toStepId_fkey" FOREIGN KEY ("toStepId") REFERENCES "OrchestrationWorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationRun" ADD CONSTRAINT "OrchestrationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationRun" ADD CONSTRAINT "OrchestrationRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OrchestrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationRun" ADD CONSTRAINT "OrchestrationRun_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "OrchestrationEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrchestrationRun" ADD CONSTRAINT "OrchestrationRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrchestrationRunStep" ADD CONSTRAINT "OrchestrationRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OrchestrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationRunStep" ADD CONSTRAINT "OrchestrationRunStep_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "OrchestrationWorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationApproval" ADD CONSTRAINT "OrchestrationApproval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OrchestrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrchestrationApproval" ADD CONSTRAINT "OrchestrationApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
