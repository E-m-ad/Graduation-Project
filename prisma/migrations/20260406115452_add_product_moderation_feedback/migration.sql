-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "adminReviewNote" TEXT,
ADD COLUMN     "adminReviewedAt" TIMESTAMPTZ(6),
ADD COLUMN     "ownerRepliedAt" TIMESTAMPTZ(6),
ADD COLUMN     "ownerReviewReply" TEXT;
