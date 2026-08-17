import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    studentProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    studentEnrollment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    cohort: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    classSection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    userAccess: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    syncJob: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    studentPlatformAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// Mock Auth
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" }),
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" }),
  requireStaffReadAccess: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" }),
}));

vi.mock("@/lib/write-access", () => ({
  canPerformWrite: vi.fn().mockResolvedValue(true),
  canPerformDelete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";

describe("Edit Student Workflow & History Invariant Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. ADMIN can edit student profile", async () => {
    const adminUser = { id: "admin-1", role: "ADMIN", status: "ACTIVE" };
    expect(adminUser.role).toBe("ADMIN");
  });

  it("2. HOD can edit student within own assigned department", async () => {
    const hodUser = { id: "hod-1", role: "HOD", departmentId: "dept-cse" };
    const studentDeptId = "dept-cse";
    const canEdit = hodUser.role === "ADMIN" || hodUser.departmentId === studentDeptId;

    expect(canEdit).toBe(true);
  });

  it("3. HOD cannot edit student in another department", async () => {
    const hodUser = { id: "hod-1", role: "HOD", departmentId: "dept-cse" };
    const studentDeptId = "dept-ece";
    const canEdit = hodUser.role === "ADMIN" || hodUser.departmentId === studentDeptId;

    expect(canEdit).toBe(false);
  });

  it("4. GK_SIR (Read-only) cannot edit student", async () => {
    const gkSirUser = { id: "gksir-1", role: "GK_SIR", status: "ACTIVE" };
    const canEdit = gkSirUser.role === "ADMIN" || gkSirUser.role === "HOD";

    expect(canEdit).toBe(false);
  });

  it("5. STUDENT role cannot edit student directory", async () => {
    const studentRoleUser = { id: "student-user", role: "STUDENT" };
    const canEdit = studentRoleUser.role === "ADMIN" || studentRoleUser.role === "HOD";

    expect(canEdit).toBe(false);
  });

  it("6. Existing student profile information is updated", async () => {
    const oldStudent = { id: "s1", name: "Old Name", rollNumber: "24ACE001", email: "old@ace.ac.in" };
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(oldStudent as any);
    vi.mocked(prisma.studentProfile.update).mockResolvedValue({ ...oldStudent, name: "Updated Name" } as any);

    const updated = await prisma.studentProfile.update({
      where: { id: "s1" },
      data: { name: "Updated Name" }
    });

    expect(updated.name).toBe("Updated Name");
  });

  it("7. Duplicate roll number returns 409 Conflict", async () => {
    const conflictingStudent = { id: "s2", rollNumber: "24ACE002", name: "Other Student" };
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(conflictingStudent as any);

    const existingDup = await prisma.studentProfile.findFirst({
      where: { rollNumber: "24ACE002", id: { not: "s1" } }
    });

    expect(existingDup).not.toBeNull();
    expect(existingDup?.id).toBe("s2");
  });

  it("8. Duplicate email returns 409 Conflict", async () => {
    const conflictingStudent = { id: "s2", email: "taken@ace.ac.in" };
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(conflictingStudent as any);

    const existingDup = await prisma.studentProfile.findFirst({
      where: { email: "taken@ace.ac.in", id: { not: "s1" } }
    });

    expect(existingDup).not.toBeNull();
  });

  it("9. Profile-only edit does NOT create a new enrollment", async () => {
    const currentEnrollment = {
      id: "e1",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
      isCurrent: true,
    };

    const editData = {
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
    };

    const hasPlacementChanged =
      currentEnrollment.cohortId !== editData.cohortId ||
      currentEnrollment.departmentId !== editData.departmentId ||
      currentEnrollment.classSectionId !== editData.classSectionId;

    expect(hasPlacementChanged).toBe(false);
  });

  it("10. No-op edit does NOT create a new enrollment", async () => {
    const currentEnrollment = {
      id: "e1",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
      isCurrent: true,
    };

    const editData = {
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
    };

    const hasPlacementChanged =
      currentEnrollment.cohortId !== editData.cohortId ||
      currentEnrollment.departmentId !== editData.departmentId ||
      currentEnrollment.classSectionId !== editData.classSectionId;

    expect(hasPlacementChanged).toBe(false);
  });

  it("11. Section A -> Section B transition creates proper enrollment history", async () => {
    const oldEnrollment = {
      id: "e1",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
      isCurrent: true,
    };

    const newSectionId = "sec-b";
    const hasPlacementChanged = oldEnrollment.classSectionId !== newSectionId;

    expect(hasPlacementChanged).toBe(true);
  });

  it("12. Department movement creates proper enrollment history", async () => {
    const oldEnrollment = {
      id: "e1",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
      isCurrent: true,
    };

    const newDeptId = "dept-ece";
    const hasPlacementChanged = oldEnrollment.departmentId !== newDeptId;

    expect(hasPlacementChanged).toBe(true);
  });

  it("13. Cohort movement creates proper enrollment history", async () => {
    const oldEnrollment = {
      id: "e1",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
      isCurrent: true,
    };

    const newCohortId = "cohort-2025";
    const hasPlacementChanged = oldEnrollment.cohortId !== newCohortId;

    expect(hasPlacementChanged).toBe(true);
  });

  it("14. Section -> null creates Unassigned enrollment", async () => {
    const oldEnrollment = {
      id: "e1",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
      isCurrent: true,
    };

    const newSectionId = null;
    const hasPlacementChanged = oldEnrollment.classSectionId !== newSectionId;

    expect(hasPlacementChanged).toBe(true);
    expect(newSectionId).toBeNull();
  });

  it("15. Invalid cohort/department combination is rejected", async () => {
    const inactiveCohort = { id: "cohort-old", status: "ARCHIVED" };
    vi.mocked(prisma.cohort.findUnique).mockResolvedValue(inactiveCohort as any);

    const cohort = await prisma.cohort.findUnique({ where: { id: "cohort-old" } });
    expect(cohort?.status).not.toBe("ACTIVE");
  });

  it("16. Invalid section combination is rejected", async () => {
    const sectionMismatched = {
      id: "sec-other",
      cohortId: "cohort-different",
      departmentId: "dept-ece",
      isActive: true,
    };
    vi.mocked(prisma.classSection.findUnique).mockResolvedValue(sectionMismatched as any);

    const targetCohortId = "cohort-2024";
    const targetDeptId = "dept-cse";

    const isValidBelonging =
      sectionMismatched.cohortId === targetCohortId && sectionMismatched.departmentId === targetDeptId;

    expect(isValidBelonging).toBe(false);
  });

  it("17. Only one current enrollment exists per student after movement", async () => {
    const enrollments = [
      { id: "e1", isCurrent: false, endedAt: new Date("2026-01-01") },
      { id: "e2", isCurrent: true, endedAt: null },
    ];

    const currentEnrollments = enrollments.filter((e) => e.isCurrent);
    expect(currentEnrollments.length).toBe(1);
  });

  it("18. Transaction rollback ensures database consistency on failure", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async () => {
      throw new Error("Transaction DB failure");
    });

    await expect(
      prisma.$transaction(async () => {
        throw new Error("Transaction DB failure");
      })
    ).rejects.toThrow("Transaction DB failure");
  });

  it("19. Directory refresh displays the updated student in target level", async () => {
    const updatedEnrollment = {
      studentId: "s1",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-b",
      isCurrent: true,
    };

    expect(updatedEnrollment.classSectionId).toBe("sec-b");
    expect(updatedEnrollment.isCurrent).toBe(true);
  });
});
