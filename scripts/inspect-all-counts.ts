import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
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
  console.log("=== Production Database Counts ===");
  const studentProfileCount = await prisma.studentProfile.count();
  const studentEnrollmentCount = await prisma.studentEnrollment.count();
  const cohortCount = await prisma.cohort.count();
  const departmentCount = await prisma.department.count();
  const classSectionCount = await prisma.classSection.count();
  const userAccessCount = await prisma.userAccess.count();
  const auditLogCount = await prisma.auditLog.count();

  console.log(`StudentProfile: ${studentProfileCount}`);
  console.log(`StudentEnrollment: ${studentEnrollmentCount}`);
  console.log(`Cohort: ${cohortCount}`);
  console.log(`Department: ${departmentCount}`);
  console.log(`ClassSection: ${classSectionCount}`);
  console.log(`UserAccess: ${userAccessCount}`);
  console.log(`AuditLog: ${auditLogCount}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
