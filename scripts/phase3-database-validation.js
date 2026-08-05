const { PrismaClient } = require('@prisma/client');

// Initialize Prisma
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runTests() {
  const url = process.env.DATABASE_URL;

  console.log("Starting Phase 3 Database Constraint Verification...");

  // 1. Safety Check
  if (!url) {
    console.error("FATAL: DATABASE_URL is not set.");
    process.exit(1);
  }

  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const isSupabase = url.includes('supabase.co') || url.includes('mdvwpcntaetchvnlvvpo');

  if (!isLocal || isSupabase || !url.includes('ace_phase3_test')) {
    console.error("SECURITY BLOCK: Connection target is not a confirmed local disposable test database.");
    console.error("DATABASE_URL must point only to localhost/127.0.0.1 and use the database name 'ace_phase3_test'.");
    process.exit(1);
  }

  // PostgreSQL UUID columns require valid UUID strings. We map test IDs to predictable test UUIDs.
  const testCohortId = "a0000000-0000-0000-0000-000000000001";
  const testCohortId2 = "a0000000-0000-0000-0000-000000000002";
  const testDeptId = "b0000000-0000-0000-0000-000000000001";
  const testDeptId2 = "b0000000-0000-0000-0000-000000000002";
  const testSectionId = "c0000000-0000-0000-0000-000000000001";
  const testStudentId = "PHASE3_TEST_STU_1"; // TEXT column, can be string

  // Enrollment UUIDs
  const enrollId1 = "d0000000-0000-0000-0000-000000000001";
  const enrollId2 = "d0000000-0000-0000-0000-000000000002";
  const enrollIdErr1 = "d0000000-0000-0000-0000-000000000003";
  const enrollIdErr2 = "d0000000-0000-0000-0000-000000000004";
  const enrollIdErr3 = "d0000000-0000-0000-0000-000000000005";
  const enrollIdErr4 = "d0000000-0000-0000-0000-000000000006";
  const enrollIdErr5 = "d0000000-0000-0000-0000-000000000007";
  const enrollIdErr6 = "d0000000-0000-0000-0000-000000000008";
  const enrollIdErr7 = "d0000000-0000-0000-0000-000000000009";
  const enrollIdHist1 = "d0000000-0000-0000-0000-000000000010";
  const enrollIdHist2 = "d0000000-0000-0000-0000-000000000011";

  try {
    // 2. STRUCTURE VERIFICATION
    console.log("\n=== Checking Database Catalog Structure ===");

    // Verify Tables
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('cohorts', 'departments', 'class_sections', 'student_enrollments')
    `;
    if (tables.length === 4) {
      console.log("PASS: Additive tables (cohorts, departments, class_sections, student_enrollments) exist.");
    } else {
      console.error("FAIL: Additive tables structure validation failed.", tables);
    }

    // Verify Enums
    const enums = await prisma.$queryRaw`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('CohortStatus', 'EnrollmentStatus')
    `;
    const cohortStatuses = enums.filter(e => e.typname === 'CohortStatus').map(e => e.enumlabel);
    const enrollmentStatuses = enums.filter(e => e.typname === 'EnrollmentStatus').map(e => e.enumlabel);

    if (cohortStatuses.includes('ACTIVE') && enrollmentStatuses.includes('ACTIVE')) {
      console.log("PASS: CohortStatus and EnrollmentStatus enums exist with active labels.");
    } else {
      console.error("FAIL: Enum validation failed.");
    }

    // Verify Partial Unique Index
    const partialIndex = await prisma.$queryRaw`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'student_enrollments'
      AND indexname = 'student_enrollments_one_current_per_student'
    `;
    if (partialIndex.length > 0 && partialIndex[0].indexdef.includes('WHERE is_current')) {
      console.log("PASS: student_enrollments_one_current_per_student partial unique index exists.");
    } else {
      console.error("FAIL: Partial unique index validation failed.");
    }

    // Verify CHECK Constraints
    const checkConstraints = await prisma.$queryRaw`
      SELECT conname FROM pg_constraint
      WHERE conname IN ('student_enrollments_academic_year_check', 'student_enrollments_semester_check')
    `;
    if (checkConstraints.length === 2) {
      console.log("PASS: Academic year (1-4) and Semester (1-8) CHECK constraints exist.");
    } else {
      console.error("FAIL: CHECK constraints validation failed.");
    }

    // Verify Foreign Key Deltypes (onDelete: Restrict / Cascade)
    const fkConstraints = await prisma.$queryRaw`
      SELECT conname, confdeltype FROM pg_constraint
      WHERE conname IN (
        'class_sections_cohort_id_fkey',
        'class_sections_department_id_fkey',
        'student_enrollments_student_id_fkey',
        'student_enrollments_cohort_id_fkey',
        'student_enrollments_department_id_fkey',
        'student_enrollments_class_section_id_cohort_id_department__fkey'
      )
    `;
    const restrictFks = fkConstraints.filter(fk => fk.confdeltype === 'r');
    const cascadeFks = fkConstraints.filter(fk => fk.confdeltype === 'c');

    if (restrictFks.length === 5 && cascadeFks.length === 1) {
      console.log("PASS: Deletion rules verified: RESTRICT on academic relations, CASCADE on StudentProfile.");
    } else {
      console.error("FAIL: Deletion constraint policies verification failed.", fkConstraints);
    }

    console.log("\n=== Executing Integration Constraints Tests ===");

    // Test 1: Create Cohort
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO cohorts (id, code, start_year, end_year, status, updated_at)
        VALUES ('${testCohortId}', 'PHASE3_TEST_2024_2028', 2024, 2028, 'ACTIVE', NOW())
      `);
      console.log("PASS: 1. Create Cohort PHASE3_TEST_2024_2028");
    } catch (e) {
      console.error("FAIL: 1. Create Cohort", e.message);
    }

    // Test 2: Create Department
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO departments (id, code, name, is_active, updated_at)
        VALUES ('${testDeptId}', 'PHASE3_TEST_CSE', 'Computer Science', true, NOW())
      `);
      console.log("PASS: 2. Create Department PHASE3_TEST_CSE");
    } catch (e) {
      console.error("FAIL: 2. Create Department", e.message);
    }

    // Test 3: Create ClassSection
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO class_sections (id, cohort_id, department_id, name, capacity, is_active, updated_at)
        VALUES ('${testSectionId}', '${testCohortId}', '${testDeptId}', 'A', 60, true, NOW())
      `);
      console.log("PASS: 3. Create ClassSection A");
    } catch (e) {
      console.error("FAIL: 3. Create ClassSection A", e.message);
    }

    // Test 4: Create StudentProfile (Note: 'cgpa' maps to schema model field name correctly)
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_profiles (id, name, roll_number, email, cgpa, profile_status, admin_approval_status, updated_at)
        VALUES ('${testStudentId}', 'PHASE3_TEST_STUDENT', 'PHASE3_TEST_ROLL_1', 'PHASE3_TEST_STU_1@example.com', 8.5, 'ACTIVE', 'APPROVED', NOW())
      `);
      console.log("PASS: 4. Create fake StudentProfile");
    } catch (e) {
      console.error("FAIL: 4. Create fake StudentProfile", e.message);
    }

    // Test 5: Create valid current StudentEnrollment
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollId1}', '${testStudentId}', '${testCohortId}', '${testDeptId}', '${testSectionId}', 1, 1, true, 'ACTIVE', NOW())
      `);
      console.log("PASS: 5. Create valid current StudentEnrollment");
    } catch (e) {
      console.error("FAIL: 5. Create valid current StudentEnrollment", e.message);
    }

    // Test 6: Allow enrollment with classSectionId = null
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollId2}', '${testStudentId}', '${testCohortId}', '${testDeptId}', NULL, 1, 2, false, 'ACTIVE', NOW())
      `);
      console.log("PASS: 6. Allow enrollment where classSectionId is null");
    } catch (e) {
      console.error("FAIL: 6. Allow enrollment where classSectionId is null", e.message);
    }

    // Test 7: Reject academicYear = 0
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollIdErr1}', '${testStudentId}', '${testCohortId}', '${testDeptId}', NULL, 0, 1, false, 'ACTIVE', NOW())
      `);
      console.error("FAIL: 7. Reject academicYear = 0 (Insert succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('academic_year_check') || e.message.includes('23514')) {
        console.log("PASS: 7. Reject academicYear = 0");
      } else {
        console.error("FAIL: 7. Reject academicYear = 0", e.message);
      }
    }

    // Test 8: Reject academicYear = 5
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollIdErr2}', '${testStudentId}', '${testCohortId}', '${testDeptId}', NULL, 5, 1, false, 'ACTIVE', NOW())
      `);
      console.error("FAIL: 8. Reject academicYear = 5 (Insert succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('academic_year_check') || e.message.includes('23514')) {
        console.log("PASS: 8. Reject academicYear = 5");
      } else {
        console.error("FAIL: 8. Reject academicYear = 5", e.message);
      }
    }

    // Test 9: Reject semester = 0
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollIdErr3}', '${testStudentId}', '${testCohortId}', '${testDeptId}', NULL, 1, 0, false, 'ACTIVE', NOW())
      `);
      console.error("FAIL: 9. Reject semester = 0 (Insert succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('semester_check') || e.message.includes('23514')) {
        console.log("PASS: 9. Reject semester = 0");
      } else {
        console.error("FAIL: 9. Reject semester = 0", e.message);
      }
    }

    // Test 10: Reject semester = 9
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollIdErr4}', '${testStudentId}', '${testCohortId}', '${testDeptId}', NULL, 1, 9, false, 'ACTIVE', NOW())
      `);
      console.error("FAIL: 10. Reject semester = 9 (Insert succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('semester_check') || e.message.includes('23514')) {
        console.log("PASS: 10. Reject semester = 9");
      } else {
        console.error("FAIL: 10. Reject semester = 9", e.message);
      }
    }

    // Test 11: Reject two current enrollments for one student
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollIdErr5}', '${testStudentId}', '${testCohortId}', '${testDeptId}', '${testSectionId}', 1, 3, true, 'ACTIVE', NOW())
      `);
      console.error("FAIL: 11. Reject two current enrollments for one student (Insert succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('student_enrollments_one_current_per_student') || e.message.includes('P2002') || e.message.includes('23505')) {
        console.log("PASS: 11. Reject two current enrollments for one student");
      } else {
        console.error("FAIL: 11. Reject two current enrollments for one student", e.message);
      }
    }

    // Test 12: Allow multiple historical enrollments where isCurrent = false
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollIdHist1}', '${testStudentId}', '${testCohortId}', '${testDeptId}', NULL, 1, 3, false, 'ACTIVE', NOW())
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollIdHist2}', '${testStudentId}', '${testCohortId}', '${testDeptId}', NULL, 1, 4, false, 'ACTIVE', NOW())
      `);
      console.log("PASS: 12. Allow multiple historical enrollments where isCurrent = false");
    } catch (e) {
      console.error("FAIL: 12. Allow multiple historical enrollments where isCurrent = false", e.message);
    }

    // Test 13: Reject using ClassSection with wrong Cohort
    try {
      // Create second cohort
      await prisma.$executeRawUnsafe(`
        INSERT INTO cohorts (id, code, start_year, end_year, status, updated_at)
        VALUES ('${testCohortId2}', 'PHASE3_TEST_2025_2029', 2025, 2029, 'ACTIVE', NOW())
      `);

      const enrollId = "d0000000-0000-0000-0000-000000000008";
      // Sec A is linked to Cohort 1, but we pass Cohort 2 in fields. This must trigger composite key mismatch.
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollId}', '${testStudentId}', '${testCohortId2}', '${testDeptId}', '${testSectionId}', 1, 5, false, 'ACTIVE', NOW())
      `);
      console.error("FAIL: 13. Reject using ClassSection with wrong Cohort (Insert succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('fkey') || e.message.includes('23503') || e.message.includes('P2003')) {
        console.log("PASS: 13. Reject using ClassSection with wrong Cohort");
      } else {
        console.error("FAIL: 13. Reject using ClassSection with wrong Cohort", e.message);
      }
    }

    // Test 14: Reject using ClassSection with wrong Department
    try {
      // Create second department
      await prisma.$executeRawUnsafe(`
        INSERT INTO departments (id, code, name, is_active, updated_at)
        VALUES ('${testDeptId2}', 'PHASE3_TEST_ECE', 'Electronics', true, NOW())
      `);

      const enrollId = "d0000000-0000-0000-0000-000000000009";
      // Sec A is linked to Dept 1, but we pass Dept 2 in fields
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_enrollments (id, student_id, cohort_id, department_id, class_section_id, academic_year, semester, is_current, enrollment_status, updated_at)
        VALUES ('${enrollId}', '${testStudentId}', '${testCohortId}', '${testDeptId2}', '${testSectionId}', 1, 5, false, 'ACTIVE', NOW())
      `);
      console.error("FAIL: 14. Reject using ClassSection with wrong Department (Insert succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('fkey') || e.message.includes('23503') || e.message.includes('P2003')) {
        console.log("PASS: 14. Reject using ClassSection with wrong Department");
      } else {
        console.error("FAIL: 14. Reject using ClassSection with wrong Department", e.message);
      }
    }

    // Test 15: Reject deleting a referenced Cohort (RESTRICT deletion)
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM cohorts WHERE id = '${testCohortId}'
      `);
      console.error("FAIL: 15. Reject deleting referenced Cohort (Delete succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('fkey') || e.message.includes('23503') || e.message.includes('P2003')) {
        console.log("PASS: 15. Reject deleting referenced Cohort");
      } else {
        console.error("FAIL: 15. Reject deleting referenced Cohort", e.message);
      }
    }

    // Test 16: Reject deleting a referenced Department (RESTRICT deletion)
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM departments WHERE id = '${testDeptId}'
      `);
      console.error("FAIL: 16. Reject deleting referenced Department (Delete succeeded but should have failed)");
    } catch (e) {
      if (e.message.includes('fkey') || e.message.includes('23503') || e.message.includes('P2003')) {
        console.log("PASS: 16. Reject deleting referenced Department");
      } else {
        console.error("FAIL: 16. Reject deleting referenced Department", e.message);
      }
    }

    // Test 17: Delete StudentProfile and confirm enrollments cascade
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM student_profiles WHERE id = '${testStudentId}'
      `);
      const remainingEnrollments = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::integer as count FROM student_enrollments WHERE student_id = '${testStudentId}'
      `);
      if (remainingEnrollments[0].count === 0) {
        console.log("PASS: 17. Delete StudentProfile and cascade enrollments");
      } else {
        console.error("FAIL: 17. Cascade delete check failed. Enrollments still exist:", remainingEnrollments);
      }
    } catch (e) {
      console.error("FAIL: 17. Cascade delete execution failed:", e.message);
    }

    // Test 18: Confirm Cohort, Department, and ClassSection remain after student deletion
    try {
      const cohortExists = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM cohorts WHERE id = '${testCohortId}'`);
      const deptExists = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM departments WHERE id = '${testDeptId}'`);
      const secExists = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM class_sections WHERE id = '${testSectionId}'`);

      if (cohortExists[0].count === 1 && deptExists[0].count === 1 && secExists[0].count === 1) {
        console.log("PASS: 18. Confirm Cohort, Department and ClassSection remain after student deletion");
      } else {
        console.error("FAIL: 18. Leftover models check failed.", cohortExists, deptExists, secExists);
      }
    } catch (e) {
      console.error("FAIL: 18. Leftover check execution failed:", e.message);
    }

    // Test 19: Confirm an unrelated existing Prisma model can still be created or queried
    try {
      const auditLog = await prisma.auditLog.create({
        data: {
          action: "PHASE3_TEST_AUDIT_ACTION",
          targetType: "TEST",
          targetId: "TEST_1",
          metadata: { details: "Validation test event" }
        }
      });
      const queried = await prisma.auditLog.findUnique({ where: { id: auditLog.id } });
      if (queried && queried.action === "PHASE3_TEST_AUDIT_ACTION") {
        console.log("PASS: 19. Confirm unrelated model (AuditLog) works");
        await prisma.auditLog.delete({ where: { id: auditLog.id } });
      } else {
        console.error("FAIL: 19. Unrelated model check query failed.");
      }
    } catch (e) {
      console.error("FAIL: 19. Unrelated model check failed:", e.message);
    }

    // Test 20: Confirm zero real student data exists in the temporary database
    try {
      const realStudentsCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::integer as count FROM student_profiles WHERE name NOT LIKE 'PHASE3_TEST_%'
      `);
      if (realStudentsCount[0].count === 0) {
        console.log("PASS: 20. Confirm zero real student data exists in the temporary database");
      } else {
        console.warn(`WARNING: 20. Detected ${realStudentsCount[0].count} student profile records in the test database. Ensure this is indeed a test environment!`);
      }
    } catch (e) {
      console.error("FAIL: 20. Real data search failed:", e.message);
    }

  } finally {
    // 8. CLEANUP BLOCK
    console.log("\n=== Executing Data Cleanup ===");
    try {
      // Deletions in correct order of dependency using explicit UUID keys
      await prisma.$executeRawUnsafe(`DELETE FROM student_enrollments WHERE id IN (
        '${enrollId1}', '${enrollId2}', '${enrollIdErr1}', '${enrollIdErr2}', '${enrollIdErr3}',
        '${enrollIdErr4}', '${enrollIdErr5}', '${enrollIdHist1}', '${enrollIdHist2}',
        'd0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000009'
      )`);
      await prisma.$executeRawUnsafe(`DELETE FROM class_sections WHERE id = '${testSectionId}'::uuid`);
      await prisma.$executeRawUnsafe(`DELETE FROM departments WHERE id IN ('${testDeptId}'::uuid, '${testDeptId2}'::uuid)`);
      await prisma.$executeRawUnsafe(`DELETE FROM cohorts WHERE id IN ('${testCohortId}'::uuid, '${testCohortId2}'::uuid)`);
      await prisma.$executeRawUnsafe(`DELETE FROM student_profiles WHERE id = '${testStudentId}'`);

      // Verify zero remains using type-cast queries
      const enrollRemains = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM student_enrollments WHERE id IN (
        'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004',
        'd0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000006',
        'd0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000008',
        'd0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000010',
        'd0000000-0000-0000-0000-000000000011'
      )`);
      const classRemains = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM class_sections WHERE id = '${testSectionId}'`);
      const deptRemains = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM departments WHERE id IN ('${testDeptId}', '${testDeptId2}')`);
      const cohRemains = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM cohorts WHERE id IN ('${testCohortId}', '${testCohortId2}')`);
      const stuRemains = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::integer as count FROM student_profiles WHERE id = '${testStudentId}'`);

      const totalRemains = enrollRemains[0].count + classRemains[0].count + deptRemains[0].count + cohRemains[0].count + stuRemains[0].count;

      if (totalRemains === 0) {
        console.log("PASS: Cleanup complete. Zero PHASE3_TEST records remain.");
      } else {
        console.error("FAIL: Cleanup incomplete. Remaining records detected.", {
          enroll: enrollRemains[0].count,
          class: classRemains[0].count,
          dept: deptRemains[0].count,
          coh: cohRemains[0].count,
          stu: stuRemains[0].count
        });
      }
    } catch (e) {
      console.error("ERROR running cleanup: ", e.message);
    }

    await prisma.$disconnect();
    console.log("\nPhase 3 Database Constraint Verification complete.");
  }
}

runTests().catch(err => {
  console.error("Unhandled error: ", err);
  process.exit(1);
});
