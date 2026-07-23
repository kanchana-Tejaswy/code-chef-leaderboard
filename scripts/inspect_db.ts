import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
console.log("Database URL configured:", !!databaseUrl);

let connectionString = databaseUrl;
try {
  if (connectionString) {
    const url = new URL(connectionString);
    if (url.searchParams.has("sslmode")) url.searchParams.delete("sslmode");
    if (url.searchParams.has("ssl")) url.searchParams.delete("ssl");
    connectionString = url.toString();
  }
} catch (e) {}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== PHASE 1 & 2: DATABASE INSPECTION ===");

  // 1. Total StudentProfile count
  const studentCount = await prisma.studentProfile.count();
  console.log("Total StudentProfile Count:", studentCount);

  // 2. Latest 10 StudentProfile records
  const latestStudents = await prisma.studentProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      rollNumber: true,
      email: true,
      profileStatus: true,
      leaderboardEligible: true,
      dashboardEligible: true,
      createdAt: true,
    },
  });

  console.log("\nLatest 10 StudentProfiles:");
  latestStudents.forEach((s) => {
    const maskedRoll = s.rollNumber ? "****" + s.rollNumber.slice(-4) : "NONE";
    console.log(`- Roll: ${maskedRoll} | Status: ${s.profileStatus} | LeaderboardEligible: ${s.leaderboardEligible} | DashboardEligible: ${s.dashboardEligible} | CreatedAt: ${s.createdAt}`);
  });

  // 3. Total LeaderboardEntry count
  const leaderboardCount = await prisma.leaderboardEntry.count();
  console.log("\nTotal LeaderboardEntry Count:", leaderboardCount);

  // 4. Check for 3-row test import records or recent roll numbers
  console.log("\nSearching for test import records (99TEST001, 99TEST002, 99TEST003, etc)...");
  const testProfiles = await prisma.studentProfile.findMany({
    where: {
      rollNumber: { contains: "TEST" },
    },
    include: { leaderboardEntry: true },
  });
  console.log(`Found ${testProfiles.length} matching test roll numbers in DB.`);

  // 5. Check table structure for new columns
  const tableInfo: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'student_profiles';
  `;
  console.log("\nColumns in student_profiles table:");
  tableInfo.forEach((col) => {
    console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
  });

  // 6. Check migration history table if exists
  try {
    const migrations: any[] = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY finished_at DESC;
    `;
    console.log("\nApplied Migrations:");
    migrations.forEach((m) => {
      console.log(`  - Migration: ${m.migration_name} | FinishedAt: ${m.finished_at}`);
    });
  } catch (e) {
    console.log("Could not query _prisma_migrations:", e);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
