-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('SKIP', 'EXIT');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED');

-- AlterEnum: one Assessment engine, one mark (decisions.md I.4.d.a). RENAME
-- VALUE keeps any existing PASSED_SKIP_TEST rows (Prisma's type swap would
-- fail on them).
ALTER TYPE "ChapterMarkKind" RENAME VALUE 'PASSED_SKIP_TEST' TO 'PASSED_ASSESSMENT';

-- CreateTable
CREATE TABLE "UserLessonSkip" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLessonSkip_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "itemIds" TEXT[],
    "correctCount" INTEGER,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLessonSkip_lessonId_idx" ON "UserLessonSkip"("lessonId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_userId_chapterId_idx" ON "AssessmentAttempt"("userId", "chapterId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_chapterId_idx" ON "AssessmentAttempt"("chapterId");

-- AddForeignKey
ALTER TABLE "UserLessonSkip" ADD CONSTRAINT "UserLessonSkip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLessonSkip" ADD CONSTRAINT "UserLessonSkip_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill (decisions.md I.4.d.a): until now a chapter whose lessons were all
-- completed counted as passed. Lessons alone no longer pass a chapter, so
-- grandfather those as PASSED_ASSESSMENT — nobody loses their place.
INSERT INTO "UserChapterMark" ("userId", "chapterId", "kind")
SELECT lc."userId", l."chapterId", 'PASSED_ASSESSMENT'::"ChapterMarkKind"
FROM "LessonCompletion" lc
JOIN "Lesson" l ON l."id" = lc."lessonId"
GROUP BY lc."userId", l."chapterId"
HAVING COUNT(DISTINCT lc."lessonId") =
  (SELECT COUNT(*) FROM "Lesson" l2 WHERE l2."chapterId" = l."chapterId")
ON CONFLICT ("userId", "chapterId") DO NOTHING;
