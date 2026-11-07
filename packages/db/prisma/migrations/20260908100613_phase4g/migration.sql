-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "look" TEXT NOT NULL DEFAULT 'cinematic',
ADD COLUMN     "lookIntensity" INTEGER NOT NULL DEFAULT 70;
