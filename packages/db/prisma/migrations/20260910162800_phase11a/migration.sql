-- CreateTable
CREATE TABLE "ConfigOverride" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ConfigOverride_pkey" PRIMARY KEY ("key")
);
