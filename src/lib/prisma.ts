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

  const databaseUrlStr = process.env.NODE_ENV === "production" 
    ? databaseUrl 
    : (databaseUrl || "postgresql://postgres:postgres@localhost:5432/postgres");
    
  let connectionString: string | undefined = databaseUrlStr;
  try {
    if (connectionString) {
      const url = new URL(connectionString);
      if (url.searchParams.has('sslmode')) url.searchParams.delete('sslmode');
      if (url.searchParams.has('ssl')) url.searchParams.delete('ssl');
      connectionString = url.toString();
    }
  } catch (e) {
    // If URL parsing fails, we proceed with the raw string
  }


  let sslConfig: any = undefined;
  if (process.env.SUPABASE_DB_CA_CERT) {
    const normalizedCert = process.env.SUPABASE_DB_CA_CERT.replace(/\\n/g, '\n');
    sslConfig = {
      ca: normalizedCert,
      rejectUnauthorized: true,
    };
  } else if (process.env.NODE_ENV === "production") {
    sslConfig = {
      rejectUnauthorized: false,
    };
  }

  const pool = new Pool({
    connectionString,
    ssl: sslConfig,
    max: 2,
    connectionTimeoutMillis: 5000,
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

