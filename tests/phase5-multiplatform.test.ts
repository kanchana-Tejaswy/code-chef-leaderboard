import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContestPlatform, ContestStatus } from "@prisma/client";
import { LeetCodeContestAdapter } from "../src/services/adapters/leetcode-contest.adapter";
import { CodeforcesContestAdapter } from "../src/services/adapters/codeforces-contest.adapter";
import { getAdapterForPlatform } from "../src/services/adapters";
import { prisma } from "../src/lib/prisma";
import { SyncService } from "../src/services/sync.service";

// Mock Prisma
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    contest: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      findMany: vi.fn(),
    },
    leetcodeProfile: {
      findMany: vi.fn(),
    },
    studentEnrollment: {
      findFirst: vi.fn(),
    },
    contestParticipation: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../src/services/sync.service", () => ({
  SyncService: {
    syncStudent: vi.fn().mockResolvedValue({ success: true }),
    recalculateLeaderboardRanks: vi.fn().mockResolvedValue(true),
  },
}));

describe("Phase 5 Contest Analytics Multi-Platform Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Platform Adapter Factory", () => {
    it("returns correct adapter instance for each platform", () => {
      const cc = getAdapterForPlatform(ContestPlatform.CODECHEF);
      const lc = getAdapterForPlatform(ContestPlatform.LEETCODE);
      const cf = getAdapterForPlatform(ContestPlatform.CODEFORCES);

      expect(cc.constructor.name).toBe("CodeChefContestAdapter");
      expect(lc.constructor.name).toBe("LeetCodeContestAdapter");
      expect(cf.constructor.name).toBe("CodeforcesContestAdapter");
    });
  });

  describe("2. LeetCode Contest Discovery", () => {
    it("discovers, filters, and upserts contests from GraphQL API response", async () => {
      // Mock global fetch to return mock LeetCode GraphQL responses
      const mockFetch = vi.fn().mockImplementation((url, options) => {
        const query = JSON.parse(options.body).query;
        if (query.includes("topTwoContests")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  topTwoContests: [
                    {
                      title: "Weekly Contest 514",
                      titleSlug: "weekly-contest-514",
                      startTime: Math.round(Date.now() / 1000) + 100000,
                      duration: 5400,
                    },
                  ],
                },
              }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  pastContests: {
                    data: [
                      {
                        title: "Weekly Contest 513",
                        titleSlug: "weekly-contest-513",
                        startTime: Math.round(Date.now() / 1000) - 100000,
                        duration: 5400,
                      },
                    ],
                  },
                },
              }),
          });
        }
      });
      global.fetch = mockFetch;

      const adapter = new LeetCodeContestAdapter();
      const result = await adapter.discoverContests();

      expect(result.discovered).toBe(2);
      expect(result.upserted).toBe(2);
      expect(prisma.contest.upsert).toHaveBeenCalledTimes(2);

      // Verify upcoming classification
      expect(prisma.contest.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          create: expect.objectContaining({
            platform: ContestPlatform.LEETCODE,
            platformContestId: "weekly-contest-514",
            name: "Weekly Contest 514",
            status: ContestStatus.UPCOMING,
          }),
        })
      );
    });
  });

  describe("3. Codeforces Contest Discovery", () => {
    it("discovers and classifies Codeforces contests", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            result: [
              {
                id: 1900,
                name: "Codeforces Round 900 (Div. 3)",
                phase: "BEFORE",
                startTimeSeconds: Math.round(Date.now() / 1000) + 50000,
                durationSeconds: 7200,
              },
              {
                id: 1899,
                name: "Codeforces Round 899 (Div. 3)",
                phase: "FINISHED",
                startTimeSeconds: Math.round(Date.now() / 1000) - 50000,
                durationSeconds: 7200,
              },
            ],
          }),
      });
      global.fetch = mockFetch;

      const adapter = new CodeforcesContestAdapter();
      const result = await adapter.discoverContests();

      expect(result.discovered).toBe(2);
      expect(result.upserted).toBe(2);
      expect(prisma.contest.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("4. LeetCode Standings Result Sync & Participant Matching", () => {
    it("syncs standings by matching student contestHistory from profile updates", async () => {
      const contestData = {
        id: "contest-uuid",
        platform: ContestPlatform.LEETCODE,
        platformContestId: "weekly-contest-514",
        name: "Weekly Contest 514",
        startTime: new Date(Date.now() - 200000),
        endTime: new Date(Date.now() - 100000),
      };

      vi.mocked(prisma.contest.findFirst).mockResolvedValue(contestData as any);

      const studentsList = [
        {
          id: "student-1",
          name: "Alice",
          leetcodeUsername: "alice-lc",
          leetcodeProfile: {
            studentId: "student-1",
            username: "alice-lc",
            contestHistory: [
              { contest: "Weekly Contest 513", ranking: 1500, rating: 1600 },
              { contest: "Weekly Contest 514", ranking: 400, rating: 1650, problemsSolved: 3, finishTimeInSeconds: 3200 },
            ],
            lastFetchedAt: new Date(Date.now() - 50000),
          },
        },
      ];

      vi.mocked(prisma.studentProfile.findMany).mockResolvedValue(studentsList as any);
      vi.mocked(prisma.leetcodeProfile.findMany).mockResolvedValue([studentsList[0].leetcodeProfile] as any);
      vi.mocked(prisma.studentEnrollment.findFirst).mockResolvedValue({ id: "enrollment-1" } as any);
      vi.mocked(prisma.contestParticipation.findUnique).mockResolvedValue(null);

      const adapter = new LeetCodeContestAdapter();
      const summary = await adapter.syncContestResults("contest-uuid");

      expect(summary.eligibleHandles).toBe(1);
      expect(summary.matchedParticipants).toBe(1);
      expect(summary.recordsInserted).toBe(1);

      // Verify dynamic calculation of ratingChange (1650 - 1600 = 50) and score/penalty
      expect(prisma.contestParticipation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            studentId: "student-1",
            rank: 400,
            ratingAfter: 1650,
            ratingBefore: 1600,
            ratingChange: 50,
            problemsSolved: 3,
            score: 3,
            penalty: 3200,
          }),
        })
      );
      expect(SyncService.recalculateLeaderboardRanks).toHaveBeenCalled();
    });
  });

  describe("5. Codeforces Sync Disabled Validation", () => {
    it("throws error since Codeforces result sync is not supported", async () => {
      const adapter = new CodeforcesContestAdapter();
      await expect(adapter.syncContestResults("cf-contest")).rejects.toThrow(
        /synchronization for Codeforces is currently disabled/
      );
    });
  });
});
