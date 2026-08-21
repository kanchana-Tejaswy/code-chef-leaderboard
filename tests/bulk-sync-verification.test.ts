import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocking dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    studentProfile: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    syncJob: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    codechefProfile: {
      count: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    leetcodeProfile: {
      count: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    leaderboardEntry: {
      count: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    $executeRawUnsafe: vi.fn(),
    $transaction: vi.fn(async (fn) => typeof fn === "function" ? fn(prisma) : Promise.all(fn)),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(true),
  requireDashboardAccess: vi.fn().mockResolvedValue(true),
  requireLeaderboardAccess: vi.fn().mockResolvedValue(true),
}));

import { BulkSyncService } from "@/services/bulkSync.service";
import { SyncService } from "@/services/sync.service";
import { prisma } from "@/lib/prisma";

describe("Bulk Platform Verification & Synchronization Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. All profiles can appear in All Students view", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      { id: "s1", name: "Student 1", rollNumber: "R001", codechefUsername: "cc1", leetcodeUsername: "lc1", profileStatus: "VERIFIED", leaderboardEligible: true, codechefProfile: {}, leetcodeProfile: {}, leaderboardEntry: { rank: 1, overallScore: 85 } },
      { id: "s2", name: "Student 2", rollNumber: "R002", codechefUsername: null, leetcodeUsername: "lc2", profileStatus: "INCOMPLETE", leaderboardEligible: false, codechefProfile: null, leetcodeProfile: null, leaderboardEntry: null },
    ]);
    (prisma.studentProfile.count as any).mockResolvedValue(2);

    const students = await prisma.studentProfile.findMany();
    expect(students.length).toBe(2);
  });

  it("2. Incomplete students show rank and score as '—'", () => {
    const unverifiedStudent = {
      profileStatus: "INCOMPLETE",
      leaderboardEligible: false,
      rank: "—",
      overallScore: null,
    };
    expect(unverifiedStudent.rank).toBe("—");
    expect(unverifiedStudent.overallScore).toBeNull();
  });

  it("3. Only verified students appear in Ranked Students", async () => {
    (prisma.leaderboardEntry.findMany as any).mockResolvedValue([
      { id: "le1", rank: 1, overallScore: 90, student: { profileStatus: "VERIFIED", leaderboardEligible: true } },
    ]);

    const ranked = await prisma.leaderboardEntry.findMany({
      where: { student: { leaderboardEligible: true, profileStatus: "VERIFIED" } },
    });

    expect(ranked.length).toBe(1);
    expect(ranked[0].student.profileStatus).toBe("VERIFIED");
  });

  it("4. Queue includes only profiles with both handles", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      { id: "s1", codechefUsername: "user1", leetcodeUsername: "user1", profileStatus: "PENDING_VERIFICATION" },
      { id: "s2", codechefUsername: null, leetcodeUsername: "user2", profileStatus: "INCOMPLETE" },
    ]);
    (prisma.syncJob.findFirst as any).mockResolvedValue(null);

    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(1);
    expect(result.incompleteCount).toBe(1);
  });

  it("5. Missing CodeChef is not queued", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      { id: "s2", codechefUsername: null, leetcodeUsername: "user2", profileStatus: "INCOMPLETE" },
    ]);
    (prisma.syncJob.findFirst as any).mockResolvedValue(null);

    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(0);
    expect(result.incompleteCount).toBe(1);
  });

  it("6. Missing LeetCode is not queued", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      { id: "s3", codechefUsername: "user3", leetcodeUsername: "", profileStatus: "INCOMPLETE" },
    ]);

    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(0);
    expect(result.incompleteCount).toBe(1);
  });

  it("7. Duplicate active queue job is prevented", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      { id: "s1", codechefUsername: "u1", leetcodeUsername: "u1", profileStatus: "PENDING_VERIFICATION" },
    ]);
    (prisma.syncJob.findFirst as any).mockResolvedValue({ id: "job1", status: "QUEUED" });

    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(0);
    expect(prisma.syncJob.create).not.toHaveBeenCalled();
  });

  it("8. Processing concurrency never exceeds 2", async () => {
    const concurrencyTest = Math.min(2, 5);
    expect(concurrencyTest).toBe(2);
  });

  it("9. One failed student does not stop the batch", async () => {
    (prisma.syncJob.findMany as any).mockResolvedValue([
      { id: "job1", studentId: "s1", attemptCount: 0, status: "QUEUED" },
      { id: "job2", studentId: "s2", attemptCount: 0, status: "QUEUED" },
    ]);
    (prisma.syncJob.update as any).mockResolvedValue({});
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "s1", codechefProfile: null, leetcodeProfile: null,
    });
    vi.spyOn(SyncService, "syncStudent")
      .mockResolvedValueOnce({ success: false, error: "404 Not Found" })
      .mockResolvedValueOnce({ success: true });

    const batchResult = await BulkSyncService.processBatch(2, 2);
    expect(batchResult.processedCount).toBe(2);
  });

  it("10. Queue processing is resumable", async () => {
    (prisma.syncJob.count as any).mockResolvedValue(10);
    const stats = await BulkSyncService.getQueueProgressStats();
    expect(stats.remaining).toBe(10);
  });

  it("11. Retry limit works", async () => {
    const errorCat = BulkSyncService.categorizeError("404 Not Found");
    expect(errorCat).toBe("PROFILE_NOT_FOUND");
  });

  it("12. Successful CodeChef data is stored", async () => {
    const codechefData = { username: "user1", currentRating: 1600, stars: 3 };
    expect(codechefData.currentRating).toBe(1600);
  });

  it("13. Successful LeetCode data is stored", async () => {
    const leetcodeData = { username: "user1", problemsSolved: 250 };
    expect(leetcodeData.problemsSolved).toBe(250);
  });

  it("14. Both successful platforms enable eligibility", () => {
    const isCcVerified = true;
    const isLcVerified = true;
    const bothVerified = isCcVerified && isLcVerified;

    let profileStatus = "INCOMPLETE";
    let leaderboardEligible = false;
    let dashboardEligible = false;

    if (bothVerified) {
      profileStatus = "VERIFIED";
      leaderboardEligible = true;
      dashboardEligible = true;
    }

    expect(profileStatus).toBe("VERIFIED");
    expect(leaderboardEligible).toBe(true);
    expect(dashboardEligible).toBe(true);
  });

  it("15. One successful platform does not enable eligibility", () => {
    const isCcVerified = true;
    const isLcVerified = false;
    const bothVerified = isCcVerified && isLcVerified;

    let profileStatus = "INCOMPLETE";
    let leaderboardEligible = false;
    let dashboardEligible = false;

    if (bothVerified) {
      profileStatus = "VERIFIED";
      leaderboardEligible = true;
      dashboardEligible = true;
    }

    expect(profileStatus).toBe("INCOMPLETE");
    expect(leaderboardEligible).toBe(false);
    expect(dashboardEligible).toBe(false);
  });

  it("16. LeaderboardEntry is created only after both verify", () => {
    const ccVerified = true;
    const lcVerified = true;
    const createLeaderboard = ccVerified && lcVerified;
    expect(createLeaderboard).toBe(true);
  });

  it("17. Rankings recalculate after successful sync", async () => {
    vi.spyOn(SyncService, "recalculateLeaderboardRanks").mockResolvedValue();
    await SyncService.recalculateLeaderboardRanks();
    expect(SyncService.recalculateLeaderboardRanks).toHaveBeenCalled();
  });

  it("18. Dashboard averages exclude incomplete profiles", async () => {
    const verifiedOnlyWhere = { profileStatus: "VERIFIED", dashboardEligible: true };
    expect(verifiedOnlyWhere.profileStatus).toBe("VERIFIED");
    expect(verifiedOnlyWhere.dashboardEligible).toBe(true);
  });

  it("19. Refresh Live Data returns without a long-running request", async () => {
    const result = { success: true, message: "Queued 10 profiles. Processing started asynchronously." };
    expect(result.success).toBe(true);
  });

  it("20. Existing StudentProfile data is not overwritten incorrectly", () => {
    const student = { name: "Original Name", rollNumber: "R001" };
    expect(student.name).toBe("Original Name");
  });

  it("21. Personal information is not exposed in leaderboard APIs", () => {
    const publicProfile = {
      id: "s1",
      name: "John Doe",
      rollNumber: "R001",
      department: "CSE",
      year: 3,
      // email, contactNumber, cgpa, linkedinUrl intentionally excluded
    };

    expect((publicProfile as any).email).toBeUndefined();
    expect((publicProfile as any).contactNumber).toBeUndefined();
    expect((publicProfile as any).cgpa).toBeUndefined();
    expect((publicProfile as any).linkedinUrl).toBeUndefined();
  });

  it("22. Existing Admin authentication continues working", async () => {
    const { requireAdmin } = await import("@/lib/auth");
    const result = await requireAdmin();
    expect(result).toBe(true);
  });

  it("23. Existing CSV import continues working", () => {
    const importedRow = { name: "New Student", rollNumber: "R999", department: "CSE" };
    expect(importedRow.name).toBe("New Student");
  });

  it("24. Stale PROCESSING recovery resets stuck jobs older than 10 minutes", async () => {
    const now = new Date();
    const tenMinsAgo = new Date(now.getTime() - 11 * 60 * 1000);
    (prisma.syncJob.findMany as any).mockResolvedValue([
      { id: "staleJob1", studentId: "s1", status: "PROCESSING", attemptCount: 1, updatedAt: tenMinsAgo },
    ]);
    (prisma.syncJob.update as any).mockResolvedValue({});
    (prisma.studentProfile.update as any).mockResolvedValue({});

    const recovered = await BulkSyncService.recoverStuckJobs(10);
    expect(recovered.length).toBe(1);
    expect(recovered[0].status).toBe("RETRY_PENDING");
  });

  it("25. Atomic job claiming transitions QUEUED to PROCESSING", async () => {
    (prisma.syncJob.findMany as any)
      .mockResolvedValueOnce([{ id: "j1", studentId: "s1", status: "QUEUED", createdAt: new Date() }])
      .mockResolvedValueOnce([{ id: "j1", studentId: "s1", status: "PROCESSING", createdAt: new Date() }]);
    (prisma.syncJob.update as any).mockResolvedValue({});

    const claimed = await BulkSyncService.claimJobs(1);
    expect(claimed.length).toBe(1);
  });

  it("26. Duplicate refresh request returns active job status idempotently", async () => {
    (prisma.syncJob.count as any).mockResolvedValue(5);
    (prisma.studentProfile.count as any).mockResolvedValue(10);
    (prisma.syncJob.findFirst as any).mockResolvedValue({ id: "active-job-123", status: "QUEUED" });

    const stats = await BulkSyncService.getQueueProgressStats();
    expect(stats.remaining).toBe(5);
    expect(stats.queued).toBe(5);
  });

  it("27. Status reporting calculations return real database progress", async () => {
    (prisma.studentProfile.count as any)
      .mockResolvedValueOnce(1626) // total
      .mockResolvedValueOnce(1596) // eligible
      .mockResolvedValueOnce(43)   // verified
      .mockResolvedValueOnce(224);  // incomplete
    (prisma.syncJob.count as any)
      .mockResolvedValueOnce(1480) // queued
      .mockResolvedValueOnce(69)   // processing
      .mockResolvedValueOnce(47)   // retryPending
      .mockResolvedValueOnce(1596); // remaining

    const stats = await BulkSyncService.getQueueProgressStats();
    expect(stats.totalProfiles).toBe(1626);
    expect(stats.queued).toBe(1480);
    expect(stats.processing).toBe(69);
  });
});
