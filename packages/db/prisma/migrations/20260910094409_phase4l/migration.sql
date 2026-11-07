-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "lookParams" JSONB,
ALTER COLUMN "look" SET DEFAULT 'auto';
