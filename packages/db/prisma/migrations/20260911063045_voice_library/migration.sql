-- CreateTable
CREATE TABLE "CommunityVoice" (
    "voiceId" TEXT NOT NULL,
    "publicOwnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "age" TEXT,
    "accent" TEXT,
    "language" TEXT,
    "useCase" TEXT,
    "category" TEXT,
    "description" TEXT,
    "previewUrl" TEXT,
    "clonedBy" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityVoice_pkey" PRIMARY KEY ("voiceId")
);

-- CreateIndex
CREATE INDEX "CommunityVoice_language_gender_idx" ON "CommunityVoice"("language", "gender");

-- CreateIndex
CREATE INDEX "CommunityVoice_clonedBy_idx" ON "CommunityVoice"("clonedBy");
