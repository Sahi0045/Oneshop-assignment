-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bidCredits" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "totalBidsPlaced" INTEGER NOT NULL DEFAULT 0;
