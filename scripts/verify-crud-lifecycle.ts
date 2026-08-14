import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

import { prisma } from "../src/lib/prisma";
import { StudentProfileService } from "../src/services/student-profile.service";

async function run() {
  console.log("=== STARTING ACE PRODUCTION CRUD LIFECYCLE VERIFICATION ===");

  const rollNumber = "TEST-CRUD-001";
  const name = "ACE CRUD Test Student";

  // Clean up any stale test records from previous attempts
  const existing = await prisma.studentProfile.findUnique({
    where: { rollNumber }
  });
  if (existing) {
    console.log(`Found stale test student ${rollNumber}. Cleaning up...`);
    await prisma.$transaction([
      prisma.syncJob.deleteMany({ where: { studentId: existing.id } }),
      prisma.studentEnrollment.deleteMany({ where: { studentId: existing.id } }),
      prisma.codechefProfile.deleteMany({ where: { studentId: existing.id } }),
      prisma.leetcodeProfile.deleteMany({ where: { studentId: existing.id } }),
      prisma.githubProfile.deleteMany({ where: { studentId: existing.id } }),
      prisma.studentProfile.delete({ where: { id: existing.id } })
    ]);
    console.log("Stale test student cleaned up successfully.");
  }

  // Get active cohort and department references
  const cohort = await prisma.cohort.findFirst({ where: { status: "ACTIVE" } });
  const department = await prisma.department.findFirst({ where: { isActive: true } });

  if (!cohort || !department) {
    console.error("Error: Could not find any active cohorts or departments in the system registry.");
    process.exit(1);
  }

  console.log(`Using Cohort: ${cohort.code} (${cohort.id})`);
  console.log(`Using Department: ${department.code} (${department.id})`);

  // 1. Create Class Section A and B under this cohort/department if they don't exist
  let sectionA = await prisma.classSection.findUnique({
    where: { cohortId_departmentId_name: { cohortId: cohort.id, departmentId: department.id, name: "TEST-A" } }
  });
  if (!sectionA) {
    sectionA = await prisma.classSection.create({
      data: { cohortId: cohort.id, departmentId: department.id, name: "TEST-A", isActive: true }
    });
  }

  let sectionB = await prisma.classSection.findUnique({
    where: { cohortId_departmentId_name: { cohortId: cohort.id, departmentId: department.id, name: "TEST-B" } }
  });
  if (!sectionB) {
    sectionB = await prisma.classSection.create({
      data: { cohortId: cohort.id, departmentId: department.id, name: "TEST-B", isActive: true }
    });
  }

  console.log(`Section A: ${sectionA.name} (${sectionA.id})`);
  console.log(`Section B: ${sectionB.name} (${sectionB.id})`);

  // 2. CREATE Student under Section A
  console.log("\n--- STEP 1: Creating Student under Section A ---");
  const createResult = await StudentProfileService.createProfile({
    name,
    rollNumber,
    email: "testcrud001@ace.edu",
    contactNumber: "9999988888",
    year: 1,
    branch: department.code,
    department: department.code,
    section: sectionA.name,
    cgpa: 8.5,
    codechefUsername: null,
    leetcodeUsername: null,
    codeforcesUsername: null,
    githubUsername: null,
    linkedinUrl: null,
    profilePictureUrl: null,
    cohortId: cohort.id,
    departmentId: department.id,
    classSectionId: sectionA.id
  });

  if (!createResult.success || !createResult.profile) {
    console.error("Student creation failed:", createResult.error);
    process.exit(1);
  }

  const student = createResult.profile;
  console.log(`Student created: ${student.name} (${student.id})`);

  // Verify active enrollment
  let currentEnrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId: student.id, isCurrent: true }
  });
  console.log(`Initial active enrollment resolved: Section ID = ${currentEnrollment?.classSectionId}`);
  if (currentEnrollment?.classSectionId !== sectionA.id) {
    console.error("Assertion failed: Student is not enrolled in Section A");
    process.exit(1);
  }

  // 3. MOVE Student to Section B
  console.log("\n--- STEP 2: Moving Student to Section B ---");
  // Simulate PATCH update where classSectionId changes to Section B
  await prisma.$transaction(async (tx) => {
    // 1. Update profile section name field
    await tx.studentProfile.update({
      where: { id: student.id },
      data: { section: sectionB.name }
    });

    // 2. End old enrollment
    await tx.studentEnrollment.update({
      where: { id: currentEnrollment!.id },
      data: { isCurrent: false, endedAt: new Date() }
    });

    // 3. Create new enrollment
    await tx.studentEnrollment.create({
      data: {
        studentId: student.id,
        cohortId: cohort.id,
        departmentId: department.id,
        classSectionId: sectionB.id,
        academicYear: 1,
        isCurrent: true,
        enrollmentStatus: "ACTIVE",
        startedAt: new Date()
      }
    });
  });

  // Verify history
  const enrollmentsAfterMove = await prisma.studentEnrollment.findMany({
    where: { studentId: student.id },
    orderBy: { startedAt: "asc" }
  });

  console.log(`Total enrollment records: ${enrollmentsAfterMove.length}`);
  enrollmentsAfterMove.forEach((e, idx) => {
    console.log(`Enrollment ${idx + 1}: Section = ${e.classSectionId}, isCurrent = ${e.isCurrent}, endedAt = ${e.endedAt}`);
  });

  if (enrollmentsAfterMove.length !== 2) {
    console.error("Assertion failed: Expected exactly 2 enrollment records");
    process.exit(1);
  }
  if (enrollmentsAfterMove[0].isCurrent || enrollmentsAfterMove[0].endedAt === null) {
    console.error("Assertion failed: Old enrollment was not ended correctly");
    process.exit(1);
  }
  if (!enrollmentsAfterMove[1].isCurrent || enrollmentsAfterMove[1].classSectionId !== sectionB.id) {
    console.error("Assertion failed: New enrollment is not current or pointing to Section B");
    process.exit(1);
  }

  // 4. MOVE Student to Unassigned (classSectionId = null)
  console.log("\n--- STEP 3: Moving Student to Unassigned ---");
  await prisma.$transaction(async (tx) => {
    await tx.studentProfile.update({
      where: { id: student.id },
      data: { section: null }
    });

    await tx.studentEnrollment.update({
      where: { id: enrollmentsAfterMove[1].id },
      data: { isCurrent: false, endedAt: new Date() }
    });

    await tx.studentEnrollment.create({
      data: {
        studentId: student.id,
        cohortId: cohort.id,
        departmentId: department.id,
        classSectionId: null, // unassigned
        academicYear: 1,
        isCurrent: true,
        enrollmentStatus: "ACTIVE",
        startedAt: new Date()
      }
    });
  });

  const enrollmentsAfterUnassigned = await prisma.studentEnrollment.findMany({
    where: { studentId: student.id },
    orderBy: { startedAt: "asc" }
  });

  console.log(`Total enrollment records: ${enrollmentsAfterUnassigned.length}`);
  enrollmentsAfterUnassigned.forEach((e, idx) => {
    console.log(`Enrollment ${idx + 1}: Section = ${e.classSectionId}, isCurrent = ${e.isCurrent}, endedAt = ${e.endedAt}`);
  });

  if (enrollmentsAfterUnassigned.length !== 3) {
    console.error("Assertion failed: Expected exactly 3 enrollment records after unassigning");
    process.exit(1);
  }
  if (!enrollmentsAfterUnassigned[2].isCurrent || enrollmentsAfterUnassigned[2].classSectionId !== null) {
    console.error("Assertion failed: Current enrollment is not unassigned/null");
    process.exit(1);
  }

  // 5. ARCHIVE Student
  console.log("\n--- STEP 4: Archiving Student ---");
  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        archivedAt: new Date(),
        leaderboardEligible: false,
        dashboardEligible: false
      }
    })
  ]);

  const archivedStudent = await prisma.studentProfile.findUnique({
    where: { id: student.id }
  });
  console.log(`Archived status check: archivedAt = ${archivedStudent?.archivedAt}, leaderboardEligible = ${archivedStudent?.leaderboardEligible}`);
  if (!archivedStudent?.archivedAt) {
    console.error("Assertion failed: Student was not archived correctly");
    process.exit(1);
  }

  // 6. RESTORE Student
  console.log("\n--- STEP 5: Restoring Student ---");
  await prisma.studentProfile.update({
    where: { id: student.id },
    data: {
      archivedAt: null,
      leaderboardEligible: false,
      dashboardEligible: false
    }
  });

  const restoredStudent = await prisma.studentProfile.findUnique({
    where: { id: student.id }
  });
  console.log(`Restored status check: archivedAt = ${restoredStudent?.archivedAt}`);
  if (restoredStudent?.archivedAt !== null) {
    console.error("Assertion failed: Student was not restored correctly");
    process.exit(1);
  }

  // 7. PERMANENTLY DELETE Student
  console.log("\n--- STEP 6: Permanently Deleting Student ---");
  await prisma.$transaction(async (tx) => {
    await tx.syncJob.deleteMany({ where: { studentId: student.id } });
    await tx.studentEnrollment.deleteMany({ where: { studentId: student.id } });
    await tx.studentProfile.delete({ where: { id: student.id } });
  });

  const deletedStudent = await prisma.studentProfile.findUnique({
    where: { id: student.id }
  });
  console.log(`Deleted status check: findUnique returned = ${deletedStudent}`);
  if (deletedStudent !== null) {
    console.error("Assertion failed: Student was not permanently deleted");
    process.exit(1);
  }

  // Clean up temporary class sections we created
  await prisma.classSection.deleteMany({
    where: {
      cohortId: cohort.id,
      departmentId: department.id,
      name: { in: ["TEST-A", "TEST-B"] }
    }
  });

  console.log("\n=== CRUD LIFECYCLE VERIFICATION COMPLETED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Unhandled error during verification:", err);
  process.exit(1);
});
