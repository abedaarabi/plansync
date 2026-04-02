-- Project audit: deletes + project metadata updates (see ActivityType in schema)
ALTER TYPE "ActivityType" ADD VALUE 'RFI_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'PUNCH_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'FIELD_REPORT_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'PROJECT_UPDATED';
