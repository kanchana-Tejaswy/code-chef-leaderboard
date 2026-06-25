import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (typeof window === "undefined") {
  const connectionString =
    process.env.DATABASE_URL ||
    "mysql://root@localhost:3306/code_chef_leaderboard";

  const dbUrl = new URL(connectionString);
  const host = dbUrl.hostname;
  const port = parseInt(dbUrl.port || "3306", 10);
  const user = dbUrl.username;
  const password = decodeURIComponent(dbUrl.password || "");
  const database = dbUrl.pathname.replace(/^\//, "");

  const adapter = new PrismaMariaDb({
    host,
    port,
    user,
    password,
    database,
    connectionLimit: 10,
  });

  prismaInstance =
    globalForPrisma.prisma ??
    new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
} else {
  prismaInstance = null as unknown as PrismaClient;
}

export const prisma = prismaInstance;
export type { PrismaClient };
export default prisma;

