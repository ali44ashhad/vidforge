-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "speechMode" TEXT NOT NULL DEFAULT 'tts';

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "audioPath" TEXT,
ADD COLUMN     "dialogue" TEXT;
