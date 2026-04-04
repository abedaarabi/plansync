-- CreateEnum (idempotent — migration may have partially applied before failing)
DO $$ BEGIN
  CREATE TYPE "ProjectMemberRole" AS ENUM ('INTERNAL', 'CLIENT', 'CONTRACTOR', 'SUBCONTRACTOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailInviteKind" AS ENUM ('INTERNAL', 'CLIENT', 'CONTRACTOR', 'SUBCONTRACTOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum: add SUPER_ADMIN (PostgreSQL appends new enum values)
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- AlterTable Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT NOT NULL DEFAULT '#2563EB';

-- AlterTable WorkspaceMember
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "isExternal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "settingsJson" JSONB;

-- AlterTable ProjectMember
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "projectRole" "ProjectMemberRole" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "trade" TEXT;

-- AlterTable EmailInvite
ALTER TABLE "EmailInvite" ADD COLUMN IF NOT EXISTS "inviteKind" "EmailInviteKind" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "EmailInvite" ADD COLUMN IF NOT EXISTS "trade" TEXT;
ALTER TABLE "EmailInvite" ADD COLUMN IF NOT EXISTS "inviteeName" TEXT;
ALTER TABLE "EmailInvite" ADD COLUMN IF NOT EXISTS "inviteeCompany" TEXT;

-- AlterTable File
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "disciplines" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable Issue (BIM anchor — may already exist from prior migration)
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "bimAnchor" JSONB;

-- AlterTable PunchItem
ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PunchItem_assigneeId_fkey'
  ) THEN
    ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PunchItem_assigneeId_idx" ON "PunchItem"("assigneeId");

-- Backfill runs in a separate migration so `SUPER_ADMIN` is usable (PG <12 cannot use a new enum
-- value in the same transaction as ALTER TYPE ... ADD VALUE).
