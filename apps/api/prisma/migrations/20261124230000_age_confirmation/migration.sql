-- CreateEnum
CREATE TYPE "AgeAnswer" AS ENUM ('ADULT', 'UNDER_18');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageAnswer" "AgeAnswer",
ADD COLUMN     "ageAnsweredAt" TIMESTAMP(3);

