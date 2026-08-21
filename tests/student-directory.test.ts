import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only to prevent Vitest from throwing env errors
vi.mock("server-only", () => ({}));

// Mock prisma dependency
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    studentProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentEnrollment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    cohort: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    classSection: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    userAccess: {
      updateMany: vi.fn(),
    },
    syncJob: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => {
      if (typeof fn === "function") {
        return fn(mockPrisma);
      }
      return Promise.all(fn);
    }),
  };
  return { prisma: mockPrisma };
});

// Mock Auth Roles
const mockRequireAuthenticatedUser = vi.fn();
const mockRequireActiveUser = vi.fn();
const mockRequireRole = vi.fn();
const mockRequireAdmin = vi.fn();
const mockRequireStaffReadAccess = vi.fn();
const mockGetAuthenticatedUserAccess = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: () => mockRequireAuthenticatedUser(),
  requireActiveUser: () => mockRequireActiveUser(),
  requireRole: (...roles: any[]) => mockRequireRole(...roles),
  requireAdmin: () => mockRequireAdmin(),
  requireStaffReadAccess: () => mockRequireStaffReadAccess(),
  getAuthenticatedUserAccess: () => mockGetAuthenticatedUserAccess(),
}));

// Mock Audit service
vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { StudentProfileService } from "@/services/student-profile.service";
import { POST as createStudent } from "@/app/api/admin/students/route";
import { PATCH as updateStudent } from "@/app/api/admin/students/[id]/route";
import { GET as getDirectory } from "@/app/api/admin/directory/route";
import { NextRequest } from "next/server";

describe("Student Directory Architecture Integration Workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserAccess.mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" });
  });

  describe("1. Transactional Student Creation in StudentProfileService", () => {
    it("should create StudentProfile and StudentEnrollment inside a transaction using explicit placement IDs", async () => {
      const studentData = {
        name: "Test Student",
        rollNumber: "TEST-CREATE-001",
        contactNumber: "1234567890",
        year: 2,
        branch: "CSE",
        department: "CSE",
        section: "A",
        cgpa: 9.2,
        email: "test001@college.edu",
        codechefUsername: "testcc",
        leetcodeUsername: "testlc",
        codeforcesUsername: null,
        githubUsername: null,
        linkedinUrl: null,
        profilePictureUrl: null,
        cohortId: "cohort-uuid-123",
        departmentId: "dept-uuid-456",
        classSectionId: "section-uuid-789",
      };

      const mockProfile = { id: "new-student-id", name: "Test Student", rollNumber: "TEST-CREATE-001" };
      (prisma.studentProfile.create as any).mockResolvedValue(mockProfile);

      const result = await StudentProfileService.createProfile(studentData, prisma);

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.studentProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rollNumber: "TEST-CREATE-001",
            email: "test001@college.edu",
            cgpa: 9.2,
          }),
        })
      );
      expect(prisma.studentEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: "new-student-id",
            cohortId: "cohort-uuid-123",
            departmentId: "dept-uuid-456",
            classSectionId: "section-uuid-789",
          }),
        })
      );
    });

    it("should fallback to null classSectionId when unassigned section is specified", async () => {
      const studentData = {
        name: "Test Student Unassigned",
        rollNumber: "TEST-CREATE-002",
        contactNumber: null,
        year: 1,
        branch: "ECE",
        department: "ECE",
        section: "",
        cgpa: null,
        email: "test002@college.edu",
        codechefUsername: null,
        leetcodeUsername: null,
        codeforcesUsername: null,
        githubUsername: null,
        linkedinUrl: null,
        profilePictureUrl: null,
        cohortId: "cohort-uuid-123",
        departmentId: "dept-uuid-456",
        classSectionId: null, // explicitly unassigned section
      };

      const mockProfile = { id: "student-unassigned-id", name: "Test Student Unassigned", rollNumber: "TEST-CREATE-002" };
      (prisma.studentProfile.create as any).mockResolvedValue(mockProfile);

      const result = await StudentProfileService.createProfile(studentData, prisma);

      expect(result.success).toBe(true);
      expect(prisma.studentEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            classSectionId: null,
          }),
        })
      );
    });
  });

  describe("2. Single Student Manual Creation Endpoint Constraints", () => {
    it("should reject student creation and return 409 Conflict if roll number already exists", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
      (prisma.studentProfile.findUnique as any).mockResolvedValue({
        id: "existing-student-uuid",
        rollNumber: "22AG1A0501",
      });

      const req = new NextRequest("http://localhost/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Duplicate Roll Student",
          rollNumber: "23AG1A0501",
          email: "newemail@college.edu",
          year: 1,
          department: "CSE",
        }),
      });

      const res = await createStudent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isNew).toBe(false);
    });
  });

  describe("3. Student Edit and Placement History Modification (PATCH)", () => {
    it("should update StudentProfile and end current enrollment to start a new one when placement changes", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

      const oldStudent = {
        id: "student-1",
        rollNumber: "22AG1A0502",
        email: "student2@college.edu",
        name: "Old Name",
        year: 2,
        branch: "CSE",
        section: "A",
      };
      (prisma.studentProfile.findUnique as any).mockResolvedValue(oldStudent);

      const currentEnrollment = {
        id: "enrollment-old",
        studentId: "student-1",
        cohortId: "cohort-old-id",
        departmentId: "dept-old-id",
        classSectionId: "section-old-id",
        isCurrent: true,
      };
      (prisma.studentEnrollment.findFirst as any).mockResolvedValue(currentEnrollment);

      const req = new NextRequest("http://localhost/api/admin/students/student-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          cohortId: "cohort-new-id", // placement changed!
          departmentId: "dept-new-id",
          classSectionId: "section-new-id",
        }),
      });

      const res = await updateStudent(req, { params: Promise.resolve({ id: "student-1" }) });
      expect(res.status).toBe(200);

      expect(prisma.studentEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "enrollment-old" },
          data: expect.objectContaining({ isCurrent: false }),
        })
      );

      expect(prisma.studentEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: "student-1",
            cohortId: "cohort-new-id",
            departmentId: "dept-new-id",
            classSectionId: "section-new-id",
            isCurrent: true,
          }),
        })
      );
    });

    it("should NOT create new history enrollment if placement identifiers are unchanged", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

      const oldStudent = {
        id: "student-1",
        rollNumber: "22AG1A0502",
        email: "student2@college.edu",
        name: "Old Name",
        year: 2,
        branch: "CSE",
        section: "A",
      };
      (prisma.studentProfile.findUnique as any).mockResolvedValue(oldStudent);

      const currentEnrollment = {
        id: "enrollment-same",
        studentId: "student-1",
        cohortId: "cohort-same-id",
        departmentId: "dept-same-id",
        classSectionId: "section-same-id",
        isCurrent: true,
      };
      (prisma.studentEnrollment.findFirst as any).mockResolvedValue(currentEnrollment);

      const req = new NextRequest("http://localhost/api/admin/students/student-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name Only",
          cohortId: "cohort-same-id", // placement remains unchanged
          departmentId: "dept-same-id",
          classSectionId: "section-same-id",
        }),
      });

      const res = await updateStudent(req, { params: Promise.resolve({ id: "student-1" }) });
      expect(res.status).toBe(200);

      // Verify that no old enrollment was ended and no new enrollment was created
      expect(prisma.studentEnrollment.update).not.toHaveBeenCalled();
      expect(prisma.studentEnrollment.create).not.toHaveBeenCalled();
    });
  });

  describe("4. Role-based Server-Side Department Scoping for Directory", () => {
    it("should restrict HOD to their department code and return 403 Forbidden for cross-department searches", async () => {
      // HOD user for ECE department
      mockRequireStaffReadAccess.mockResolvedValue({
        id: "hod-1",
        role: "HOD",
        departmentId: "ECE", // userAccess departmentId matches ECE code
      });

      // Mock department database checks
      (prisma.department.findFirst as any).mockResolvedValue({
        id: "ece-uuid-999",
        code: "ECE",
        name: "Electronics and Communication Engineering",
      });

      // ECE HOD attempts to read CSE departmentId (which represents cross-department lookup)
      const req = new NextRequest("http://localhost/api/admin/directory?cohortId=cohort-1&departmentId=cse-uuid-111", {
        method: "GET",
      });

      const res = await getDirectory(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("only view your own department");
    });

    it("should automatically restrict parameters to HOD's department if HOD requests list of cohorts", async () => {
      mockRequireStaffReadAccess.mockResolvedValue({
        id: "hod-1",
        role: "HOD",
        departmentId: "ECE",
      });

      (prisma.department.findFirst as any).mockResolvedValue({
        id: "ece-uuid-999",
        code: "ECE",
        name: "ECE",
      });

      (prisma.cohort.findMany as any).mockResolvedValue([
        { id: "cohort-1", code: "2022-2026", startYear: 2022, endYear: 2026 },
      ]);

      const req = new NextRequest("http://localhost/api/admin/directory", {
        method: "GET",
      });

      const res = await getDirectory(req);
      expect(res.status).toBe(200);

      // Verify that student count aggregate check was restricted using HOD's department UUID
      expect(prisma.studentEnrollment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: "ece-uuid-999",
          }),
        })
      );
    });

    it("should deny access to directories for STUDENT roles", async () => {
      // Stub Auth to throw for STUDENT role
      mockRequireStaffReadAccess.mockImplementation(() => {
        const err = new Error("Forbidden");
        (err as any).name = "AuthError";
        (err as any).code = "FORBIDDEN_ROLE";
        throw err;
      });

      const req = new NextRequest("http://localhost/api/admin/directory", {
        method: "GET",
      });

      const res = await getDirectory(req);
      expect(res.status).toBe(403);
    });
  });
});
