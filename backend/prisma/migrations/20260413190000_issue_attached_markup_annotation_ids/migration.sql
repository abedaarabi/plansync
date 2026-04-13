-- Optional list of viewer annotation ids (JSON array) linked to an issue besides the primary pin.
ALTER TABLE "Issue" ADD COLUMN "attachedMarkupAnnotationIds" JSONB;
