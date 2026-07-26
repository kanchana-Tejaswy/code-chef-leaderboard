import { describe, it, expect, beforeEach, vi } from "vitest";

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
    $transaction: vi.fn(async (fn) => typeof fn === "function" ? fn(prisma) : Promise.all(fn)),
  },
}));

vi.mock("@/services/sync.service", () => ({
  SyncService: {
    syncStudent: vi.fn(),
    recalculateLeaderboardRanks: vi.fn(),
  },
}));

import { BulkSyncService } from "@/services/bulkSync.service";
import { prisma } from "@/lib/prisma";
import { GET as cronGet } from "@/app/api/cron/route";

describe("Queue and stage behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes exclusive stage totals that sum to 417", () => {
    const students = Array.from({ length: 417 }, (_, index) => ({
      id: `s-${index}`,
      profileStatus: index % 4 === 0 ? "VERIFIED" : index % 4 === 1 ? "PENDING_VERIFICATION" : "INCOMPLETE",
      adminApprovalStatus: index % 7 === 0 ? "APPROVED" : index % 7 === 1 ? "REJECTED" : index % 7 === 2 ? "REVOKED" : "PENDING",
      codechefUsername: index % 3 === 0 ? "cc" : null,
      leetcodeUsername: index % 5 === 0 ? "lc" : null,
    }));

    const summary = BulkSyncService.getExclusiveStageCounts(students);
    const total = Object.values(summary).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(417);
    expect(summary.APPROVED).toBeGreaterThan(0);
    expect(summary.VERIFIED_AWAITING_APPROVAL).toBeGreaterThan(0);
  });

  it("prevents duplicate active jobs from being claimed", async () => {
    const queuedJobs = [
      { id: "job-1", studentId: "s-1", status: "QUEUED", attemptCount: 0, lastAttemptedAt: null, createdAt: new Date() },
      { id: "job-2", studentId: "s-1", status: "QUEUED", attemptCount: 0, lastAttemptedAt: null, createdAt: new Date() },
    ];

    const tx = {
      syncJob: {
        findMany: vi.fn().mockImplementation(async (args?: any) => {
          if (args?.where?.id?.in) {
            return queuedJobs.filter((job) => args.where.id.in.includes(job.id));
          }
          return queuedJobs;
        }),
        findFirst: vi.fn().mockResolvedValue({ id: "job-1", status: "PROCESSING" }),
        update: vi.fn().mockResolvedValue({} ),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));

    const claimed = await BulkSyncService.claimJobs(2);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].id).toBe("job-1");
  });

  it("recovers stale processing jobs safely", async () => {
    const oldDate = new Date(Date.now() - 30 * 60 * 1000);
    const tx = {
      syncJob: {
        findMany: vi.fn().mockResolvedValue([
          { id: "job-stale", studentId: "s-stale", status: "PROCESSING", attemptCount: 1, lastAttemptedAt: oldDate, updatedAt: oldDate },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));

    const recovered = await BulkSyncService.recoverStuckJobs();
    expect(recovered).toHaveLength(1);
    expect(recovered[0].status).toBe("RETRY_PENDING");
  });

  it("rejects unauthorized cron requests", async () => {
    const request = new Request("https://example.com/api/cron");
    const response = await cronGet(request as any);
    expect(response.status).toBe(401);
  });
});
