import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/dashboard/leaderboard-cache/route";

// Mock the Next.js cache so it executes the callback immediately
vi.mock("next/cache", () => ({
  unstable_cache: (cb: any) => cb,
}));

// Mock Prisma
const mockFindMany = vi.fn().mockResolvedValue([]);
const mockCount = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      leaderboardEntry: {
        findMany: (...args: any) => mockFindMany(...args),
        count: (...args: any) => mockCount(...args),
      },
    },
    default: {
      leaderboardEntry: {
        findMany: (...args: any) => mockFindMany(...args),
        count: (...args: any) => mockCount(...args),
      },
    }
  };
});

vi.mock("@/lib/auth", () => ({
  requireLeaderboardAccess: vi.fn().mockResolvedValue({ id: "user-1", role: "ADMIN" }),
}));

describe("LeetCode Sorting Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sort LeetCode students correctly by totalSolved in descending order as the primary metric, with tie-breakers", async () => {
    const req = new NextRequest("http://localhost/api/dashboard/leaderboard-cache?platform=leetcode");
    await GET(req);

    // The first call is the count, the second is findMany.
    // Wait, the cache callback executes Promise.all([findMany, count])
    expect(mockFindMany).toHaveBeenCalled();
    const findManyArgs = mockFindMany.mock.calls[0][0];

    // Check orderBy array
    expect(findManyArgs.orderBy).toEqual([
      { student: { leetcodeProfile: { problemsSolved: { sort: "desc", nulls: "last" } } } },
      { student: { leetcodeProfile: { hardSolvedCount: { sort: "desc", nulls: "last" } } } },
      { student: { leetcodeProfile: { mediumSolvedCount: { sort: "desc", nulls: "last" } } } },
      { student: { leetcodeProfile: { easySolvedCount: { sort: "desc", nulls: "last" } } } },
      { student: { leetcodeProfile: { contestRating: { sort: "desc", nulls: "last" } } } },
      { overallScore: "desc" },
      { codechefScore: "desc" },
      { leetcodeScore: "desc" },
      { student: { rollNumber: "asc" } },
      { student: { id: "asc" } }
    ]);
  });
});
