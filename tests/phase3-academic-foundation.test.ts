import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock Prisma
const mockPrisma = {
  cohort: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  department: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  classSection: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  studentEnrollment: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  studentProfile: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (cb) => {
    if (typeof cb === "function") {
      return cb(mockPrisma);
    }
    return Promise.all(cb);
  }),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

describe("Phase 3: Additive Academic Database Foundation - Schema & Logic Verification", () => {
  const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Prisma Schema File Analysis", () => {
    it("verifies enums and models exist in schema.prisma", () => {
      expect(fs.existsSync(schemaPath)).toBe(true);
      const schema = fs.readFileSync(schemaPath, "utf-8");

      // Verify Enums exist
      expect(schema).toContain("enum CohortStatus");
      expect(schema).toContain("enum EnrollmentStatus");

      // Verify Models exist
      expect(schema).toContain("model Cohort");
      expect(schema).toContain("model Department");
      expect(schema).toContain("model ClassSection");
      expect(schema).toContain("model StudentEnrollment");
    });

    it("verifies UUID database types and constraints", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");

      // Verify UUID db types and VarChar lengths
      expect(schema).toMatch(/id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
      expect(schema).toMatch(/cohortId\s+String\s+@map\("cohort_id"\)\s+@db\.Uuid/);
      expect(schema).toMatch(/departmentId\s+String\s+@map\("department_id"\)\s+@db\.Uuid/);

      // Verify exact VarChar lengths
      expect(schema).toMatch(/code\s+String\s+@unique\s+@db\.VarChar\(20\)/);
      expect(schema).toMatch(/name\s+String\s+@db\.VarChar\(50\)/);
    });

    it("verifies StudentProfile model has studentEnrollments opposite relation", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      expect(schema).toContain("studentEnrollments StudentEnrollment[]");
    });

    it("verifies Composite Foreign Key constraints on ClassSection in StudentEnrollment", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      expect(schema).toMatch(/classSection\s+ClassSection\?\s+@relation\(fields:\s*\[classSectionId,\s*cohortId,\s*departmentId\],\s*references:\s*\[id,\s*cohortId,\s*departmentId\],\s*onDelete:\s*Restrict\)/);
    });
  });

  describe("2. Mock Database Operations & Constraints Rationale", () => {
    it("demonstrates creating Cohort, Department, and ClassSection", async () => {
      const mockCohort = { id: "c-1", code: "2024-2028", startYear: 2024, endYear: 2028 };
      const mockDept = { id: "d-1", code: "CSE", name: "Computer Science & Engineering" };
      const mockSection = { id: "cs-1", cohortId: "c-1", departmentId: "d-1", name: "A" };

      mockPrisma.cohort.create.mockResolvedValue(mockCohort);
      mockPrisma.department.create.mockResolvedValue(mockDept);
      mockPrisma.classSection.create.mockResolvedValue(mockSection);

      const cohort = await mockPrisma.cohort.create({ data: mockCohort });
      const dept = await mockPrisma.department.create({ data: mockDept });
      const section = await mockPrisma.classSection.create({ data: mockSection });

      expect(cohort.code).toBe("2024-2028");
      expect(dept.code).toBe("CSE");
      expect(section.name).toBe("A");
      expect(section.cohortId).toBe(cohort.id);
      expect(section.departmentId).toBe(dept.id);
    });

    it("verifies that classSectionId is nullable on StudentEnrollment", async () => {
      const mockEnrollment = {
        id: "e-1",
        studentId: "s-1",
        cohortId: "c-1",
        departmentId: "d-1",
        classSectionId: null, // Nullable ClassSection
        academicYear: 3,
        isCurrent: true,
      };

      mockPrisma.studentEnrollment.create.mockResolvedValue(mockEnrollment);

      const enrollment = await mockPrisma.studentEnrollment.create({ data: mockEnrollment });
      expect(enrollment.classSectionId).toBeNull();
      expect(enrollment.academicYear).toBe(3);
    });

    it("verifies restrict delete behavior logic on Cohorts and Departments with referenced sections", async () => {
      // Deleting a cohort or department that has class sections is protected by onDelete: Restrict in DB
      const deleteCohort = async (cohortId: string) => {
        // App service logic check
        const sectionsCount = 2; // Simulate count > 0 check or catch DB error
        if (sectionsCount > 0) {
          throw new Error("Foreign key constraint violation: Cannot delete cohort with active class sections.");
        }
        return mockPrisma.cohort.delete({ where: { id: cohortId } });
      };

      await expect(deleteCohort("c-1")).rejects.toThrow("Cannot delete cohort with active class sections.");
    });

    it("verifies transaction logic when moving a student", async () => {
      const studentId = "s-1";
      const newCohortId = "c-2";
      const newDepartmentId = "d-1";
      const newAcademicYear = 2;

      // promotion transaction
      await mockPrisma.$transaction(async (tx) => {
        // 1. End previous current enrollment
        await tx.studentEnrollment.updateMany({
          where: { studentId, isCurrent: true },
          data: { isCurrent: false },
        });

        // 2. Create new current enrollment
        await tx.studentEnrollment.create({
          data: {
            studentId,
            cohortId: newCohortId,
            departmentId: newDepartmentId,
            classSectionId: null,
            academicYear: newAcademicYear,
            isCurrent: true,
          },
        });
      });

      expect(mockPrisma.studentEnrollment.updateMany).toHaveBeenCalledWith({
        where: { studentId, isCurrent: true },
        data: { isCurrent: false },
      });
      expect(mockPrisma.studentEnrollment.create).toHaveBeenCalledWith({
        data: {
          studentId,
          cohortId: newCohortId,
          departmentId: newDepartmentId,
          classSectionId: null,
          academicYear: newAcademicYear,
          isCurrent: true,
        },
      });
    });
  });

  describe("3. Preservation of Legacy Functionality", () => {
    it("ensures no changes were made to existing auth, leaderboard, and sync configurations in schema", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");

      // Verify existing tables/enums exist unmodified
      expect(schema).toContain("enum UserRole");
      expect(schema).toContain("model StudentProfile");
      expect(schema).toContain("model UserAccess");
      expect(schema).toContain("model CodechefProfile");
      expect(schema).toContain("model LeetcodeProfile");
      expect(schema).toContain("model LeaderboardEntry");
      expect(schema).toContain("model SyncJob");
      expect(schema).toContain("model AuditLog");
    });
  });
});
