export const requiredSchemaColumns = [
  { table: "Product", column: "adminReviewNote" },
  { table: "Product", column: "adminReviewedAt" },
  { table: "Product", column: "ownerReviewReply" },
  { table: "Product", column: "ownerRepliedAt" },
];

export async function getSchemaHealth(client) {
  const checks = await Promise.all(
    requiredSchemaColumns.map(async ({ table, column }) => {
      const rows = await client.$queryRaw`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${table}
            AND column_name = ${column}
        ) AS "exists"
      `;

      return {
        table,
        column,
        exists: Boolean(rows?.[0]?.exists),
      };
    }),
  );

  const missing = checks.filter((check) => !check.exists);

  return {
    ok: missing.length === 0,
    missing,
  };
}
