-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('KANA', 'VOCAB', 'KANJI', 'GRAMMAR');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('F_KANA', 'F_VOCAB', 'F_KANJI', 'F_GRAMMAR', 'I_LISTENING', 'I_SPEAKING', 'I_READING', 'I_WRITING', 'I_SCENARIO', 'REVIEW', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "CheckFormat" AS ENUM ('MULTIPLE_CHOICE', 'TYPED', 'SPOKEN');

-- CreateEnum
CREATE TYPE "LessonItemRole" AS ENUM ('TARGET', 'SUPPORTING');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "display" TEXT NOT NULL,
    "reading" TEXT,
    "meaning" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LessonType" NOT NULL,
    "position" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER,
    "teach" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonItem" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "role" "LessonItemRole" NOT NULL DEFAULT 'TARGET',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LessonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "format" "CheckFormat" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "targetItemId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemMasteryState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recognition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "production" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fsrs" JSONB NOT NULL DEFAULT '{}',
    "due" TIMESTAMP(3),
    "lastReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemMasteryState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_language_type_idx" ON "Item"("language", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Module_slug_key" ON "Module"("slug");

-- CreateIndex
CREATE INDEX "Module_language_position_idx" ON "Module"("language", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_slug_key" ON "Chapter"("slug");

-- CreateIndex
CREATE INDEX "Chapter_moduleId_position_idx" ON "Chapter"("moduleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_slug_key" ON "Lesson"("slug");

-- CreateIndex
CREATE INDEX "Lesson_chapterId_position_idx" ON "Lesson"("chapterId", "position");

-- CreateIndex
CREATE INDEX "LessonItem_itemId_idx" ON "LessonItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonItem_lessonId_itemId_key" ON "LessonItem"("lessonId", "itemId");

-- CreateIndex
CREATE INDEX "Check_lessonId_position_idx" ON "Check"("lessonId", "position");

-- CreateIndex
CREATE INDEX "ItemMasteryState_userId_due_idx" ON "ItemMasteryState"("userId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "ItemMasteryState_userId_itemId_key" ON "ItemMasteryState"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_targetItemId_fkey" FOREIGN KEY ("targetItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMasteryState" ADD CONSTRAINT "ItemMasteryState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMasteryState" ADD CONSTRAINT "ItemMasteryState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

