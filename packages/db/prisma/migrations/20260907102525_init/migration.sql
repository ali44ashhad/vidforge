-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'QUEUED', 'SCRIPTING', 'STORYBOARDING', 'FETCHING_MEDIA', 'VOICE_GENERATION', 'MUSIC_GENERATION', 'ASSEMBLING', 'RENDERING', 'FINALIZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('R16_9', 'R9_16', 'R1_1', 'R4_5');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'IMAGE');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "batchId" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "targetDuration" INTEGER NOT NULL,
    "actualDuration" DOUBLE PRECISION,
    "aspectRatio" "AspectRatio" NOT NULL DEFAULT 'R16_9',
    "language" TEXT NOT NULL DEFAULT 'English',
    "videoType" TEXT NOT NULL DEFAULT 'YouTube Video',
    "style" TEXT,
    "voiceId" TEXT,
    "voiceStyle" TEXT NOT NULL DEFAULT 'Professional',
    "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "captionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "captionStyle" TEXT NOT NULL DEFAULT 'YouTube Clean',
    "cta" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "checkpoint" JSONB,
    "strategy" JSONB,
    "script" TEXT,
    "musicPrompt" TEXT,
    "finalVideoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "captionsUrl" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "musicMood" TEXT,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION NOT NULL,
    "visualDescription" TEXT NOT NULL,
    "videoQueries" TEXT[],
    "imageQueries" TEXT[],
    "onScreenText" TEXT,
    "transition" TEXT NOT NULL DEFAULT 'cut',
    "motion" TEXT NOT NULL DEFAULT 'zoom_in',
    "mediaAssetId" TEXT,
    "clipOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAssetId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "localPath" TEXT,
    "previewUrl" TEXT,
    "creator" TEXT,
    "creatorUrl" TEXT,
    "sourceUrl" TEXT,
    "license" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAsset" (
    "projectId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("projectId","mediaAssetId")
);

-- CreateTable
CREATE TABLE "VoiceSegment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "localPath" TEXT,
    "duration" DOUBLE PRECISION NOT NULL,
    "generationId" TEXT,
    "alignment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "chapterId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "audioUrl" TEXT,
    "localPath" TEXT,
    "duration" DOUBLE PRECISION,
    "generationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" TEXT,
    "outputUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_status_lockedAt_idx" ON "Project"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "Project_batchId_idx" ON "Project"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_projectId_order_key" ON "Chapter"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_chapterId_order_key" ON "Scene"("chapterId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Shot_sceneId_order_key" ON "Shot"("sceneId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_provider_providerAssetId_key" ON "MediaAsset"("provider", "providerAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSegment_sceneId_key" ON "VoiceSegment"("sceneId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSegment" ADD CONSTRAINT "VoiceSegment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSegment" ADD CONSTRAINT "VoiceSegment_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
