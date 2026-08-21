/*
  Warnings:

  - You are about to drop the `ApplicationTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Interview` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Reminder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ApplicationTag" DROP CONSTRAINT "ApplicationTag_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "ApplicationTag" DROP CONSTRAINT "ApplicationTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_contactId_fkey";

-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_userId_fkey";

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_userId_fkey";

-- DropTable
DROP TABLE "ApplicationTag";

-- DropTable
DROP TABLE "Interview";

-- DropTable
DROP TABLE "Reminder";

-- DropTable
DROP TABLE "Tag";

-- DropEnum
DROP TYPE "InterviewMode";

-- DropEnum
DROP TYPE "InterviewOutcome";

-- DropEnum
DROP TYPE "InterviewType";

-- DropEnum
DROP TYPE "ReminderType";
