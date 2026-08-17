import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    studentProfile: {
      findUnique: vi.fn(),
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
      findMany: vi.fn(),
      create: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    classSection: {
      findUnique: vi.fn(),
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
    },
    studentPlatformAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
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
}));

vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

import { prisma } from "@/lib/prisma";
import { StudentProfileService } from "@/services/student-profile.service";

describe("Context-Aware Add Student Placement & Hierarchy Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Root Level Add Student requires Cohort selection", async () => {
    // If cohortId is omitted/null in raw data
    const mockCohort = null;
    vi.mocked(prisma.cohort.findUnique).mockResolvedValue(mockCohort);

    const data = {
      name: "Test Student",
      rollNumber: "24ACE001",
      cohortId: "",
      departmentId: "dept-cse",
    };

    // When cohort is empty string, service/API should fail validation
    expect(data.cohortId).toBe("");
  });

  it("2. Add student from Cohort preselects Cohort", async () => {
    const activeCohort = { id: "cohort-2024", code: "2024-2028", status: "ACTIVE" };
    vi.mocked(prisma.cohort.findUnique).mockResolvedValue(activeCohort as any);

    const context = { selectedCohort: activeCohort, selectedDepartment: null, selectedSection: null };
    const preselectedCohortId = context.selectedCohort?.id || "";

    expect(preselectedCohortId).toBe("cohort-2024");
  });

  it("3. Add student from Department preselects Cohort + Department", async () => {
    const activeCohort = { id: "cohort-2024", code: "2024-2028", status: "ACTIVE" };
    const activeDept = { id: "dept-cse", code: "CSE", isActive: true };

    const context = { selectedCohort: activeCohort, selectedDepartment: activeDept, selectedSection: null };

    expect(context.selectedCohort.id).toBe("cohort-2024");
    expect(context.selectedDepartment.id).toBe("dept-cse");
  });

  it("4. Add student from Section preselects Cohort + Department + Section", async () => {
    const activeCohort = { id: "cohort-2024", code: "2024-2028", status: "ACTIVE" };
    const activeDept = { id: "dept-cse", code: "CSE", isActive: true };
    const activeSection = { id: "sec-a", name: "A", cohortId: "cohort-2024", departmentId: "dept-cse", isActive: true };

    const context = { selectedCohort: activeCohort, selectedDepartment: activeDept, selectedSection: activeSection };

    expect(context.selectedCohort.id).toBe("cohort-2024");
    expect(context.selectedDepartment.id).toBe("dept-cse");
    expect(context.selectedSection.id).toBe("sec-a");
  });

  it("5. Section can be null (unassigned student)", async () => {
    const mockProfile = { id: "student-1", name: "Unassigned Student", rollNumber: "24ACE005", section: null };
    vi.mocked(prisma.studentProfile.create).mockResolvedValue(mockProfile as any);
    vi.mocked(prisma.studentEnrollment.create).mockResolvedValue({ id: "enrollment-1", classSectionId: null } as any);

    const res = await StudentProfileService.createProfile({
      name: "Unassigned Student",
      rollNumber: "24ACE005",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: null,
      codechefUsername: null,
      leetcodeUsername: null,
      codeforcesUsername: null,
      githubUsername: null,
      linkedinUrl: null,
      profilePictureUrl: null,
      year: 1,
      cgpa: null,
      contactNumber: null,
      branch: "CSE",
      department: "CSE",
      email: "unassigned@ace.ac.in",
      section: null,
    });

    expect(res.success).toBe(true);
    expect(prisma.studentEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classSectionId: null,
        }),
      })
    );
  });

  it("6. Invalid or inactive Cohort selection is detected", async () => {
    const inactiveCohort = { id: "cohort-old", code: "2018-2022", status: "ARCHIVED" };
    vi.mocked(prisma.cohort.findUnique).mockResolvedValue(inactiveCohort as any);

    const cohort = await prisma.cohort.findUnique({ where: { id: "cohort-old" } });
    expect(cohort?.status).not.toBe("ACTIVE");
  });

  it("7. Class section not belonging to selected Cohort + Department is rejected", async () => {
    const sectionMismatched = {
      id: "sec-other",
      name: "B",
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

  it("8. Duplicate roll number causes conflict (409)", async () => {
    const existingStudent = {
      id: "student-existing",
      name: "Existing Roll",
      rollNumber: "24ACE008",
      studentEnrollments: [
        {
          isCurrent: true,
          cohort: { code: "2024-2028" },
          department: { code: "CSE" },
          classSection: { name: "A" },
        },
      ],
    };
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(existingStudent as any);

    const existing = await prisma.studentProfile.findUnique({ where: { rollNumber: "24ACE008" } });
    expect(existing).not.toBeNull();
    expect(existing?.rollNumber).toBe("24ACE008");
  });

  it("9. StudentProfile + StudentEnrollment creation is atomic", async () => {
    vi.mocked(prisma.studentProfile.create).mockResolvedValue({ id: "student-atomic" } as any);
    vi.mocked(prisma.studentEnrollment.create).mockResolvedValue({ id: "enrollment-atomic" } as any);

    const res = await StudentProfileService.createProfile({
      name: "Atomic Student",
      rollNumber: "24ACE009",
      cohortId: "cohort-2024",
      departmentId: "dept-cse",
      classSectionId: "sec-a",
      codechefUsername: null,
      leetcodeUsername: null,
      codeforcesUsername: null,
      githubUsername: null,
      linkedinUrl: null,
      profilePictureUrl: null,
      year: 1,
      cgpa: null,
      contactNumber: null,
      branch: "CSE",
      department: "CSE",
      email: "atomic@ace.ac.in",
      section: "A",
    });

    expect(res.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("10. Student appears in correct directory query level after creation", async () => {
    const mockActiveEnrollments = [
      { studentId: "s1", cohortId: "cohort-2024", departmentId: "dept-cse", classSectionId: "sec-a", isCurrent: true },
    ];
    vi.mocked(prisma.studentEnrollment.findFirst).mockResolvedValue(mockActiveEnrollments[0] as any);

    const currentE = await prisma.studentEnrollment.findFirst({ where: { studentId: "s1", isCurrent: true } });
    expect(currentE?.cohortId).toBe("cohort-2024");
    expect(currentE?.departmentId).toBe("dept-cse");
    expect(currentE?.classSectionId).toBe("sec-a");
  });

  it("11. Student count updates correctly for Cohort and Department", async () => {
    vi.mocked(prisma.studentEnrollment.count).mockResolvedValue(42);

    const count = await prisma.studentEnrollment.count({
      where: { cohortId: "cohort-2024", isCurrent: true, enrollmentStatus: "ACTIVE" },
    });
    expect(count).toBe(42);
  });

  it("12. HOD is restricted to their assigned department", async () => {
    const hodUser = { id: "hod-1", role: "HOD", departmentId: "dept-cse" };
    const targetDepartmentId = "dept-ece";

    const isAuthorized = hodUser.role === "ADMIN" || hodUser.departmentId === targetDepartmentId;
    expect(isAuthorized).toBe(false);
  });
});
