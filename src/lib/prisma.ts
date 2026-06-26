import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import fs from "fs";
import path from "path";
import os from "os";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (typeof window === "undefined") {
  let dbPath = "dev.db";

  // Check if running on Vercel or in serverless production environment
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    const tmpDbPath = path.join(os.tmpdir(), "dev.db");
    const localDbPath = path.join(process.cwd(), "dev.db");
    const prismaDbPath = path.join(process.cwd(), "prisma", "dev.db");

    // Copy built db to tmp directory if it doesn't exist yet
    if (!fs.existsSync(tmpDbPath)) {
      try {
        if (fs.existsSync(localDbPath)) {
          fs.copyFileSync(localDbPath, tmpDbPath);
          console.log(`Database copied successfully to ${tmpDbPath} from cwd`);
        } else if (fs.existsSync(prismaDbPath)) {
          fs.copyFileSync(prismaDbPath, tmpDbPath);
          console.log(`Database copied successfully to ${tmpDbPath} from prisma/`);
        } else {
          console.log(`No built database file found in cwd or prisma/. Creating empty database in ${tmpDbPath}`);
          fs.writeFileSync(tmpDbPath, "");
          
          // Programmatically push schema if database is completely empty
          const { execSync } = require("child_process");
          execSync("npx prisma db push --accept-data-loss", {
            env: { ...process.env, DATABASE_URL: `file:${tmpDbPath}` }
          });
        }
      } catch (err) {
        console.error(`Failed to copy or initialize SQLite database in ${tmpDbPath}:`, err);
      }
    }
    dbPath = tmpDbPath;
  }

  const adapter = new PrismaBetterSqlite3({ url: dbPath });

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

