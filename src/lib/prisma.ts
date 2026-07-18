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
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is not set. Please configure it in Vercel settings.");
    }
    console.warn("DATABASE_URL is not set, falling back to localhost.");
  }

  const pool = new Pool({
    connectionString: databaseUrl || "postgresql://postgres:postgres@localhost:5432/postgres",
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

