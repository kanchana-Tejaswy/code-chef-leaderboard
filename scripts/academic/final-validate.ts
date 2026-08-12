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

async function main() {
  console.log("=== RUNNING FINAL DATABASE INTEGRITY VALIDATION ===");

  const profileCount = await prisma.studentProfile.count();
  const enrollmentCount = await prisma.studentEnrollment.count();

  console.log(`StudentProfile Count: ${profileCount}`);
  console.log(`StudentEnrollment Count: ${enrollmentCount}`);

  if (profileCount !== 416) throw new Error("Validation failed: StudentProfiles count must be exactly 416");
  if (enrollmentCount !== 414) throw new Error("Validation failed: StudentEnrollments count must be exactly 414");

  // 1. Verify specific invalid students are intentionally excluded (no enrollments)
  const invalidRolls = ["22CS999", "23AG1A17229"];
  for (const roll of invalidRolls) {
    const student = await prisma.studentProfile.findUnique({ where: { rollNumber: roll } });
    if (!student) throw new Error(`Validation failed: Excluded student with roll ${roll} not found`);
    
    const count = await prisma.studentEnrollment.count({ where: { studentId: student.id } });
    if (count !== 0) throw new Error(`Validation failed: Excluded student ${roll} has ${count} enrollment(s), expected 0`);
  }
  console.log("✓ Verified invalid students are excluded.");

  // 2. Verify zero duplicate current enrollments
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { isCurrent: true }
  });

  const enrolledStudentIds = new Set<string>();
  for (const e of enrollments) {
    if (enrolledStudentIds.has(e.studentId)) {
      throw new Error(`Validation failed: Duplicate current enrollment found for studentId ${e.studentId}`);
    }
    enrolledStudentIds.add(e.studentId);
  }
  console.log("✓ Verified zero duplicate current enrollments.");

  // 3. Verify zero orphan enrollments and zero section cohort/department mismatches
  const students = await prisma.studentProfile.findMany();
  const cohorts = await prisma.cohort.findMany();
  const departments = await prisma.department.findMany();
  const classSections = await prisma.classSection.findMany();

  const studentMap = new Map(students.map(s => [s.id, s]));
  const cohortMap = new Map(cohorts.map(c => [c.id, c]));
  const deptMap = new Map(departments.map(d => [d.id, d]));
  const sectionMap = new Map(classSections.map(s => [s.id, s]));

  for (const e of enrollments) {
    const student = studentMap.get(e.studentId);
    if (!student) throw new Error(`Validation failed: Orphan enrollment found pointing to non-existent student ${e.studentId}`);

    const cohort = cohortMap.get(e.cohortId);
    if (!cohort) throw new Error(`Validation failed: Non-existent cohort ${e.cohortId} referenced by enrollment`);

    const dept = deptMap.get(e.departmentId);
    if (!dept) throw new Error(`Validation failed: Non-existent department ${e.departmentId} referenced by enrollment`);

    if (e.classSectionId) {
      const section = sectionMap.get(e.classSectionId);
      if (!section) throw new Error(`Validation failed: Non-existent class section ${e.classSectionId} referenced by enrollment`);
      
      // Mismatch checks
      if (section.cohortId !== e.cohortId) throw new Error(`Validation failed: Section cohort ID mismatch on enrollment ${e.id}`);
      if (section.departmentId !== e.departmentId) throw new Error(`Validation failed: Section department ID mismatch on enrollment ${e.id}`);
    }

    if (e.academicYear < 1 || e.academicYear > 4) {
      throw new Error(`Validation failed: Invalid academicYear ${e.academicYear} on enrollment ${e.id}`);
    }
  }
  console.log("✓ Verified zero orphan enrollments or mismatches.");

  // 4. Generate aggregates
  console.log("\n[AGGREGATE METRICS]");

  // Cohort aggregates
  const cohortAgg = await prisma.studentEnrollment.groupBy({
    by: ['cohortId'],
    _count: { _all: true },
    where: { isCurrent: true }
  });
  console.log("\nCohort Totals:");
  let totalCohortsSum = 0;
  for (const agg of cohortAgg) {
    const c = cohortMap.get(agg.cohortId);
    console.log(`- Cohort ${c?.code}: ${agg._count._all}`);
    totalCohortsSum += agg._count._all;
  }

  // Department aggregates
  const deptAgg = await prisma.studentEnrollment.groupBy({
    by: ['departmentId'],
    _count: { _all: true },
    where: { isCurrent: true }
  });
  console.log("\nDepartment Totals:");
  let totalDeptsSum = 0;
  for (const agg of deptAgg) {
    const d = deptMap.get(agg.departmentId);
    console.log(`- Dept ${d?.code}: ${agg._count._all}`);
    totalDeptsSum += agg._count._all;
  }

  // Section aggregates
  const sectionAgg = await prisma.studentEnrollment.groupBy({
    by: ['classSectionId'],
    _count: { _all: true },
    where: { isCurrent: true }
  });
  console.log("\nSection Totals:");
  let totalSectionsSum = 0;
  for (const agg of sectionAgg) {
    if (agg.classSectionId) {
      const s = sectionMap.get(agg.classSectionId);
      const c = s ? cohortMap.get(s.cohortId) : null;
      const d = s ? deptMap.get(s.departmentId) : null;
      console.log(`- Section ${c?.code} | ${d?.code} | ${s?.name}: ${agg._count._all}`);
    } else {
      console.log(`- No Section Assigned: ${agg._count._all}`);
    }
    totalSectionsSum += agg._count._all;
  }

  // Academic year aggregates
  const yearAgg = await prisma.studentEnrollment.groupBy({
    by: ['academicYear'],
    _count: { _all: true },
    where: { isCurrent: true }
  });
  console.log("\nAcademic Year Totals:");
  let totalYearsSum = 0;
  for (const agg of yearAgg) {
    console.log(`- Year ${agg.academicYear}: ${agg._count._all}`);
    totalYearsSum += agg._count._all;
  }

  console.log(`\nSums Check -> Cohorts: ${totalCohortsSum}, Depts: ${totalDeptsSum}, Sections: ${totalSectionsSum}, Years: ${totalYearsSum}`);
  if (totalCohortsSum !== 414 || totalDeptsSum !== 414 || totalSectionsSum !== 414 || totalYearsSum !== 414) {
    throw new Error("Validation failed: Aggregates do not sum up to 414");
  }

  console.log("\n✓ All database validation checks PASSED successfully!");
}

main()
  .catch(err => {
    console.error("\nValidation failed: ", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
