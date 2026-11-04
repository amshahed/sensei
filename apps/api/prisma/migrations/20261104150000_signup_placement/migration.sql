-- CreateEnum
CREATE TYPE "PriorExperience" AS ENUM ('NONE', 'SOME_KANA', 'FAIR_AMOUNT', 'REFRESHER');

-- CreateEnum
CREATE TYPE "PlacementTier" AS ENUM ('KANA', 'FULL');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyTargetMinutes" INTEGER,
ADD COLUMN     "intakeCompletedAt" TIMESTAMP(3),
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "priorExperience" "PriorExperience";

-- CreateTable
CREATE TABLE "PlacementAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "PlacementTier" NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "answered" INTEGER NOT NULL DEFAULT 0,
    "startChapterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlacementAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlacementAttempt_userId_key" ON "PlacementAttempt"("userId");

-- AddForeignKey
ALTER TABLE "PlacementAttempt" ADD CONSTRAINT "PlacementAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

