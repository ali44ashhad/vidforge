-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "stats" JSONB;

-- CreateTable
CREATE TABLE "SearchCache" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("key")
);
