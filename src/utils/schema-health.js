export const requiredSchemaColumns = [
  { table: "Product", column: "adminReviewNote" },
  { table: "Product", column: "adminReviewedAt" },
  { table: "Product", column: "ownerReviewReply" },
  { table: "Product", column: "ownerRepliedAt" },
  { table: "User", column: "isVerified" },
  { table: "EmailVerificationToken", column: "token" },
  { table: "RentalMessage", column: "message" },
  { table: "RentalChatState", column: "ownerUnreadCount" },
  { table: "ProductConversation", column: "ownerUnreadCount" },
  { table: "ProductConversationMessage", column: "message" },
];

export async function getSchemaHealth(client) {
  const checks = [];

  for (const { table, column } of requiredSchemaColumns) {
    const rows = await client.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table}
          AND column_name = ${column}
      ) AS "exists"
    `;

    checks.push({
      table,
      column,
      exists: Boolean(rows?.[0]?.exists),
    });
  }

  const missing = checks.filter((check) => !check.exists);

  return {
    ok: missing.length === 0,
    missing,
  };
}
