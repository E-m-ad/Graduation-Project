-- CreateTable
CREATE TABLE "RentalChatState" (
    "rentalId" TEXT NOT NULL,
    "lastMessageSenderId" TEXT,
    "lastMessagePreview" VARCHAR(160),
    "lastMessageAt" TIMESTAMPTZ(6),
    "ownerUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "renterUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "ownerLastReadAt" TIMESTAMPTZ(6),
    "renterLastReadAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RentalChatState_pkey" PRIMARY KEY ("rentalId")
);

-- CreateIndex
CREATE INDEX "RentalChatState_lastMessageAt_idx" ON "RentalChatState"("lastMessageAt");

-- CreateIndex
CREATE INDEX "RentalChatState_lastMessageSenderId_idx" ON "RentalChatState"("lastMessageSenderId");

-- Backfill current rentals that already have chat messages so old threads start from a clean read state.
INSERT INTO "RentalChatState" (
    "rentalId",
    "lastMessageSenderId",
    "lastMessagePreview",
    "lastMessageAt",
    "ownerUnreadCount",
    "renterUnreadCount",
    "ownerLastReadAt",
    "renterLastReadAt",
    "createdAt",
    "updatedAt"
)
SELECT
    latest_message."rentalId",
    latest_message."senderId",
    LEFT(BTRIM(latest_message."message"), 160),
    latest_message."createdAt",
    0,
    0,
    latest_message."createdAt",
    latest_message."createdAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON ("rentalId")
        "rentalId",
        "senderId",
        "message",
        "createdAt",
        "id"
    FROM "RentalMessage"
    ORDER BY "rentalId", "createdAt" DESC, "id" DESC
) AS latest_message;

-- AddForeignKey
ALTER TABLE "RentalChatState" ADD CONSTRAINT "RentalChatState_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
