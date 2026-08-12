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

const EXCLUDED_ROLLS = ["22CS999", "23AG1A17229"];

// Normalization function (reused from mapping phase)
export function normalizeRoll(roll: string | null): { normalized: string | null; isNormalized: boolean } {
  if (!roll) return { normalized: null, isNormalized: false };
  const trimmed = roll.trim();
  let clean = trimmed.toUpperCase();
  
  if (clean.includes("TEST") || clean.includes("DEV")) {
    return { normalized: null, isNormalized: false };
  }

  let isNormalized = trimmed !== clean;

  if (clean.includes("-")) {
    clean = clean.replace(/-/g, "");
    isNormalized = true;
  }

  if (clean.includes("AO")) {
    clean = clean.replace(/AO/g, "A0");
    isNormalized = true;
  }
  
  if (clean === "23AGIA05G0") {
    clean = "23AG1A05G0";
    isNormalized = true;
  }

  if (trimmed !== clean) {
    isNormalized = true;
  }

  const regex = /^\d{2}AG[15]A\d{2}[A-Z\d]{2}$/;
  if (!regex.test(clean)) {
    return { normalized: null, isNormalized: false };
  }

  return { normalized: clean, isNormalized };
}

// Cohort resolution (reused from mapping phase)
export function getCohortYears(normalizedRoll: string): { startYear: number; endYear: number; code: string } | null {
  const prefix = parseInt(normalizedRoll.substring(0, 2), 10);
  const entryType = normalizedRoll.substring(4, 6);
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

// Parse argv options
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    dryRun: boolean;
    rolls: string[];
    cohort?: string;
    dept?: string;
    section?: string;
    full: boolean;
  } = {
    dryRun: args.includes("--dry-run"),
    rolls: [],
    full: args.includes("--full"),
  };

  const rollsIdx = args.indexOf("--rolls");
  if (rollsIdx !== -1 && args[rollsIdx + 1]) {
    options.rolls = args[rollsIdx + 1].split(",").map(r => r.trim());
  }

  const cohortIdx = args.indexOf("--cohort");
  if (cohortIdx !== -1 && args[cohortIdx + 1]) {
    options.cohort = args[cohortIdx + 1].trim();
  }

  const deptIdx = args.indexOf("--dept");
  if (deptIdx !== -1 && args[deptIdx + 1]) {
    options.dept = args[deptIdx + 1].trim().toUpperCase();
  }

  const sectionIdx = args.indexOf("--section");
  if (sectionIdx !== -1 && args[sectionIdx + 1]) {
    options.section = args[sectionIdx + 1].trim().toUpperCase();
  }

  return options;
}

async function main() {
  const opts = parseArgs();

  console.log("=== STUDENT ENROLLMENT BACKFILL ===");
  console.log("Dry Run Mode:", opts.dryRun);

  if (!opts.full && opts.rolls.length === 0 && !opts.cohort && !opts.dept && !opts.section) {
    console.error("Error: Must specify a mode: --full, --rolls <rolls>, or --cohort/--dept/--section.");
    process.exit(1);
  }

  // Load registry records
  const cohorts = await prisma.cohort.findMany();
  const departments = await prisma.department.findMany();
  const sections = await prisma.classSection.findMany();

  const cohortMap = new Map<string, string>();
  cohorts.forEach(c => cohortMap.set(c.code, c.id));

  const deptMap = new Map<string, string>();
  departments.forEach(d => deptMap.set(d.code, d.id));

  const sectionMap = new Map<string, string>();
  sections.forEach(s => sectionMap.set(`${s.cohortId}|${s.departmentId}|${s.name}`, s.id));

  // Load all student profiles
  const allStudents = await prisma.studentProfile.findMany({
    orderBy: { rollNumber: "asc" }
  });

  const readyToEnroll: any[] = [];
  const skippedList: any[] = [];

  for (const s of allStudents) {
    // Check exclusions
    if (s.rollNumber && EXCLUDED_ROLLS.includes(s.rollNumber)) {
      skippedList.push({ student: s, reason: "EXCLUDED_INVALID" });
      continue;
    }

    const normRes = normalizeRoll(s.rollNumber);
    if (!normRes.normalized) {
      skippedList.push({ student: s, reason: "INVALID_ROLL" });
      continue;
    }

    const cohortInfo = getCohortYears(normRes.normalized);
    if (!cohortInfo) {
      skippedList.push({ student: s, reason: "COHORT_NOT_RESOLVED" });
      continue;
    }

    const cohortId = cohortMap.get(cohortInfo.code);
    const deptCode = s.department?.trim().toUpperCase() || "";
    const deptId = deptMap.get(deptCode);
    const sectionName = s.section?.trim().toUpperCase() || "";
    const sectionId = cohortId && deptId ? sectionMap.get(`${cohortId}|${deptId}|${sectionName}`) : undefined;

    if (!cohortId || !deptId || !sectionId) {
      skippedList.push({ student: s, reason: "REGISTRY_IDS_MISSING" });
      continue;
    }

    // Filters for targeted modes
    if (opts.rolls.length > 0) {
      if (!opts.rolls.includes(s.rollNumber || "") && !opts.rolls.includes(normRes.normalized)) {
        continue;
      }
    } else if (opts.cohort || opts.dept || opts.section) {
      if (opts.cohort && cohortInfo.code !== opts.cohort) continue;
      if (opts.dept && deptCode !== opts.dept) continue;
      if (opts.section && sectionName !== opts.section) continue;
    }

    readyToEnroll.push({
      studentId: s.id,
      rollNumber: normRes.normalized,
      name: s.name,
      cohortId,
      departmentId: deptId,
      classSectionId: sectionId,
      academicYear: s.year || 1,
      cohortCode: cohortInfo.code,
      deptCode,
      sectionName
    });
  }

  console.log(`\nFiltered ${readyToEnroll.length} students matching criteria for enrollment backfill.`);

  if (opts.dryRun) {
    console.log("\n[SIMULATION STATS]");
    console.log(`Total students matched: ${readyToEnroll.length}`);
    console.log("No database changes performed.");
    return;
  }

  // Live Writes Chunk processing
  const chunkSize = 50;
  let enrolledCount = 0;
  let skippedDuplicatesCount = 0;

  for (let i = 0; i < readyToEnroll.length; i += chunkSize) {
    const chunk = readyToEnroll.slice(i, i + chunkSize);
    console.log(`\nProcessing chunk ${i / chunkSize + 1} (${chunk.length} students)...`);

    // Bulk query existing enrollments for this chunk
    const studentIds = chunk.map(c => c.studentId);
    const existingEnrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        isCurrent: true
      }
    });

    const existingMap = new Map<string, any>();
    existingEnrollments.forEach(e => existingMap.set(e.studentId, e));

    const toEnroll: any[] = [];

    for (const entry of chunk) {
      const existing = existingMap.get(entry.studentId);
      if (existing) {
        if (
          existing.cohortId === entry.cohortId &&
          existing.departmentId === entry.departmentId &&
          existing.classSectionId === entry.classSectionId &&
          existing.academicYear === entry.academicYear
        ) {
          skippedDuplicatesCount++;
        } else {
          console.warn(`Warning: Student ${entry.name} (${entry.rollNumber}) has a different current enrollment! Skipping.`);
        }
        continue;
      }
      toEnroll.push(entry);
    }

    if (toEnroll.length > 0) {
      // Run the inserts inside a transaction with a larger timeout to be safe
      await prisma.$transaction(async (tx) => {
        for (const entry of toEnroll) {
          await tx.studentEnrollment.create({
            data: {
              studentId: entry.studentId,
              cohortId: entry.cohortId,
              departmentId: entry.departmentId,
              classSectionId: entry.classSectionId,
              academicYear: entry.academicYear,
              isCurrent: true,
              enrollmentStatus: "ACTIVE"
            }
          });
        }
      }, {
        timeout: 15000 // 15 seconds
      });
      enrolledCount += toEnroll.length;
    }

    console.log(`Chunk ${i / chunkSize + 1} committed successfully. Enrolled in this chunk: ${toEnroll.length}`);
  }

  console.log(`\n=== BACKFILL RUN SUMMARY ===`);
  console.log(`Successfully enrolled: ${enrolledCount}`);
  console.log(`Skipped duplicate/matching active enrollments: ${skippedDuplicatesCount}`);
  console.log(`Total processed: ${enrolledCount + skippedDuplicatesCount}`);
}

if (process.argv[1] && process.argv[1].includes("student-enrollment-backfill")) {
  main()
    .catch(err => {
      console.error("Backfill failed: ", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
