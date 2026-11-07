/*
  Warnings:

  - A unique constraint covering the columns `[showcaseSlot]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "showcaseSlot" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_showcaseSlot_key" ON "Project"("showcaseSlot");
