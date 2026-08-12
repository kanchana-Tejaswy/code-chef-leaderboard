import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.production.local") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env.production") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

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

// Standard normalization function
function normalizeRoll(roll: string | null): string | null {
  if (!roll) return null;
  let clean = roll.trim().toUpperCase();
  if (clean.includes("TEST") || clean.includes("DEV")) return null;
  // Normalize
  if (clean.includes("-")) {
    clean = clean.replace(/-/g, "");
  }
  if (clean.includes("AO")) {
    clean = clean.replace(/AO/g, "A0");
  }
  if (clean === "23AGIA05G0") {
    clean = "23AG1A05G0";
  }
  // Validate standard format (YYAG1A... or YYAG5A...)
  const regex = /^\d{2}AG[15]A\d{2}[A-Z\d]{2}$/;
  if (!regex.test(clean)) return null;
  return clean;
}

// Map student roll number to proposed cohort start/end years
function getCohortYears(normalizedRoll: string): { startYear: number; endYear: number; code: string } | null {
  const prefix = parseInt(normalizedRoll.substring(0, 2), 10);
  const entryType = normalizedRoll.substring(4, 6); // 1A or 5A
  const startYear = 2000 + prefix;

  if (entryType === "1A") {
    const endYear = startYear + 4;
    return { startYear, endYear, code: `${startYear}-${endYear}` };
  } else if (entryType === "5A") {
    const endYear = startYear + 3;
    return { startYear, endYear, code: `${startYear}-${endYear}` };
  }
  return null;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=== REGISTRY RECORDS CREATION ===");
  console.log("Mode:", isDryRun ? "DRY-RUN (No Database Writes)" : "LIVE WRITE");

  // Verify counts
  const initialCohortCount = await prisma.cohort.count();
  const initialDeptCount = await prisma.department.count();
  const initialSectionCount = await prisma.classSection.count();

  console.log(`Initial Counts -> Cohorts: ${initialCohortCount}, Departments: ${initialDeptCount}, Sections: ${initialSectionCount}`);

  // Proposed Cohorts list
  const cohortsToCreate = [
    { code: "2023-2027", startYear: 2023, endYear: 2027 },
    { code: "2024-2027", startYear: 2024, endYear: 2027 },
    { code: "2024-2028", startYear: 2024, endYear: 2028 },
    { code: "2025-2028", startYear: 2025, endYear: 2028 },
    { code: "2025-2029", startYear: 2025, endYear: 2029 }
  ];

  // Proposed Departments list
  const departmentsToCreate = [
    { code: "AIDS", name: "AIDS" },
    { code: "CSM", name: "CSM" },
    { code: "IOT", name: "IOT" },
    { code: "CSE", name: "CSE" },
    { code: "EEE", name: "EEE" },
    { code: "CIVIL", name: "CIVIL" },
    { code: "CSD", name: "CSD" },
    { code: "IT", name: "IT" },
    { code: "ECE", name: "ECE" },
    { code: "AIML", name: "AIML" }
  ];

  if (isDryRun) {
    console.log("\nProposed Cohorts to create:");
    console.log(cohortsToCreate);
    console.log("\nProposed Departments to create:");
    console.log(departmentsToCreate);
    console.log("\nZero database writes performed.");
    return;
  }

  // Live Write Mode
  console.log("\nExecuting live database writes...");

  // Write Cohorts
  const cohortMap = new Map<string, string>(); // code -> id
  for (const c of cohortsToCreate) {
    const record = await prisma.cohort.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        startYear: c.startYear,
        endYear: c.endYear,
        status: "ACTIVE"
      }
    });
    cohortMap.set(c.code, record.id);
  }
  console.log(`Created/Ensured ${cohortMap.size} Cohorts.`);

  // Write Departments
  const deptMap = new Map<string, string>(); // code -> id
  for (const d of departmentsToCreate) {
    const record = await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: {
        code: d.code,
        name: d.name,
        isActive: true
      }
    });
    deptMap.set(d.code, record.id);
  }
  console.log(`Created/Ensured ${deptMap.size} Departments.`);

  // Get all active StudentProfiles to determine sections dynamically
  const students = await prisma.studentProfile.findMany({
    select: {
      rollNumber: true,
      department: true,
      section: true
    }
  });

  const distinctSections = new Set<string>(); // "cohortCode|deptCode|sectionName"
  for (const s of students) {
    const normRoll = normalizeRoll(s.rollNumber);
    if (!normRoll || !s.department || !s.section) continue;

    const cohortInfo = getCohortYears(normRoll);
    if (!cohortInfo) continue;

    const cleanDept = s.department.trim().toUpperCase();
    const cleanSection = s.section.trim().toUpperCase();

    // Verify dept is in our list
    if (!deptMap.has(cleanDept)) continue;

    distinctSections.add(`${cohortInfo.code}|${cleanDept}|${cleanSection}`);
  }

  console.log(`\nFound ${distinctSections.size} distinct ClassSections from student profiles.`);

  let sectionsCreatedCount = 0;
  for (const secKey of distinctSections) {
    const [cCode, dCode, sName] = secKey.split("|");
    const cohortId = cohortMap.get(cCode);
    const departmentId = deptMap.get(dCode);

    if (!cohortId || !departmentId) {
      console.warn(`Skipping section ${cCode}|${dCode}|${sName} - missing parent ID.`);
      continue;
    }

    await prisma.classSection.upsert({
      where: {
        cohortId_departmentId_name: {
          cohortId,
          departmentId,
          name: sName
        }
      },
      update: {},
      create: {
        cohortId,
        departmentId,
        name: sName,
        isActive: true
      }
    });
    sectionsCreatedCount++;
  }

  console.log(`Created/Ensured ${sectionsCreatedCount} ClassSections.`);

  // Final Counts
  const finalCohortCount = await prisma.cohort.count();
  const finalDeptCount = await prisma.department.count();
  const finalSectionCount = await prisma.classSection.count();
  console.log(`\nFinal Counts -> Cohorts: ${finalCohortCount}, Departments: ${finalDeptCount}, Sections: ${finalSectionCount}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
