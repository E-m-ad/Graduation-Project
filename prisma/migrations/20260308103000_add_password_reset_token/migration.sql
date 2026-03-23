-- CreateTable
CREATE TABLE
    "PasswordResetToken" (
        "id" TEXT NOT NULL,
        "token" VARCHAR(512) NOT NULL,
        "userId" TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ (6) NOT NULL,
        "isUsed" BOOLEAN NOT NULL DEFAULT false,
        "usedAt" TIMESTAMPTZ (6),
        "createdAt" TIMESTAMPTZ (6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
    );

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken" ("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;