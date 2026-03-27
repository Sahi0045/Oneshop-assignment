/*
  Warnings:

  - You are about to drop the column `reviewCount` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedBy" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "reviewCount",
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0;
