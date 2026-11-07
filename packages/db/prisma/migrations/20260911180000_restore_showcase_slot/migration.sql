ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "showcaseSlot" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Project_showcaseSlot_key" ON "Project"("showcaseSlot");
