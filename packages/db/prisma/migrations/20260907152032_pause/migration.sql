-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "pauseRequested" BOOLEAN NOT NULL DEFAULT false;
