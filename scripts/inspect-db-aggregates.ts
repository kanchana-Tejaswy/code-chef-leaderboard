import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Production Database Aggregates ===");

  const studentProfileCount = await prisma.studentProfile.count();
  const studentEnrollmentCount = await prisma.studentEnrollment.count();
  const cohortCount = await prisma.cohort.count();
  const departmentCount = await prisma.department.count();
  const classSectionCount = await prisma.classSection.count();
  const userAccessCount = await prisma.userAccess.count();
  const auditLogCount = await prisma.auditLog.count();

  console.log(`- StudentProfile: ${studentProfileCount}`);
  console.log(`- StudentEnrollment: ${studentEnrollmentCount}`);
  console.log(`- Cohort: ${cohortCount}`);
  console.log(`- Department: ${departmentCount}`);
  console.log(`- ClassSection: ${classSectionCount}`);
  console.log(`- UserAccess: ${userAccessCount}`);
  console.log(`- AuditLog: ${auditLogCount}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
