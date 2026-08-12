import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { StudentProfileService } from "../src/services/student-profile.service";
import { BulkSyncService } from "../src/services/bulkSync.service";
import { SyncService } from "../src/services/sync.service";

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
      create: vi.fn(),
    },
    syncJob: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((queries) => Promise.all(queries)),
  },
}));

describe("Phase 4 Final Integration & Verification Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Academic Registry Automated Student Enrollments", () => {
    it("automatically resolves and creates Cohort, Department, ClassSection, and StudentEnrollment inside createProfile", async () => {
      const mockProfile = { id: "student-123", name: "Jane Doe", rollNumber: "23AG1A0501" };
      
      vi.mocked(prisma.studentProfile.create).mockResolvedValue(mockProfile as any);
      vi.mocked(prisma.cohort.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cohort.create).mockResolvedValue({ id: "cohort-123", code: "2023-2027" } as any);
      vi.mocked(prisma.department.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.department.create).mockResolvedValue({ id: "dept-123", code: "CSE" } as any);
      vi.mocked(prisma.classSection.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.classSection.create).mockResolvedValue({ id: "sec-123", name: "A" } as any);

      const result = await StudentProfileService.createProfile({
        name: "Jane Doe",
        rollNumber: "23AG1A0501",
        email: "jane@example.com",
        year: 1,
        branch: "CSE",
        department: "CSE",
        section: "A",
        cgpa: null,
        contactNumber: null,
        codechefUsername: null,
        leetcodeUsername: null,
        codeforcesUsername: null,
        githubUsername: null,
        linkedinUrl: null,
        profilePictureUrl: null,
      });

      expect(result.success).toBe(true);
      expect(prisma.studentProfile.create).toHaveBeenCalled();
      expect(prisma.cohort.create).toHaveBeenCalledWith({
        data: { code: "2023-2027", startYear: 2023, endYear: 2027, status: "ACTIVE" }
      });
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: { code: "CSE", name: "CSE", isActive: true }
      });
      expect(prisma.studentEnrollment.create).toHaveBeenCalledWith({
        data: {
          studentId: "student-123",
          cohortId: "cohort-123",
          departmentId: "dept-123",
          classSectionId: "sec-123",
          academicYear: 1,
          isCurrent: true,
          enrollmentStatus: "ACTIVE",
        }
      });
    });
  });

  describe("2. Sync Queue Duplicate Job Protection", () => {
    it("queueEligibleStudents reuses existing queued/processing sync jobs instead of adding duplicate records", async () => {
      vi.mocked(prisma.studentProfile.findMany).mockResolvedValue([
        { id: "student-1", codechefUsername: "cc1", leetcodeUsername: "lc1", profileStatus: "PENDING_VERIFICATION" }
      ] as any);

      const existingJob = { id: "job-999", studentId: "student-1", status: "VERIFIED" };
      vi.mocked(prisma.syncJob.findFirst)
        .mockResolvedValueOnce(null) // No active job in active states
        .mockResolvedValueOnce(existingJob as any); // Returns existing VERIFIED job

      const result = await BulkSyncService.queueEligibleStudents();

      expect(result.queuedCount).toBe(1);
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: "job-999" },
        data: {
          status: "QUEUED",
          attemptCount: 0,
          error: null,
          errorCategory: null
        }
      });
      expect(prisma.syncJob.create).not.toHaveBeenCalled();
    });
  });

  describe("3. Robust Batch Worker Try-Catch", () => {
    it("processBatch handles unexpected scraper failures gracefully without blocking other jobs in queue", async () => {
      vi.mocked(prisma.syncJob.findMany).mockResolvedValue([
        { id: "job-1", studentId: "student-1", attemptCount: 1 }
      ] as any);
      vi.mocked(prisma.syncJob.count).mockResolvedValue(0);

      // Claim jobs returns the job
      vi.spyOn(BulkSyncService, "claimJobs").mockResolvedValue([
        { id: "job-1", studentId: "student-1", attemptCount: 1 }
      ] as any);

      // syncStudent throws a fatal error (e.g. database crash or network timeout)
      vi.spyOn(SyncService, "syncStudent").mockRejectedValue(new Error("Network connection timeout"));

      const result = await BulkSyncService.processBatch(1, 1);

      expect(result.processedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: {
          status: "RETRY_PENDING",
          error: "Network connection timeout",
          errorCategory: "TIMEOUT"
        }
      });
      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: "student-1" },
        data: {
          profileStatus: "INCOMPLETE",
          leaderboardEligible: false,
          dashboardEligible: false
        }
      });
    });
  });
});
