import { describe, test, expect, beforeEach, vi } from "vitest";
import { StudentProfileService } from "@/services/student-profile.service";
import { POST as bulkDeleteStudents } from "@/app/api/admin/students/bulk-delete/route";
import { DELETE as deleteStudent } from "@/app/api/admin/students/[id]/route";
import { NextRequest } from "next/server";

// Global in-memory DB collections
let dbProfiles: Map<string, any>;
let dbEnrollments: Map<string, any>;
let dbUserAccess: Map<string, any>;
let dbCohorts: Map<string, any>;
let dbDepartments: Map<string, any>;
let dbClassSections: Map<string, any>;

let mockTx: any;

// Mock requireAdmin to simulate authorized ADMIN session
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@aceec.ac.in",
    canDeleteStudents: true,
  }),
}));

// Mock recordAuditEvent to record audit events safely while preserving AuditAction enum
vi.mock("@/services/audit.service", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    recordAuditEvent: vi.fn().mockResolvedValue(true),
  };
});

// Mock Supabase admin auth client to prevent external network calls
vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-id-mock" } }, error: null }),
      },
    },
  }),
}));

// Mock prisma for API route deletion handlers
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (cb: any) => cb(mockTx),
    $executeRawUnsafe: async () => 0,
    studentProfile: {
      findUnique: async (...args: any[]) => mockTx.studentProfile.findUnique(...args),
      delete: async (...args: any[]) => mockTx.studentProfile.delete(...args),
    },
    studentEnrollment: {
      deleteMany: async (...args: any[]) => mockTx.studentEnrollment.deleteMany(...args),
    },
    userAccess: {
      deleteMany: async (...args: any[]) => mockTx.userAccess.deleteMany(...args),
    },
    syncJob: { deleteMany: async () => ({ count: 0 }) },
    leaderboardEntry: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    codechefProfile: { deleteMany: async () => ({ count: 0 }) },
    leetcodeProfile: { deleteMany: async () => ({ count: 0 }) },
    githubProfile: { deleteMany: async () => ({ count: 0 }) },
    aiAnalysis: { deleteMany: async () => ({ count: 0 }) },
    syncLog: { deleteMany: async () => ({ count: 0 }) },
    activityLog: { deleteMany: async () => ({ count: 0 }) },
    normalizedProfile: { deleteMany: async () => ({ count: 0 }) },
    studentPlatformAccount: { deleteMany: async () => ({ count: 0 }) },
    contestParticipation: { deleteMany: async () => ({ count: 0 }) },
  },
}));

describe("Student Add, Rewrite, Login Preservation & Bulk Delete E2E UI & API Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dbProfiles = new Map();
    dbEnrollments = new Map();
    dbUserAccess = new Map();
    dbCohorts = new Map([["c-1", { id: "c-1", code: "2023-2027", status: "ACTIVE" }]]);
    dbDepartments = new Map([
      ["d-1", { id: "d-1", code: "CSE", name: "CSE", isActive: true }],
      ["d-2", { id: "d-2", code: "ECE", name: "ECE", isActive: true }],
    ]);
    dbClassSections = new Map([
      ["s-1", { id: "s-1", cohortId: "c-1", departmentId: "d-1", name: "A", isActive: true }],
    ]);

    mockTx = {
      _isTransaction: true,
      $executeRawUnsafe: async () => 0,
      studentProfile: {
        findUnique: async ({ where }: any) => {
          if (where.rollNumber) {
            for (const p of dbProfiles.values()) {
              if (p.rollNumber.toUpperCase() === where.rollNumber.toUpperCase()) {
                const currentE = Array.from(dbEnrollments.values()).filter(
                  (e) => e.studentId === p.id && e.isCurrent
                );
                const ua = dbUserAccess.get(p.id);
                return { ...p, studentEnrollments: currentE, userAccess: ua };
              }
            }
          }
          if (where.id) {
            const p = dbProfiles.get(where.id);
            if (p) {
              const currentE = Array.from(dbEnrollments.values()).filter(
                (e) => e.studentId === p.id && e.isCurrent
              );
              const ua = dbUserAccess.get(p.id);
              return { ...p, studentEnrollments: currentE, userAccess: ua };
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = data.id || "prof-" + data.rollNumber;
          const record = { ...data, id };
          dbProfiles.set(id, record);
          return record;
        },
        update: async ({ where, data }: any) => {
          const record = dbProfiles.get(where.id);
          if (!record) throw new Error("Record not found");
          const updated = { ...record, ...data };
          dbProfiles.set(where.id, updated);
          return updated;
        },
        delete: async ({ where }: any) => {
          const record = dbProfiles.get(where.id);
          dbProfiles.delete(where.id);
          return record;
        },
      },
      studentEnrollment: {
        findFirst: async ({ where }: any) => {
          for (const e of dbEnrollments.values()) {
            if (e.studentId === where.studentId && e.isCurrent === where.isCurrent) {
              return e;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = "enr-" + Math.random().toString(36).slice(2);
          const record = { ...data, id };
          dbEnrollments.set(id, record);
          return record;
        },
        update: async ({ where, data }: any) => {
          const record = dbEnrollments.get(where.id);
          if (!record) throw new Error("Enrollment not found");
          const updated = { ...record, ...data };
          dbEnrollments.set(where.id, updated);
          return updated;
        },
        deleteMany: async ({ where }: any) => {
          let count = 0;
          for (const [id, e] of Array.from(dbEnrollments.entries())) {
            if (e.studentId === where.studentId) {
              dbEnrollments.delete(id);
              count++;
            }
          }
          return { count };
        },
      },
      userAccess: {
        findUnique: async ({ where }: any) => {
          if (where.studentProfileId) return dbUserAccess.get(where.studentProfileId) || null;
          if (where.loginId) {
            for (const u of dbUserAccess.values()) {
              if (u.loginId === where.loginId) return u;
            }
          }
          return null;
        },
        findFirst: async ({ where }: any) => {
          for (const u of dbUserAccess.values()) {
            if (u.studentProfileId === where.studentProfileId || u.loginId === where.loginId) {
              return u;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = "ua-" + (data.studentProfileId || Math.random().toString(36).slice(2));
          const record = { ...data, id };
          dbUserAccess.set(data.studentProfileId || id, record);
          return record;
        },
        update: async ({ where, data }: any) => {
          let targetKey: string | null = null;
          if (where.id) {
            for (const [key, u] of dbUserAccess.entries()) {
              if (u.id === where.id) {
                targetKey = key;
                break;
              }
            }
          } else if (where.studentProfileId) {
            targetKey = where.studentProfileId;
          }

          const record = targetKey ? dbUserAccess.get(targetKey) : null;
          if (!record) throw new Error("UserAccess not found");
          const updated = { ...record, ...data };
          dbUserAccess.set(targetKey!, updated);
          return updated;
        },
        upsert: async ({ where, create, update }: any) => {
          const key = where.studentProfileId || create.studentProfileId;
          const existing = dbUserAccess.get(key);
          if (existing) {
            const updated = { ...existing, ...update };
            dbUserAccess.set(key, updated);
            return updated;
          } else {
            const id = "ua-" + key;
            const created = { ...create, id };
            dbUserAccess.set(key, created);
            return created;
          }
        },
        deleteMany: async ({ where }: any) => {
          let count = 0;
          for (const [id, u] of Array.from(dbUserAccess.entries())) {
            if (u.studentProfileId === where.studentProfileId) {
              dbUserAccess.delete(id);
              count++;
            }
          }
          return { count };
        },
      },
      cohort: {
        findUnique: async ({ where }: any) => dbCohorts.get(where.id || where.code) || null,
      },
      department: {
        findUnique: async ({ where }: any) => dbDepartments.get(where.id || where.code) || null,
      },
      classSection: {
        findUnique: async ({ where }: any) => dbClassSections.get(where.id) || null,
      },
      syncJob: { deleteMany: async () => ({ count: 0 }) },
      leaderboardEntry: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
      codechefProfile: { deleteMany: async () => ({ count: 0 }) },
      leetcodeProfile: { deleteMany: async () => ({ count: 0 }) },
      githubProfile: { deleteMany: async () => ({ count: 0 }) },
      aiAnalysis: { deleteMany: async () => ({ count: 0 }) },
      syncLog: { deleteMany: async () => ({ count: 0 }) },
      activityLog: { deleteMany: async () => ({ count: 0 }) },
      normalizedProfile: { deleteMany: async () => ({ count: 0 }) },
      studentPlatformAccount: { deleteMany: async () => ({ count: 0 }) },
      contestParticipation: { deleteMany: async () => ({ count: 0 }) },
    };
  });

  test("TEST 1 — Create Student with Normalized Roll & Account Defaults", async () => {
    const payload = {
      rollNumber: " 24ag1a0599 ", // Raw input with spaces & lowercase
      name: "Test Student 1",
      email: "test1@aceec.ac.in",
      contactNumber: "9876543210",
      cohortId: "c-1",
      departmentId: "d-1",
      classSectionId: "s-1",
      year: 1,
      cgpa: 8.5,
    };

    const result = await StudentProfileService.upsertSingleStudent(payload, mockTx);

    expect(result.success).toBe(true);
    expect(result.isNew).toBe(true);
    expect(result.message).toBe("Student profile created successfully.");

    // Verify 1 StudentProfile created with normalized roll
    expect(dbProfiles.size).toBe(1);
    const profile = Array.from(dbProfiles.values())[0];
    expect(profile.rollNumber).toBe("24AG1A0599");
    expect(profile.name).toBe("Test Student 1");

    // Verify 1 StudentEnrollment created (active)
    expect(dbEnrollments.size).toBe(1);
    const enrollment = Array.from(dbEnrollments.values())[0];
    expect(enrollment.studentId).toBe(profile.id);
    expect(enrollment.cohortId).toBe("c-1");
    expect(enrollment.departmentId).toBe("d-1");
    expect(enrollment.classSectionId).toBe("s-1");
    expect(enrollment.isCurrent).toBe(true);

    // Verify 1 UserAccess student login account created
    expect(dbUserAccess.size).toBe(1);
    const access = Array.from(dbUserAccess.values())[0];
    expect(access.loginId).toBe("24AG1A0599");
    expect(access.mustSetPassword).toBe(true);
  });

  test("TEST 2 — Rewrite Existing Student (Full Replacement, Single Profile & Preserved Auth)", async () => {
    // 1. Initial creation
    const initialPayload = {
      rollNumber: "24AG1A0599",
      name: "Test Student 1 Original",
      email: "test1_orig@aceec.ac.in",
      contactNumber: "9000000001",
      cohortId: "c-1",
      departmentId: "d-1",
      classSectionId: "s-1",
    };
    await StudentProfileService.upsertSingleStudent(initialPayload, mockTx);

    // Simulate password change by student
    const profileId = Array.from(dbProfiles.values())[0].id;
    const existingAccess = dbUserAccess.get(profileId);
    existingAccess.passwordHash = "$2a$10$CustomHashedPasswordForStudent";
    existingAccess.mustSetPassword = false;

    // 2. Submit same roll number with updated profile info
    const rewritePayload = {
      rollNumber: "24AG1A0599",
      name: "Test Student 1 Rewritten",
      email: "test1_rewritten@aceec.ac.in",
      contactNumber: "9999988888",
      cgpa: 9.8,
      cohortId: "c-1",
      departmentId: "d-1",
      classSectionId: "s-1",
    };

    const rewriteResult = await StudentProfileService.upsertSingleStudent(rewritePayload, mockTx);

    expect(rewriteResult.success).toBe(true);
    expect(rewriteResult.isNew).toBe(false);
    expect(rewriteResult.message).toBe("Student already exists. Profile updated successfully.");

    // Verify exact counts remain 1
    expect(dbProfiles.size).toBe(1);
    expect(dbUserAccess.size).toBe(1);

    // Verify profile updated
    const updatedProfile = Array.from(dbProfiles.values())[0];
    expect(updatedProfile.name).toBe("Test Student 1 Rewritten");
    expect(updatedProfile.email).toBe("test1_rewritten@aceec.ac.in");
    expect(updatedProfile.contactNumber).toBe("9999988888");
    expect(updatedProfile.cgpa).toBe(9.8);

    // Verify authentication preserved
    const preservedAccess = Array.from(dbUserAccess.values())[0];
    expect(preservedAccess.passwordHash).toBe("$2a$10$CustomHashedPasswordForStudent");
    expect(preservedAccess.mustSetPassword).toBe(false);
  });

  test("TEST 3 — Academic Placement Rewrite (Department & Section Transition + NULL Section)", async () => {
    // 1. Initial creation (CSE - Section A)
    await StudentProfileService.upsertSingleStudent(
      {
        rollNumber: "24AG1A0599",
        name: "Academic Test Student",
        cohortId: "c-1",
        departmentId: "d-1", // CSE
        classSectionId: "s-1", // Section A
      },
      mockTx
    );

    expect(dbEnrollments.size).toBe(1);

    // 2. Change placement to ECE (d-2) with NULL section
    const placementChangeResult = await StudentProfileService.upsertSingleStudent(
      {
        rollNumber: "24AG1A0599",
        name: "Academic Test Student",
        cohortId: "c-1",
        departmentId: "d-2", // ECE
        classSectionId: null, // Unassigned Section
      },
      mockTx
    );

    expect(placementChangeResult.isNew).toBe(false);

    // Verify history preserved: 2 enrollments in total
    expect(dbEnrollments.size).toBe(2);

    const enrollments = Array.from(dbEnrollments.values());
    const oldEnrollment = enrollments.find((e) => e.departmentId === "d-1");
    const newEnrollment = enrollments.find((e) => e.departmentId === "d-2");

    expect(oldEnrollment.isCurrent).toBe(false);
    expect(newEnrollment.isCurrent).toBe(true);
    expect(newEnrollment.classSectionId).toBeNull();
  });

  test("TEST 4 — Student Login Preservation (UserAccess Account Stability)", async () => {
    // Create initial profile
    await StudentProfileService.upsertSingleStudent(
      { rollNumber: "24AG1A0599", name: "Login Test", cohortId: "c-1", departmentId: "d-1" },
      mockTx
    );

    const initialUserAccessId = Array.from(dbUserAccess.values())[0].id;
    const initialLoginId = Array.from(dbUserAccess.values())[0].loginId;

    // Rewrite 3 times
    for (let i = 1; i <= 3; i++) {
      await StudentProfileService.upsertSingleStudent(
        { rollNumber: "24AG1A0599", name: `Login Test Rewrite ${i}`, cohortId: "c-1", departmentId: "d-1" },
        mockTx
      );
    }

    expect(dbUserAccess.size).toBe(1);
    const currentUserAccess = Array.from(dbUserAccess.values())[0];
    expect(currentUserAccess.id).toBe(initialUserAccessId);
    expect(currentUserAccess.loginId).toBe(initialLoginId);
  });

  test("TEST 5 & 6 — Single & Bulk Delete Operations with Dependency Cleanup", async () => {
    // Create 3 temporary test students
    const s1 = await StudentProfileService.upsertSingleStudent(
      { rollNumber: "TEST99A0001", name: "Temp 1", cohortId: "c-1", departmentId: "d-1" },
      mockTx
    );
    const s2 = await StudentProfileService.upsertSingleStudent(
      { rollNumber: "TEST99A0002", name: "Temp 2", cohortId: "c-1", departmentId: "d-1" },
      mockTx
    );
    const s3 = await StudentProfileService.upsertSingleStudent(
      { rollNumber: "TEST99A0003", name: "Temp 3", cohortId: "c-1", departmentId: "d-1" },
      mockTx
    );

    expect(dbProfiles.size).toBe(3);

    // TEST 5: Bulk delete TEST99A0002 & TEST99A0003
    const bulkReq = new NextRequest("http://localhost/api/admin/students/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds: [s2.profile.id, s3.profile.id],
        confirmString: "DELETE 2 STUDENTS",
        confirmCheckbox: true,
        reason: "Imported by mistake",
      }),
    });

    const bulkRes = await bulkDeleteStudents(bulkReq);
    expect(bulkRes.status).toBe(200);
    const bulkData = await bulkRes.json();
    expect(bulkData.success).toBe(true);
    expect(bulkData.deleted).toBe(2);

    expect(dbProfiles.size).toBe(1);
    expect(dbProfiles.has(s2.profile.id)).toBe(false);
    expect(dbProfiles.has(s3.profile.id)).toBe(false);

    // TEST 6: Single delete TEST99A0001
    const singleReq = new NextRequest(`http://localhost/api/admin/students/${s1.profile.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: "DELETE",
        reason: "Duplicate entry",
      }),
    });

    const singleRes = await deleteStudent(singleReq, { params: Promise.resolve({ id: s1.profile.id }) });
    expect(singleRes.status).toBe(200);

    // POST-TEST CLEANUP VERIFICATION
    expect(dbProfiles.size).toBe(0);
    expect(dbEnrollments.size).toBe(0);
    expect(dbUserAccess.size).toBe(0);
  });
});
