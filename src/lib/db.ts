import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 - Requiere adapter obligatorio con el generator prisma-client
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Store instance globally in development
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
