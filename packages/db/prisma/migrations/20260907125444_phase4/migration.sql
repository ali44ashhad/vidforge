-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "imageStyle" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "logoPosition" TEXT NOT NULL DEFAULT 'top_right',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "mixSettings" JSONB,
ADD COLUMN     "musicCustomPrompt" TEXT,
ADD COLUMN     "musicEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "musicStyle" TEXT NOT NULL DEFAULT 'Auto',
ADD COLUMN     "visualSource" TEXT NOT NULL DEFAULT 'mixed';

-- CreateTable
CREATE TABLE "Voice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "labels" JSONB,
    "previewUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voice_pkey" PRIMARY KEY ("id")
);
