/*
  Warnings:

  - You are about to drop the column `showcaseSlot` on the `Project` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Project_showcaseSlot_key";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "showcaseSlot";

-- CreateTable
CREATE TABLE "MusicLibraryTrack" (
    "id" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "mood" TEXT,
    "prompt" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicLibraryTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicLibraryTrack_style_idx" ON "MusicLibraryTrack"("style");
