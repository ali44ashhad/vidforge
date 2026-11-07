-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "characterCount" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "characterVoices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storyMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "lines" JSONB;

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "characterNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "personality" TEXT,
    "voiceHint" TEXT,
    "voiceId" TEXT,
    "referenceImageUrl" TEXT,
    "referenceImagePath" TEXT,
    "referencePublicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCharacter" (
    "projectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectCharacter_pkey" PRIMARY KEY ("projectId","characterId")
);

-- AddForeignKey
ALTER TABLE "ProjectCharacter" ADD CONSTRAINT "ProjectCharacter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCharacter" ADD CONSTRAINT "ProjectCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
