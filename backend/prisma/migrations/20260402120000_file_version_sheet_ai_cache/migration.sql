-- Persist Sheet AI smart-sheet + chat per file version / page (saves repeat Gemini calls).
ALTER TABLE "FileVersion" ADD COLUMN "sheetAiCache" JSONB;
