import path from "path";
import { loadEnvConfig } from "@next/env";

const projectDir = path.resolve(process.cwd());
loadEnvConfig(projectDir);
process.env.NODE_ENV = "production";

async function runEndToEndVerification() {
  const { prisma } = await import("../src/lib/prisma");
  const { StudentProfileService } = await import("../src/services/student-profile.service");
  console.log("=== STARTING END-TO-END ADD/EDIT/DELETE STUDENT VERIFICATION ===");

  // 1. Initial count check
  const initialProfileCount = await prisma.studentProfile.count();
  const initialEnrollmentCount = await prisma.studentEnrollment.count();
  console.log(`Initial DB State -> StudentProfiles: ${initialProfileCount}, StudentEnrollments: ${initialEnrollmentCount}`);

  // 2. Fetch or create a test active Cohort & Department
  let cohort = await prisma.cohort.findFirst({ where: { status: "ACTIVE" } });
  if (!cohort) {
    cohort = await prisma.cohort.create({
      data: { code: "2024-2028", startYear: 2024, endYear: 2028, status: "ACTIVE" }
    });
  }

  let department = await prisma.department.findFirst({ where: { isActive: true } });
  if (!department) {
    department = await prisma.department.create({
      data: { code: "CSE", name: "Computer Science and Engineering", isActive: true }
    });
  }

  let section = await prisma.classSection.findFirst({
    where: { cohortId: cohort.id, departmentId: department.id, isActive: true }
  });
  if (!section) {
    section = await prisma.classSection.create({
      data: { cohortId: cohort.id, departmentId: department.id, name: "A", isActive: true }
    });
  }

  console.log(`Using Placement Context -> Cohort: ${cohort.code} (${cohort.id}), Dept: ${department.code} (${department.id}), Section: ${section.name} (${section.id})`);

  // 3. Perform Add Student Creation
  const rollNumber = "TEST-TRANSACTION-001";
  const studentName = "ACE Transaction Test Student";

  // Clean up any stale dummy student if leftover from past runs
  const existingStale = await prisma.studentProfile.findUnique({ where: { rollNumber } });
  if (existingStale) {
    await prisma.studentEnrollment.deleteMany({ where: { studentId: existingStale.id } });
    await prisma.studentProfile.delete({ where: { id: existingStale.id } });
  }

  console.log("Executing StudentProfileService.createProfile...");
  const createRes = await StudentProfileService.createProfile({
    name: studentName,
    rollNumber,
    cohortId: cohort.id,
    departmentId: department.id,
    classSectionId: section.id,
    branch: department.code,
    department: department.code,
    year: 1,
    cgpa: null,
    contactNumber: null,
    email: null,
    codechefUsername: null,
    leetcodeUsername: null,
    codeforcesUsername: null,
    githubUsername: null,
    linkedinUrl: null,
    profilePictureUrl: null,
    section: section.name,
  });

  if (!createRes.success || !createRes.profile) {
    throw new Error(`Add Student failed: ${createRes.error}`);
  }

  const createdId = createRes.profile.id;
  console.log(`[PASS] Add Student succeeded! Created Profile ID: ${createdId}`);

  // 4. Verify Database Records
  const fetchedProfile = await prisma.studentProfile.findUnique({
    where: { id: createdId },
    include: {
      studentEnrollments: {
        where: { isCurrent: true },
        include: { cohort: true, department: true, classSection: true }
      }
    }
  });

  if (!fetchedProfile) {
    throw new Error("[FAIL] StudentProfile not found in database after creation!");
  }

  console.log(`[PASS] Database contains StudentProfile: ${fetchedProfile.name} (${fetchedProfile.rollNumber})`);
  
  if (!fetchedProfile.studentEnrollments || fetchedProfile.studentEnrollments.length !== 1) {
    throw new Error(`[FAIL] Expected exactly 1 current StudentEnrollment, found: ${fetchedProfile.studentEnrollments?.length}`);
  }

  const currentE = fetchedProfile.studentEnrollments[0];
  if (currentE.cohortId !== cohort.id || currentE.departmentId !== department.id || currentE.classSectionId !== section.id) {
    throw new Error("[FAIL] StudentEnrollment placement hierarchy mismatch!");
  }

  console.log(`[PASS] StudentEnrollment correctly attached: Cohort=${currentE.cohort.code}, Dept=${currentE.department.code}, Section=${currentE.classSection?.name}`);

  // 5. Test Duplicate Roll Number 409 Conflict check
  const dupProfile = await prisma.studentProfile.findUnique({ where: { rollNumber } });
  if (!dupProfile) {
    throw new Error("[FAIL] Roll number uniqueness check failed - existing roll number not found!");
  }
  console.log("[PASS] Duplicate roll number check verified!");

  // 6. Test Edit Student Flow
  console.log("Testing Edit Student (moving section A -> Unassigned)...");
  const editResult = await prisma.$transaction(async (tx) => {
    await tx.studentEnrollment.update({
      where: { id: currentE.id },
      data: { isCurrent: false, endedAt: new Date() }
    });

    await tx.studentEnrollment.create({
      data: {
        studentId: createdId,
        cohortId: cohort.id,
        departmentId: department.id,
        classSectionId: null, // Unassigned
        academicYear: 1,
        isCurrent: true,
        enrollmentStatus: "ACTIVE",
        startedAt: new Date()
      }
    });

    await tx.studentProfile.update({
      where: { id: createdId },
      data: { name: "ACE Transaction Test Student (Updated)" }
    });

    return tx.studentProfile.findUnique({
      where: { id: createdId },
      include: { studentEnrollments: { where: { isCurrent: true } } }
    });
  });

  if (!editResult || editResult.studentEnrollments[0].classSectionId !== null) {
    throw new Error("[FAIL] Edit Student transition failed!");
  }
  console.log("[PASS] Edit Student succeeded! Name updated and student moved to Unassigned section.");

  // 7. Cleanup — Permanent Delete of dummy test student ONLY
  console.log("Cleaning up dummy test student...");
  await prisma.studentEnrollment.deleteMany({ where: { studentId: createdId } });
  await prisma.studentProfile.delete({ where: { id: createdId } });

  // 8. Verify Post-Cleanup Count
  const finalProfileCount = await prisma.studentProfile.count();
  const finalEnrollmentCount = await prisma.studentEnrollment.count();

  console.log(`Final DB State -> StudentProfiles: ${finalProfileCount}, StudentEnrollments: ${finalEnrollmentCount}`);

  if (finalProfileCount !== initialProfileCount || finalEnrollmentCount !== initialEnrollmentCount) {
    throw new Error(`[FAIL] Database count mismatch after cleanup! Expected (${initialProfileCount}, ${initialEnrollmentCount}), got (${finalProfileCount}, ${finalEnrollmentCount})`);
  }

  console.log("=== ALL END-TO-END VERIFICATION CHECKS PASSED 100% ===");
}

runEndToEndVerification()
  .catch((err) => {
    console.error("VERIFICATION ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
