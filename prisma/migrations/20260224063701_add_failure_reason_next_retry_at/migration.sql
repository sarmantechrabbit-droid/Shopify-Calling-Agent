-- AlterTable
ALTER TABLE "CustomerCall" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3);
