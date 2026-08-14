import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { normalizeAndValidateUrl, extractPlatformHandle } from "../src/utils/urlValidation";
import { StudentProfileService } from "../src/services/student-profile.service";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    studentProfile: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    cohort: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    classSection: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    studentEnrollment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentPlatformAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => {
      return cb(prisma);
    }),
  },
}));

describe("Student Platforms & Roster Ingestion Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. URL Validation & Normalization for HackerRank and HackerEarth", () => {
    it("normalizes and validates HackerRank URLs correctly", () => {
      const res1 = normalizeAndValidateUrl("https://www.hackerrank.com/profile/user_123", "hackerrank");
      expect(res1.isValid).toBe(true);
      expect(res1.handle).toBe("user_123");
      expect(res1.normalizedUrl).toBe("https://www.hackerrank.com/profile/user_123");

      const res2 = extractPlatformHandle("user_123", "hackerrank");
      expect(res2).toBe("user_123");

      const res3 = normalizeAndValidateUrl("https://wrongsite.com/profile/user_123", "hackerrank");
      expect(res3.isValid).toBe(false);
    });

    it("normalizes and validates HackerEarth URLs correctly", () => {
      const res1 = normalizeAndValidateUrl("https://www.hackerearth.com/@user_123", "hackerearth");
      expect(res1.isValid).toBe(true);
      expect(res1.handle).toBe("user_123");
      expect(res1.normalizedUrl).toBe("https://www.hackerearth.com/@user_123");

      const res2 = normalizeAndValidateUrl("https://www.hackerearth.com/users/user_123", "hackerearth");
      expect(res2.isValid).toBe(true);
      expect(res2.handle).toBe("user_123");

      const res3 = extractPlatformHandle("user_123", "hackerearth");
      expect(res3).toBe("user_123");
    });
  });

  describe("2. evaluateRows Update Pre-check & Merge", () => {
    it("merges incoming blank fields to preserve richer existing database values", async () => {
      const dbStudents = [
        {
          id: "student-123",
          rollNumber: "22BCE1001",
          name: "Original Name",
          email: "rich@database.com",
          contactNumber: "9876543210",
          codechefUsername: "cc_rich",
          leetcodeUsername: "lc_rich",
          githubUsername: "gh_rich",
          codeforcesUsername: "cf_rich",
          linkedinUrl: "https://linkedin.com/in/rich",
          section: "A",
          department: "CSE",
          branch: "CSE",
          year: 3,
          cgpa: 8.5,
        },
      ];

      const csvRow = {
        name: "",
        rollNumber: "22BCE1001",
        email: "",
        contactNumber: "",
        year: 3,
        cgpa: "",
        codechefUsername: "",
        leetcodeUsername: "",
      };

      const evaluated = await StudentProfileService.evaluateRows([csvRow], dbStudents);
      expect(evaluated.length).toBe(1);
      
      const norm = evaluated[0].normalized;
      expect(norm.name).toBe("Original Name");
      expect(norm.email).toBe("rich@database.com");
      expect(norm.contactNumber).toBe("9876543210");
      expect(norm.codechefUsername).toBe("cc_rich");
      expect(norm.leetcodeUsername).toBe("lc_rich");
      expect(norm.cgpa).toBe(8.5);
    });
  });

  describe("3. Roster Ingestion Idempotency", () => {
    it("reports metrics correctly for created, updated, and unchanged rows", async () => {
      // Mock db returns empty for first run
      vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([]);
      vi.mocked(prisma.studentEnrollment.findFirst).mockResolvedValue({ id: "enrollment-1", isCurrent: true, cohortId: "cohort-1", departmentId: "dept-1", classSectionId: "sec-1" } as any);
      vi.mocked(prisma.studentPlatformAccount.findUnique).mockResolvedValue(null);

      // Mock profiles
      vi.mocked(prisma.studentProfile.create).mockResolvedValue({ id: "student-123" } as any);
      vi.mocked(prisma.cohort.findUnique).mockResolvedValue({ id: "cohort-1", code: "2022-2026" } as any);
      vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: "dept-1", code: "CSE" } as any);
      vi.mocked(prisma.classSection.findUnique).mockResolvedValue({ id: "sec-1", name: "A" } as any);

      // 1. First run: Import new student
      const row1 = { name: "Original Name", rollNumber: "22BCE1001", email: "rich@database.com", contactNumber: "9876543210", year: 3, cgpa: "8.5", codechefUsername: "cc_rich", leetcodeUsername: "lc_rich" };
      const res1 = await StudentProfileService.processBatchImport([row1]);
      expect(res1.success).toBe(true);
      expect(res1.summary.actuallyCreated).toBe(1);
      expect(res1.summary.actuallyUpdated).toBe(0);
      expect(res1.summary.unchanged).toBe(0);

      // 2. Mock db now has this student
      const dbStudents = [
        {
          id: "student-123",
          rollNumber: "22BCE1001",
          name: "Original Name",
          email: "rich@database.com",
          contactNumber: "9876543210",
          codechefUsername: "cc_rich",
          leetcodeUsername: "lc_rich",
          githubUsername: "gh_rich",
          codeforcesUsername: "cf_rich",
          linkedinUrl: "https://linkedin.com/in/rich",
          section: "A",
          department: "CSE",
          branch: "CSE",
          year: 3,
          cgpa: 8.5,
        },
      ];
      vi.mocked(prisma.studentProfile.findMany).mockResolvedValue(dbStudents as any);

      // Second run: Import same row with changed CGPA (Updates)
      const row2 = { name: "Original Name", rollNumber: "22BCE1001", email: "rich@database.com", contactNumber: "9876543210", year: 3, cgpa: "9.2", codechefUsername: "cc_rich", leetcodeUsername: "lc_rich" };
      const res2 = await StudentProfileService.processBatchImport([row2]);
      expect(res2.success).toBe(true);
      expect(res2.summary.actuallyCreated).toBe(0);
      expect(res2.summary.actuallyUpdated).toBe(1);
      expect(res2.summary.unchanged).toBe(0);

      // 3. Third run: Import same row completely unchanged
      const res3 = await StudentProfileService.processBatchImport([row1]);
      expect(res3.success).toBe(true);
      expect(res3.summary.actuallyCreated).toBe(0);
      expect(res3.summary.actuallyUpdated).toBe(0);
      expect(res3.summary.unchanged).toBe(1);
    });
  });

  describe("4. Derived Leaderboard Eligibility & Data Drift Protection", () => {
    it("evaluates student eligibility correctly based on platform verification and admin approval", async () => {
      const mockStudent1 = {
        id: "student-1",
        adminApprovalStatus: "APPROVED",
        codechefUsername: "cc_user",
        leetcodeUsername: "lc_user",
        platformAccounts: [
          { platform: "CODECHEF", verificationStatus: "VERIFIED" },
          { platform: "LEETCODE", verificationStatus: "VERIFIED" },
        ],
      };

      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(mockStudent1 as any);
      const eligible1 = await StudentProfileService.calculateAndUpdateEligibility("student-1");
      expect(eligible1).toBe(true);

      const mockStudent2 = {
        id: "student-2",
        adminApprovalStatus: "REJECTED",
        codechefUsername: "cc_user",
        leetcodeUsername: "lc_user",
        platformAccounts: [
          { platform: "CODECHEF", verificationStatus: "VERIFIED" },
          { platform: "LEETCODE", verificationStatus: "VERIFIED" },
        ],
      };

      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(mockStudent2 as any);
      const eligible2 = await StudentProfileService.calculateAndUpdateEligibility("student-2");
      expect(eligible2).toBe(false);

      const mockStudent3 = {
        id: "student-3",
        adminApprovalStatus: "APPROVED",
        codechefUsername: "cc_user",
        leetcodeUsername: "lc_user",
        platformAccounts: [
          { platform: "CODECHEF", verificationStatus: "PENDING" },
          { platform: "LEETCODE", verificationStatus: "VERIFIED" },
        ],
      };

      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(mockStudent3 as any);
      const eligible3 = await StudentProfileService.calculateAndUpdateEligibility("student-3");
      expect(eligible3).toBe(false);
    });
  });
});
