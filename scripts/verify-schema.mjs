import db from "../src/database/db.js";
import { getSchemaHealth } from "../src/utils/schema-health.js";

let exitCode = 0;

try {
  await db.$queryRaw`SELECT 1`;

  const schema = await getSchemaHealth(db);

  if (!schema.ok) {
    exitCode = 1;
    console.error("[schema] Database schema is missing required columns:");
    for (const item of schema.missing) {
      console.error(`[schema] - ${item.table}.${item.column}`);
    }
    console.error(
      "[schema] Run `npm run prisma:deploy` against the production database before starting the app.",
    );
  } else {
    console.log("[schema] Database schema is compatible with the current application.");
  }
} catch (error) {
  exitCode = 1;
  console.error("[schema] Failed to verify database schema");
  console.error(error);
} finally {
  await db.$disconnect();
}

process.exit(exitCode);
