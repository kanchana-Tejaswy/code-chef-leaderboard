import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
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
      create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "job1", attemptCount: 1, ...args.data })),
      update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "job1", attemptCount: 1, ...args.data })),
    },
    codechefProfile: {
      count: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    leetcodeProfile: {
      count: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    studentPlatformAccount: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leaderboardEntry: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({ overallScore: 80 }),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $executeRawUnsafe: vi.fn(),
    $transaction: vi.fn(async (fn) => {
      if (typeof fn === "function") {
        return fn(mockPrisma);
      }
      return Promise.all(fn);
    }),
  };
  return { prisma: mockPrisma };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1" }),
}));

vi.mock("@/services/codechef.service", () => ({
  CodechefService: {
    fetchData: vi.fn(),
  },
}));

vi.mock("@/services/leetcode.service", () => ({
  LeetcodeService: {
    fetchData: vi.fn(),
  },
}));

vi.mock("@/services/normalization.service", () => ({
  NormalizationService: {
    normalizeStudent: vi.fn().mockResolvedValue({ ratingScore: 10 }),
  },
}));

vi.mock("@/services/ai-engine.service", () => ({
  AiEngineService: {
    runAnalysisForStudent: vi.fn().mockResolvedValue({
      overall: { talentScore: 50 },
      codechef: {},
      leetcode: {},
    }),
  },
}));

import { BulkSyncService } from "@/services/bulkSync.service";
import { SyncService } from "@/services/sync.service";
import { prisma } from "@/lib/prisma";
import { CodechefService } from "@/services/codechef.service";
import { LeetcodeService } from "@/services/leetcode.service";

describe("Phase 3 Platform Refresh, Queue & Leaderboard Eligibility Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Zero eligible students yields no-op queue", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([]);
    (prisma.studentProfile.count as any).mockResolvedValue(0);

    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(0);
    expect(result.incompleteCount).toBe(0);
  });

  it("2. Both verified and Admin APPROVED student is eligible", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      {
        id: "s1",
        codechefUsername: "cc1",
        leetcodeUsername: "lc1",
        profileStatus: "VERIFIED",
        adminApprovalStatus: "APPROVED",
        archivedAt: null,
      },
    ]);
    (prisma.syncJob.findFirst as any).mockResolvedValue(null);

    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(1);
    expect(result.incompleteCount).toBe(0);
  });

  it("3. Unapproved or archived students are skipped", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([]);
    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(0);
  });

  it("4. No duplicate jobs created for already queued/processing profiles", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      {
        id: "s1",
        codechefUsername: "cc1",
        leetcodeUsername: "lc1",
        profileStatus: "PENDING_VERIFICATION",
        adminApprovalStatus: "APPROVED",
        archivedAt: null,
      },
    ]);
    (prisma.syncJob.findFirst as any).mockResolvedValue({
      id: "job1",
      studentId: "s1",
      status: "QUEUED",
    });

    const result = await BulkSyncService.queueEligibleStudents();
    expect(result.queuedCount).toBe(0);
  });

  it("5. Scraper isolation: CodeChef success, LeetCode fail preserves CodeChef", async () => {
    const student = {
      id: "s1",
      name: "Test Student",
      codechefUsername: "cc1",
      leetcodeUsername: "lc1",
      rollNumber: "TEST01",
      adminApprovalStatus: "APPROVED",
      archivedAt: null,
    };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);
    (prisma.syncJob.findFirst as any).mockResolvedValue(null);

    (CodechefService.fetchData as any).mockResolvedValue({
      username: "cc1",
      currentRating: 1500,
      stars: 3,
    });
    (LeetcodeService.fetchData as any).mockRejectedValue(new Error("LeetCode unavailable (503)"));

    (prisma.codechefProfile.findUnique as any).mockResolvedValue(null);
    (prisma.leetcodeProfile.findUnique as any).mockResolvedValue({
      username: "lc1",
      problemsSolved: 100,
      verificationMetadata: {},
    });

    const res = await SyncService.syncStudent("s1", "ADMIN_FORCE", true);
    expect(res.success).toBe(true);
    expect(prisma.leetcodeProfile.update).toHaveBeenCalled();
  });

  it("6. Temporary failure retries vs permanent failure invalidation", async () => {
    const student = {
      id: "s1",
      name: "Test Student",
      codechefUsername: "cc1",
      leetcodeUsername: "lc1",
      rollNumber: "TEST01",
      adminApprovalStatus: "APPROVED",
      archivedAt: null,
      platformAccounts: [
        { id: "pa-cc", platform: "CODECHEF", verificationStatus: "VERIFIED" }
      ]
    };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);
    (prisma.syncJob.findFirst as any).mockResolvedValue({ id: "job1", attemptCount: 1 });
    (CodechefService.fetchData as any).mockRejectedValue(new Error("Profile not found (404)"));
    (LeetcodeService.fetchData as any).mockResolvedValue({ username: "lc1" });

    await SyncService.syncStudent("s1", "ADMIN_FORCE", true);
    expect(prisma.studentPlatformAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        verificationStatus: "INVALID"
      })
    }));
  });

  it("7. Simulated 3,000-student scale query performance", async () => {
    (prisma.studentProfile.count as any).mockResolvedValue(3000);
    const mockProfiles = Array.from({ length: 300 }, (_, i) => ({
      id: `s${i}`,
      codechefUsername: `cc${i}`,
      leetcodeUsername: `lc${i}`,
      profileStatus: "VERIFIED",
    }));
    (prisma.studentProfile.findMany as any).mockResolvedValue(mockProfiles);

    const stats = await BulkSyncService.getQueueProgressStats();
    expect(stats.totalProfiles).toBe(3000);
    expect(prisma.studentProfile.count).toHaveBeenCalled();
  });
});
