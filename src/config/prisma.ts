import dotenv from "dotenv"
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
dotenv.config();

const prismaPg = new PrismaPg({
    connectionString: process.env["DATABASE_URL"]!,
});
const prisma = new PrismaClient({ adapter: prismaPg });

export default prisma;