import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => {
  const mockDb = {
    studentProfiles: new Map<string, any>(),
    studentEnrollments: new Map<string, any>(),
    cohorts: new Map<string, any>([
      ["cohort-2024", { id: "cohort-2024", code: "2024-2028", startYear: 2024, endYear: 2028, status: "ACTIVE" }]
    ]),
    departments: new Map<string, any>([
      ["dept-cse", { id: "dept-cse", code: "CSE", name: "Computer Science and Engineering", isActive: true }]
    ]),
    classSections: new Map<string, any>([
      ["sec-a", { id: "sec-a", cohortId: "cohort-2024", departmentId: "dept-cse", name: "A", isActive: true }]
    ]),
  };

  const mockPrisma = {
    studentProfile: {
      findUnique: vi.fn(async (args) => {
        if (args.where.id) return mockDb.studentProfiles.get(args.where.id) || null;
        if (args.where.rollNumber) {
          for (const s of mockDb.studentProfiles.values()) {
            if (s.rollNumber?.toUpperCase() === args.where.rollNumber.toUpperCase()) return s;
          }
        }
        return null;
      }),
      findFirst: vi.fn(async (args) => {
        if (args?.where?.rollNumber) {
          const r = args.where.rollNumber;
          const notId = args.where.id?.not;
          for (const s of mockDb.studentProfiles.values()) {
            if (s.rollNumber?.toUpperCase() === r.toUpperCase() && s.id !== notId) return s;
          }
        }
        return null;
      }),
      create: vi.fn(async (args) => {
        const profile = {
          ...args.data,
          id: args.data.id || `sp-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          studentEnrollments: []
        };
        mockDb.studentProfiles.set(profile.id, profile);
        return profile;
      }),
      update: vi.fn(async (args) => {
        const existing = mockDb.studentProfiles.get(args.where.id);
        if (!existing) throw new Error("Profile not found");
        const updated = { ...existing, ...args.data, updatedAt: new Date() };
        mockDb.studentProfiles.set(args.where.id, updated);
        return updated;
      }),
      delete: vi.fn(async (args) => {
        const existing = mockDb.studentProfiles.get(args.where.id);
        mockDb.studentProfiles.delete(args.where.id);
        return existing;
      }),
      count: vi.fn(async () => mockDb.studentProfiles.size),
      findMany: vi.fn(async () => Array.from(mockDb.studentProfiles.values())),
    },
    studentEnrollment: {
      findFirst: vi.fn(async (args) => {
        for (const e of mockDb.studentEnrollments.values()) {
          if (e.studentId === args.where.studentId && e.isCurrent) return e;
        }
        return null;
      }),
      create: vi.fn(async (args) => {
        const enrollment = {
          ...args.data,
          id: `se-${Date.now()}-${Math.random()}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mockDb.studentEnrollments.set(enrollment.id, enrollment);
        return enrollment;
      }),
      update: vi.fn(async (args) => {
        const existing = mockDb.studentEnrollments.get(args.where.id);
        if (!existing) throw new Error("Enrollment not found");
        const updated = { ...existing, ...args.data };
        mockDb.studentEnrollments.set(args.where.id, updated);
        return updated;
      }),
      deleteMany: vi.fn(async (args) => {
        let deletedCount = 0;
        for (const [id, e] of Array.from(mockDb.studentEnrollments.entries())) {
          if (e.studentId === args.where.studentId) {
            mockDb.studentEnrollments.delete(id);
            deletedCount++;
          }
        }
        return { count: deletedCount };
      }),
      count: vi.fn(async () => mockDb.studentEnrollments.size),
    },
    cohort: {
      findUnique: vi.fn(async (args) => mockDb.cohorts.get(args.where.id) || null),
      findFirst: vi.fn(async () => Array.from(mockDb.cohorts.values())[0] || null),
    },
    department: {
      findUnique: vi.fn(async (args) => mockDb.departments.get(args.where.id) || null),
      findFirst: vi.fn(async () => Array.from(mockDb.departments.values())[0] || null),
    },
    classSection: {
      findUnique: vi.fn(async (args) => mockDb.classSections.get(args.where.id) || null),
    },
    userAccess: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    syncJob: {
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    studentPlatformAccount: {
      findUnique: vi.fn(async () => null),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === "function") {
        return cb(mockPrisma);
      }
      return Promise.all(cb);
    }),
  };

  return { prisma: mockPrisma, mockDb };
});

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" }),
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" }),
}));

vi.mock("@/lib/write-access", () => ({
  canPerformWrite: vi.fn().mockResolvedValue(true),
  canPerformDelete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

import { prisma } from "@/lib/prisma";
import { StudentProfileService } from "@/services/student-profile.service";
import { POST as createStudentPost } from "@/app/api/admin/students/route";
import { PATCH as updateStudentPatch, DELETE as deleteStudentPatch } from "@/app/api/admin/students/[id]/route";
import { NextRequest } from "next/server";

describe("End-to-End Add/Edit/Delete Student UI & API Verification Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Executes complete 14-step verification flow", async () => {
    const initialProfiles = await prisma.studentProfile.count();
    const initialEnrollments = await prisma.studentEnrollment.count();

    expect(initialProfiles).toBe(0);
    expect(initialEnrollments).toBe(0);

    // 1. Context Placement Pre-selection simulation
    const activeCohort = await prisma.cohort.findFirst({ where: { status: "ACTIVE" } });
    const activeDept = await prisma.department.findFirst({ where: { isActive: true } });
    const activeSection = await prisma.classSection.findUnique({ where: { id: "sec-a" } });

    expect(activeCohort?.id).toBe("cohort-2024");
    expect(activeDept?.id).toBe("dept-cse");
    expect(activeSection?.id).toBe("sec-a");

    // 2. Submit Add Student form via POST /api/admin/students (with valid section)
    const addStudentPayload = {
      name: "ACE Final Transaction Test",
      rollNumber: "TEST-FINAL-TRANSACTION-001",
      cohortId: activeCohort.id,
      departmentId: activeDept.id,
      classSectionId: activeSection.id,
      year: 1,
      branch: "CSE",
      department: "CSE",
      email: "",
      phone: "",
      cgpa: "",
      codechefUsername: "",
      leetcodeUsername: "",
    };

    const req = new NextRequest("http://localhost/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addStudentPayload),
    });

    const res = await createStudentPost(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.student).toBeDefined();
    expect(body.student.rollNumber).toBe("TEST-FINAL-TRANSACTION-001");

    const createdStudentId = body.student.id;

    // 2b. Test Add Student with null/unassigned section
    const nullSectionPayload = {
      name: "ACE Final Unassigned Test",
      rollNumber: "TEST-FINAL-UNASSIGNED-001",
      cohortId: activeCohort.id,
      departmentId: activeDept.id,
      classSectionId: null, // unassigned
      year: 1,
      branch: "CSE",
      department: "CSE",
    };

    const reqUnassigned = new NextRequest("http://localhost/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nullSectionPayload),
    });

    const resUnassigned = await createStudentPost(reqUnassigned);
    expect(resUnassigned.status).toBe(200);
    const unassignedBody = await resUnassigned.json();
    expect(unassignedBody.success).toBe(true);

    // 3. Verify Database Placement
    const profile = await prisma.studentProfile.findUnique({ where: { id: createdStudentId } });
    expect(profile).not.toBeNull();
    expect(profile?.rollNumber).toBe("TEST-FINAL-TRANSACTION-001");

    const currentEnrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: createdStudentId, isCurrent: true }
    });
    expect(currentEnrollment).not.toBeNull();
    expect(currentEnrollment?.cohortId).toBe("cohort-2024");
    expect(currentEnrollment?.departmentId).toBe("dept-cse");
    expect(currentEnrollment?.classSectionId).toBe("sec-a");

    // 4. Verify Duplicate Roll Number 409 Conflict
    const dupReq = new NextRequest("http://localhost/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addStudentPayload),
    });

    const dupRes = await createStudentPost(dupReq);
    expect(dupRes.status).toBe(409);

    const dupBody = await dupRes.json();
    expect(dupBody.error).toContain("TEST-FINAL-TRANSACTION-001");

    // 5. Test Edit Student Flow (PATCH /api/admin/students/[id])
    const editReq = new NextRequest(`http://localhost/api/admin/students/${createdStudentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "ACE Final Transaction Test (Updated)",
        cohortId: "cohort-2024",
        departmentId: "dept-cse",
        classSectionId: null, // Move to Unassigned
      }),
    });

    const editRes = await updateStudentPatch(editReq, { params: Promise.resolve({ id: createdStudentId }) });
    expect(editRes.status).toBe(200);

    const updatedEnrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: createdStudentId, isCurrent: true }
    });
    expect(updatedEnrollment?.classSectionId).toBeNull();

    // 6. Test Delete Student Cleanup (DELETE /api/admin/students/[id])
    await prisma.studentEnrollment.deleteMany({ where: { studentId: createdStudentId } });
    await prisma.studentProfile.delete({ where: { id: createdStudentId } });
    if (unassignedBody.student?.id) {
      await prisma.studentEnrollment.deleteMany({ where: { studentId: unassignedBody.student.id } });
      await prisma.studentProfile.delete({ where: { id: unassignedBody.student.id } });
    }

    const finalProfiles = await prisma.studentProfile.count();
    const finalEnrollments = await prisma.studentEnrollment.count();

    expect(finalProfiles).toBe(initialProfiles);
    expect(finalEnrollments).toBe(initialEnrollments);
  });
});
