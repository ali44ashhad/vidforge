-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "presenterImagePath" TEXT,
ADD COLUMN     "presenterImageUrl" TEXT,
ADD COLUMN     "presenterMode" TEXT NOT NULL DEFAULT 'off',
ADD COLUMN     "presenterPosition" TEXT NOT NULL DEFAULT 'bottom_left',
ADD COLUMN     "presenterRing" TEXT NOT NULL DEFAULT '#6C4CFF',
ADD COLUMN     "presenterSize" INTEGER NOT NULL DEFAULT 26;

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "presenterPath" TEXT,
ADD COLUMN     "presenterUrl" TEXT;
