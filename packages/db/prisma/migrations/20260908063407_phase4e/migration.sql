-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "aiVideoResolution" TEXT NOT NULL DEFAULT '720p',
ADD COLUMN     "outputQuality" TEXT NOT NULL DEFAULT '1080p',
ADD COLUMN     "textOverlaysEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "voiceEnabled" BOOLEAN NOT NULL DEFAULT true;
