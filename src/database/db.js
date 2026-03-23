import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
dotenv.config();

const db = new pg.Pool({
  connectionString: process.env["DATABASE_URL"],
});
const prismaPg = new PrismaPg(db);
const prisma = new PrismaClient({ adapter: prismaPg });

prisma
  .$connect()
  .then(() => {
    console.log("✅ Connected to the database");
  })
  .catch((error) => {
    console.error("❌ Failed to connect to the database:", error);
    process.exit(1);
  });
export default prisma;
