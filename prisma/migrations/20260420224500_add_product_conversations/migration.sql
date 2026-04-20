-- CreateTable
CREATE TABLE "ProductConversation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "lastMessageSenderId" TEXT,
    "lastMessagePreview" VARCHAR(160),
    "lastMessageAt" TIMESTAMPTZ(6),
    "ownerUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "participantUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "ownerLastReadAt" TIMESTAMPTZ(6),
    "participantLastReadAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductConversation_productId_participantId_key" ON "ProductConversation"("productId", "participantId");

-- CreateIndex
CREATE INDEX "ProductConversation_productId_lastMessageAt_idx" ON "ProductConversation"("productId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ProductConversation_ownerId_lastMessageAt_idx" ON "ProductConversation"("ownerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ProductConversation_participantId_lastMessageAt_idx" ON "ProductConversation"("participantId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ProductConversation_lastMessageSenderId_idx" ON "ProductConversation"("lastMessageSenderId");

-- CreateIndex
CREATE INDEX "ProductConversationMessage_conversationId_createdAt_idx" ON "ProductConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductConversationMessage_senderId_idx" ON "ProductConversationMessage"("senderId");

-- AddForeignKey
ALTER TABLE "ProductConversation" ADD CONSTRAINT "ProductConversation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConversation" ADD CONSTRAINT "ProductConversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConversation" ADD CONSTRAINT "ProductConversation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConversationMessage" ADD CONSTRAINT "ProductConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ProductConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConversationMessage" ADD CONSTRAINT "ProductConversationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
