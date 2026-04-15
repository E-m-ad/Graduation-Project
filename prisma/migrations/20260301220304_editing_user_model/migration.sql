/*
Warnings:

- You are about to drop the column `fullName` on the `User` table. All the data in the column will be lost.
- Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.

 */
-- AlterTable
ALTER TABLE "User"
DROP COLUMN "fullName",
ADD COLUMN "name" VARCHAR(100) NOT NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken" ("token");