import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";

// 1. Load environment variables exactly as the Next.js local application does.
const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir);

// Define parser for connection string
function parseConnectionString(url: string | undefined) {
  if (!url) return null;
  try {
    const match = url.match(/^postgresql:\/\/([^:]+)(?::([^@]+))?@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (!match) return null;
    const [, user, , host, port, dbname] = match;
    const projectRef = "mdvwpcntaetchvnlvvpo";
    const containsProjectRef = (host && host.includes(projectRef)) || (user && user.includes(projectRef));
    return {
      user,
      host,
      port: port || "5432",
      dbname,
      containsProjectRef
    };
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log("=== STARTING DATABASE TARGET DIAGNOSTIC ===\n");

  const databaseUrl = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  // Determine environment file supplying the value
  let dbUrlSource = "Not found";
  let envLocalHasDb = false;
  let envHasDb = false;

  const envLocalPath = path.join(projectDir, ".env.local");
  const envPath = path.join(projectDir, ".env");

  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, "utf-8");
    if (content.includes("DATABASE_URL")) {
      envLocalHasDb = true;
    }
  }

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    if (content.includes("DATABASE_URL")) {
      envHasDb = true;
    }
  }

  if (envLocalHasDb) {
    dbUrlSource = ".env.local";
  } else if (envHasDb) {
    dbUrlSource = ".env";
  } else {
    dbUrlSource = "System / Process Environment";
  }

  console.log(`Environment file supplying DATABASE_URL: ${dbUrlSource}`);

  const parsedUrl = parseConnectionString(databaseUrl);
  if (parsedUrl) {
    console.log(`Database Hostname: ${parsedUrl.host}`);
    console.log(`Database Port: ${parsedUrl.port}`);
    console.log(`Database Name: ${parsedUrl.dbname}`);
    console.log(`Hostname is localhost: ${parsedUrl.host === "localhost" || parsedUrl.host === "127.0.0.1" ? "YES" : "NO"}`);
    console.log(`Hostname contains supabase.co: ${parsedUrl.host.includes("supabase.co") || parsedUrl.host.includes("supabase.com") ? "YES" : "NO"}`);
    console.log(`Hostname/username contains expected project reference (mdvwpcntaetchvnlvvpo): ${parsedUrl.containsProjectRef ? "YES" : "NO"}`);
  } else {
    console.log("DATABASE_URL is not configured or could not be parsed.");
  }

  // Check for conflicting DATABASE_URL or DIRECT_URL declarations across environment files
  const conflicting = envLocalHasDb && envHasDb;
  console.log(`Conflicting environment variables (DATABASE_URL declared in both .env and .env.local): ${conflicting ? "YES" : "NO"}\n`);

  // 4. Instantiate the same Prisma Client used by the application.
  console.log("Instantiating Prisma Client...");
  const { prisma } = await import("../src/lib/prisma");

  try {
    // 5. Query the student_profiles table.
    const totalCount = await prisma.studentProfile.count();
    console.log(`Total student count: ${totalCount}`);

    // latest five student IDs, names, and roll numbers
    const latestStudents = await prisma.studentProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        rollNumber: true,
        createdAt: true
      }
    });

    console.log("\nLatest 5 students:");
    if (latestStudents.length === 0) {
      console.log("No students found.");
    } else {
      latestStudents.forEach((s) => {
        console.log(`- ID: ${s.id}, Name: ${s.name}, Roll Number: ${s.rollNumber || "N/A"} (Created: ${s.createdAt})`);
      });
    }

    // whether roll number CLOUDTEST001 exists
    const cloudTestExists = await prisma.studentProfile.findUnique({
      where: { rollNumber: "CLOUDTEST001" }
    });
    console.log(`\nRoll number CLOUDTEST001 exists: ${cloudTestExists ? "YES" : "NO"}`);
    if (cloudTestExists) {
      console.log(`- Details: ID: ${cloudTestExists.id}, Name: ${cloudTestExists.name}`);
    }

  } catch (err: any) {
    console.error("Prisma query failed:", err.message);
  } finally {
    // 8. Disconnect Prisma cleanly.
    await prisma.$disconnect();
    console.log("\nPrisma disconnected.");
  }
}

run().catch(console.error);
