-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brandKit" JSONB;

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "format" TEXT,
    "length" INTEGER,
    "potential" TEXT,
    "competition" TEXT,
    "why" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "plannedFor" TIMESTAMP(3),
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Idea_userId_status_idx" ON "Idea"("userId", "status");

-- CreateIndex
CREATE INDEX "Idea_userId_plannedFor_idx" ON "Idea"("userId", "plannedFor");
