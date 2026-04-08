-- DropForeignKey
ALTER TABLE "EmailVerificationToken" DROP CONSTRAINT "EmailVerificationToken_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isVerified";

-- DropTable
DROP TABLE "EmailVerificationToken";
