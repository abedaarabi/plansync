-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "materialTemplateJson" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Material" ADD COLUMN "customAttributes" JSONB NOT NULL DEFAULT '{}';
