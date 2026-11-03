-- CreateEnum
CREATE TYPE "ChapterMarkKind" AS ENUM ('SKIPPED_VIA_PLACEMENT', 'PASSED_SKIP_TEST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentChapterId" TEXT;

-- CreateTable
CREATE TABLE "UserChapterMark" (
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "kind" "ChapterMarkKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserChapterMark_pkey" PRIMARY KEY ("userId","chapterId")
);

-- CreateIndex
CREATE INDEX "UserChapterMark_chapterId_idx" ON "UserChapterMark"("chapterId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentChapterId_fkey" FOREIGN KEY ("currentChapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChapterMark" ADD CONSTRAINT "UserChapterMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChapterMark" ADD CONSTRAINT "UserChapterMark_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

