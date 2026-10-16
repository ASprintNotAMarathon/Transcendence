-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('board', 'resigned', 'abandoned');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "endReason" "EndReason";
