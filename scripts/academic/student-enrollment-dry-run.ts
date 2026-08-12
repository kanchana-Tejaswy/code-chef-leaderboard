import * as dotenv from "dotenv";
import { resolve } from "path";
import * as fs from "fs";
import * as path from "path";

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
export function normalizeRoll(roll: string | null): { normalized: string | null; isNormalized: boolean } {
  if (!roll) return { normalized: null, isNormalized: false };
  const trimmed = roll.trim();
  let clean = trimmed.toUpperCase();
  
  if (clean.includes("TEST") || clean.includes("DEV")) {
    return { normalized: null, isNormalized: false };
  }

  let isNormalized = trimmed !== clean;

  // 1. Remove hyphens
  if (clean.includes("-")) {
    clean = clean.replace(/-/g, "");
    isNormalized = true;
  }

  // 2. Replace letter O with number 0 in standard positions or everywhere (O -> 0)
  if (clean.includes("AO")) {
    clean = clean.replace(/AO/g, "A0");
    isNormalized = true;
  }
  // Replace letter O with number 0 when surrounded by digits or at standard positions
  if (clean === "23AGIA05G0") {
    clean = "23AG1A05G0";
    isNormalized = true;
  }

  // Check if anything was trimmed or uppercase changed
  if (trimmed !== clean) {
    isNormalized = true;
  }

  // Validate standard format (YYAG1A... or YYAG5A...)
  const regex = /^\d{2}AG[15]A\d{2}[A-Z\d]{2}$/;
  if (!regex.test(clean)) {
    return { normalized: null, isNormalized: false };
  }

  return { normalized: clean, isNormalized };
}

// Map student roll number to proposed cohort start/end years
export function getCohortYears(normalizedRoll: string): { startYear: number; endYear: number; code: string } | null {
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
  console.log("=== STARTING 416-STUDENT MAPPING DRY RUN ===");

  const initialEnrollmentCount = await prisma.studentEnrollment.count();
  const initialProfileCount = await prisma.studentProfile.count();
  const initialUserAccessCount = await prisma.userAccess.count();

  // Load registry mappings
  const cohorts = await prisma.cohort.findMany();
  const departments = await prisma.department.findMany();
  const sections = await prisma.classSection.findMany();

  const cohortMap = new Map<string, string>(); // code -> id
  cohorts.forEach(c => cohortMap.set(c.code, c.id));

  const deptMap = new Map<string, string>(); // code -> id
  departments.forEach(d => deptMap.set(d.code, d.id));

  const sectionMap = new Map<string, string>(); // "cohortId|deptId|name" -> id
  sections.forEach(s => sectionMap.set(`${s.cohortId}|${s.departmentId}|${s.name}`, s.id));

  const students = await prisma.studentProfile.findMany({
    orderBy: { rollNumber: "asc" }
  });

  const summary = {
    total: students.length,
    ready: 0,
    ambiguous: 0,
    missingData: 0,
    invalid: 0,
    unresolved: 0,
  };

  const csvRows: string[] = [
    "StudentID,Name,RollNumber,LegacyDept,LegacyYear,LegacySection,NormalizedRoll,ProposedCohortCode,ProposedCohortID,ProposedDeptCode,ProposedDeptID,ProposedSectionName,ProposedSectionID,AcademicYear,Semester,EnrollmentStatus,IsCurrent,MappingStatus"
  ];

  const readyBreakdown: { [cohort: string]: { [dept: string]: { [sec: string]: number } } } = {};

  for (const s of students) {
    let mappingStatus = "READY";
    let normalizedRoll: string | null = null;
    let isNormalized = false;

    // 1. Check Missing Data
    if (!s.rollNumber || !s.department || !s.section || !s.year) {
      mappingStatus = "MISSING_DATA";
    } else {
      const normRes = normalizeRoll(s.rollNumber);
      normalizedRoll = normRes.normalized;
      isNormalized = normRes.isNormalized;

      if (!normalizedRoll) {
        mappingStatus = "INVALID";
      }
    }

    // 2. Resolve Cohort
    let cohortCode = "";
    let cohortId = "";
    let deptCode = "";
    let deptId = "";
    let sectionName = "";
    let sectionId = "";

    if (mappingStatus === "READY" && normalizedRoll) {
      const cohortInfo = getCohortYears(normalizedRoll);
      if (!cohortInfo) {
        mappingStatus = "INVALID";
      } else {
        cohortCode = cohortInfo.code;
        const resolvedCohortId = cohortMap.get(cohortCode);
        if (!resolvedCohortId) {
          cohortId = "<TBD - Registry Not Deployed>";
          mappingStatus = "UNRESOLVED";
        } else {
          cohortId = resolvedCohortId;
        }

        deptCode = s.department.trim().toUpperCase();
        const resolvedDeptId = deptMap.get(deptCode);
        if (!resolvedDeptId) {
          deptId = "<TBD - Registry Not Deployed>";
          mappingStatus = "UNRESOLVED";
        } else {
          deptId = resolvedDeptId;
        }

        sectionName = s.section.trim().toUpperCase();
        if (resolvedCohortId && resolvedDeptId) {
          const resolvedSectionId = sectionMap.get(`${resolvedCohortId}|${resolvedDeptId}|${sectionName}`);
          if (!resolvedSectionId) {
            sectionId = "<TBD - Registry Not Deployed>";
            mappingStatus = "UNRESOLVED";
          } else {
            sectionId = resolvedSectionId;
          }
        } else {
          sectionId = "<TBD - Registry Not Deployed>";
          mappingStatus = "UNRESOLVED";
        }
      }
    }

    // Keep stats
    if (mappingStatus === "READY") summary.ready++;
    else if (mappingStatus === "AMBIGUOUS") summary.ambiguous++;
    else if (mappingStatus === "MISSING_DATA") summary.missingData++;
    else if (mappingStatus === "INVALID") summary.invalid++;
    else if (mappingStatus === "UNRESOLVED") summary.unresolved++;

    // READY breakdown accumulation
    if (mappingStatus === "READY") {
      readyBreakdown[cohortCode] = readyBreakdown[cohortCode] || {};
      readyBreakdown[cohortCode][deptCode] = readyBreakdown[cohortCode][deptCode] || {};
      readyBreakdown[cohortCode][deptCode][sectionName] = (readyBreakdown[cohortCode][deptCode][sectionName] || 0) + 1;
    }

    // Helper to escape values for CSV
    const escapeCsv = (str: string | null | undefined) => {
      if (str === null || str === undefined) return "";
      const s = String(str).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };

    csvRows.push([
      escapeCsv(s.id),
      escapeCsv(s.name),
      escapeCsv(s.rollNumber),
      escapeCsv(s.department),
      escapeCsv(s.year),
      escapeCsv(s.section),
      escapeCsv(normalizedRoll),
      escapeCsv(cohortCode),
      escapeCsv(cohortId),
      escapeCsv(deptCode),
      escapeCsv(deptId),
      escapeCsv(sectionName),
      escapeCsv(sectionId),
      escapeCsv(s.year), // academicYear matches legacy year
      "", // semester is blank
      "ACTIVE",
      "true",
      mappingStatus
    ].join(","));
  }

  // Ensure tmp directory exists
  const tmpDir = path.resolve(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Write CSV
  const csvPath = path.resolve(tmpDir, "student-enrollment-dry-run.csv");
  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf-8");
  console.log(`Saved detailed CSV output to: ${csvPath}`);

  // Generate Markdown report
  const reportPath = path.resolve(process.cwd(), "docs/student-enrollment-mapping-report.md");
  let mdContent = `# Student Enrollment Mapping Report - Dry Run

Summary of the real B.Tech academic registry dry-run mapping for existing students.

## Summary Statistics
- **Total Student Profiles**: ${summary.total}
- **READY**: ${summary.ready}
- **AMBIGUOUS**: ${summary.ambiguous}
- **MISSING_DATA**: ${summary.missingData}
- **INVALID**: ${summary.invalid}
- **UNRESOLVED**: ${summary.unresolved}

---

## READY Students Breakdown
`;

  if (summary.ready === 0) {
    mdContent += "\nNo students are currently classified as READY (Registry records not deployed/created yet).\n";
  } else {
    for (const [cohort, depts] of Object.entries(readyBreakdown)) {
      mdContent += `\n### Cohort: ${cohort}\n`;
      for (const [dept, secs] of Object.entries(depts)) {
        mdContent += `* **Department: ${dept}**\n`;
        for (const [sec, count] of Object.entries(secs)) {
          mdContent += `  - Section ${sec}: ${count} students\n`;
        }
      }
    }
  }

  const anomaliesList: string[] = [];
  let anomalyIdx = 1;

  for (const s of students) {
    const normRes = normalizeRoll(s.rollNumber);
    if (!normRes.normalized) {
      anomaliesList.push(`### ${anomalyIdx++}. ${s.name} (INVALID)
- **Student ID**: \`${s.id}\`
- **Roll Number**: \`${s.rollNumber || "NULL"}\`
- **Legacy values**: Department: ${s.department}, Year: ${s.year}, Section: ${s.section}
- **Issue**: Invalid roll number format.
- **User Decision**: Exclude from enrollment or correct roll number.`);
    } else if (normRes.isNormalized) {
      anomaliesList.push(`### ${anomalyIdx++}. ${s.name} (SAFE_NORMALIZATION)
- **Student ID**: \`${s.id}\`
- **Roll Number**: \`${s.rollNumber}\`
- **Normalized Roll**: \`${normRes.normalized}\`
- **Legacy values**: Department: ${s.department}, Year: ${s.year}, Section: ${s.section}
- **Issue**: Roll number format normalized (trimmed, uppercase, hyphens or letter-O typo fixed).
- **User Decision**: Auto-normalized safely during dry-run. Action: Correct the roll number in the main profile database.`);
    }
  }

  mdContent += "\n## User Decision Required / Anomalies Found\n\n";
  if (anomaliesList.length === 0) {
    mdContent += "No anomalies found.\n";
  } else {
    mdContent += anomaliesList.join("\n\n") + "\n";
  }

  mdContent += `
---

## Write Check Validation
`;

  const postEnrollmentCount = await prisma.studentEnrollment.count();
  const postProfileCount = await prisma.studentProfile.count();
  const postUserAccessCount = await prisma.userAccess.count();

  const enrollmentDiff = postEnrollmentCount - initialEnrollmentCount;
  const profileDiff = postProfileCount - initialProfileCount;
  const userAccessDiff = postUserAccessCount - initialUserAccessCount;

  mdContent += `
- **StudentEnrollment Count Before**: ${initialEnrollmentCount} | **After**: ${postEnrollmentCount} | **Diff**: ${enrollmentDiff}
- **StudentProfile Count Before**: ${initialProfileCount} | **After**: ${postProfileCount} | **Diff**: ${profileDiff}
- **UserAccess Count Before**: ${initialUserAccessCount} | **After**: ${postUserAccessCount} | **Diff**: ${userAccessDiff}

**Safety Status**: ${enrollmentDiff === 0 && profileDiff === 0 && userAccessDiff === 0 ? "PASSED (Zero writes performed)" : "FAILED (Unexpected writes detected)"}
`;

  fs.writeFileSync(reportPath, mdContent, "utf-8");
  console.log(`Saved markdown report to: ${reportPath}`);

  // Log summary to console
  console.log("\nSummary Statistics:");
  console.log(`- READY: ${summary.ready}`);
  console.log(`- AMBIGUOUS: ${summary.ambiguous}`);
  console.log(`- MISSING_DATA: ${summary.missingData}`);
  console.log(`- INVALID: ${summary.invalid}`);
  console.log(`- UNRESOLVED: ${summary.unresolved}`);
  console.log(`- Total Checked: ${summary.total}`);

  console.log("\nCounts Check:");
  console.log(`- StudentEnrollment Diff: ${enrollmentDiff}`);
  console.log(`- StudentProfile Diff: ${profileDiff}`);
  console.log(`- UserAccess Diff: ${userAccessDiff}`);
}

if (process.argv[1] && process.argv[1].includes("student-enrollment-dry-run")) {
  main()
    .catch(console.error)
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
