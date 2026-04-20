-- CreateTable
CREATE TABLE "RentalMessage" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RentalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalMessage_rentalId_createdAt_idx" ON "RentalMessage"("rentalId", "createdAt");

-- CreateIndex
CREATE INDEX "RentalMessage_senderId_idx" ON "RentalMessage"("senderId");

-- AddForeignKey
ALTER TABLE "RentalMessage" ADD CONSTRAINT "RentalMessage_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalMessage" ADD CONSTRAINT "RentalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
