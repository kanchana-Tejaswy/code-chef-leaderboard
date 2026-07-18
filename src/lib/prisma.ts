import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  
  const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Database URL is not configured. Missing POSTGRES_PRISMA_URL or POSTGRES_URL.");
    }
    console.warn("Database URL is not configured, falling back to localhost.");
  }

  const pool = new Pool({
    connectionString: process.env.NODE_ENV === "production" 
      ? databaseUrl 
      : (databaseUrl || "postgresql://postgres:postgres@localhost:5432/postgres"),
  });
  const adapter = new PrismaPg(pool);
  
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  
  return client;
}

export const prisma = (typeof window === "undefined") 
  ? new Proxy({} as PrismaClient, {
      get(target, prop) {
        return (getClient() as any)[prop];
      }
    })
  : (null as unknown as PrismaClient);

export type { PrismaClient };
export default prisma;

