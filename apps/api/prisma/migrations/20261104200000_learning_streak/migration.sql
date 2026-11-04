-- AlterTable
ALTER TABLE "User" ADD COLUMN     "streakFreezes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targetSuggestionDismissedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "StudyDay" (
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "effortSeconds" INTEGER NOT NULL DEFAULT 0,
    "reviewsAnswered" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "freezeEarned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudyDay_pkey" PRIMARY KEY ("userId","localDate")
);

-- AddForeignKey
ALTER TABLE "StudyDay" ADD CONSTRAINT "StudyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

