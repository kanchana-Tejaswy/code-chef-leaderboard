import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContestDiscoveryService } from "../src/services/contest-discovery.service";
import { ContestSyncService } from "../src/services/contest-sync.service";
import { prisma } from "../src/lib/prisma";
import { ContestPlatform, ContestStatus, UserRole, AccountStatus } from "@prisma/client";
import { GET as getContests } from "../src/app/api/contests/route";
import { GET as getContestDetail } from "../src/app/api/contests/[slug]/route";
import { GET as getParticipants } from "../src/app/api/contests/[slug]/participants/route";
import { GET as getStats } from "../src/app/api/contests/[slug]/stats/route";
import { NextRequest } from "next/server";

// Mock prisma client
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    contest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    codechefProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    studentEnrollment: {
      findFirst: vi.fn(),
    },
    contestParticipation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    leaderboardEntry: {
      findMany: vi.fn(),
    },
  },
}));

// Mock auth helpers
const mockRequireActiveUser = vi.fn();
const mockRequireAdmin = vi.fn();

vi.mock("../src/lib/auth", () => ({
  requireActiveUser: () => mockRequireActiveUser(),
  requireAdmin: () => mockRequireAdmin(),
}));

// Mock sync service to prevent external calls
vi.mock("../src/services/sync.service", () => ({
  SyncService: {
    syncStudent: vi.fn().mockResolvedValue({ success: true }),
    recalculateLeaderboardRanks: vi.fn().mockResolvedValue(true),
  },
}));

describe("Phase 5 Contest Analytics Backend Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Contest Metadata Discovery Normalization", () => {
    it("fetches, normalizes, and upserts contests from CodeChef API", async () => {
      const mockContestList = {
        present_contests: [],
        future_contests: [
          {
            contest_id: "123",
            contest_code: "START99B",
            contest_name: "Starters 99 Division 2",
            contest_start_date_iso: "2026-08-15T20:00:00+05:30",
            contest_end_date_iso: "2026-08-15T22:00:00+05:30",
            contest_duration: "120",
          },
        ],
        past_contests: [
          {
            contest_id: "124",
            contest_code: "START98B",
            contest_name: "Starters 98 Division 2",
            contest_start_date_iso: "2026-08-01T20:00:00+05:30",
            contest_end_date_iso: "2026-08-01T22:00:00+05:30",
            contest_duration: "120",
          },
        ],
      };

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockContestList,
      } as Response);

      const result = await ContestDiscoveryService.discoverContests();

      expect(result.discovered).toBe(2);
      expect(result.upserted).toBe(2);
      expect(prisma.contest.upsert).toHaveBeenCalledTimes(2);

      // Verify normalization parameters
      expect(prisma.contest.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            platform_platformContestId: {
              platform: ContestPlatform.CODECHEF,
              platformContestId: "START99B",
            },
          },
          create: expect.objectContaining({
            platform: ContestPlatform.CODECHEF,
            platformContestId: "START99B",
            name: "Starters 99 Division 2",
            slug: "codechef-start99b",
            status: ContestStatus.UPCOMING,
          }),
        })
      );
    });
  });

  describe("2. Contest Results Synchronization & Student Matching", () => {
    it("matches verified student handles and attaches correct historical enrollment", async () => {
      // Setup mock data
      const mockContest = {
        id: "contest-uuid",
        platform: ContestPlatform.CODECHEF,
        platformContestId: "START98B",
        name: "Starters 98 Division 2",
        slug: "codechef-start98b",
        startTime: new Date("2026-08-01T20:00:00+05:30"),
        endTime: new Date("2026-08-01T22:00:00+05:30"),
      };

      const mockStudents = [
        {
          id: "student-1",
          name: "Alice",
          rollNumber: "22CS001",
          codechefUsername: "alice_cc",
          profileStatus: "VERIFIED",
          codechefProfile: {
            id: "profile-1",
            username: "alice_cc",
            studentId: "student-1",
            lastFetchedAt: new Date("2026-08-05T00:00:00Z"),
            contestHistory: [
              { contest: "START98B", rank: "15", rating: "1650" },
              { contest: "START97B", rank: "42", rating: "1600" },
            ],
          },
        },
      ];

      const mockEnrollment = {
        id: "enrollment-uuid",
        studentId: "student-1",
        cohortId: "cohort-uuid",
        departmentId: "dept-uuid",
      };

      vi.mocked(prisma.contest.findFirst).mockResolvedValue(mockContest as any);
      vi.mocked(prisma.studentProfile.findMany).mockResolvedValue(mockStudents as any);
      vi.mocked(prisma.codechefProfile.findMany).mockResolvedValue([mockStudents[0].codechefProfile] as any);
      vi.mocked(prisma.studentEnrollment.findFirst).mockResolvedValue(mockEnrollment as any);
      vi.mocked(prisma.contestParticipation.findUnique).mockResolvedValue(null);

      const summary = await ContestSyncService.syncContestResults("contest-uuid");

      expect(summary.eligibleHandles).toBe(1);
      expect(summary.matchedParticipants).toBe(1);
      expect(summary.recordsInserted).toBe(1);
      expect(summary.nonparticipants).toBe(0);

      expect(prisma.contestParticipation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            contestId: "contest-uuid",
            studentId: "student-1",
            studentEnrollmentId: "enrollment-uuid",
            rank: 15,
            ratingAfter: 1650,
            ratingBefore: null,
            ratingChange: null,
          }),
        })
      );
    });
  });

  describe("3. API Scoping and Permissions Checks", () => {
    it("scopes GET /api/contests results for HODs based on their departmentId", async () => {
      const mockHOD = {
        id: "hod-user",
        email: "hod_cs@ace.edu.in",
        role: UserRole.HOD,
        status: AccountStatus.ACTIVE,
        departmentId: "cs-dept-uuid",
      };

      mockRequireActiveUser.mockResolvedValue(mockHOD);

      const mockContests = [
        { id: "c1", platform: "CODECHEF", name: "Contest 1", slug: "c1", startTime: new Date() },
      ];

      vi.mocked(prisma.contest.count).mockResolvedValue(1);
      vi.mocked(prisma.contest.findMany).mockResolvedValue(mockContests as any);
      vi.mocked(prisma.contestParticipation.groupBy).mockResolvedValue([
        { contestId: "c1", _count: { id: 5 } },
      ] as any);

      const request = new NextRequest("http://localhost/api/contests?page=1&limit=10");
      const res = await getContests(request);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data[0].participantCount).toBe(5);

      // Verify HOD department filtering was passed to group-by count
      expect(prisma.contestParticipation.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentEnrollment: {
              departmentId: "cs-dept-uuid",
            },
          }),
        })
      );
    });

    it("aggregates stats scoped to HOD's department in GET /api/contests/[slug]/stats", async () => {
      const mockHOD = {
        id: "hod-user",
        role: UserRole.HOD,
        status: AccountStatus.ACTIVE,
        departmentId: "cs-dept-uuid",
      };

      mockRequireActiveUser.mockResolvedValue(mockHOD);

      const mockContest = {
        id: "c1",
        name: "Contest 1",
        slug: "c1",
        startTime: new Date(),
        endTime: new Date(),
      };

      const mockParticipations = [
        {
          studentId: "s1",
          rank: 10,
          ratingChange: 15,
          student: { name: "Alice", rollNumber: "1" },
          studentEnrollment: {
            department: { code: "CS" },
            cohort: { code: "2026" },
            classSection: { name: "Section A" },
          },
        },
      ];

      vi.mocked(prisma.contest.findUnique).mockResolvedValue(mockContest as any);
      vi.mocked(prisma.contestParticipation.findMany).mockResolvedValue(mockParticipations as any);
      vi.mocked(prisma.studentProfile.count).mockResolvedValue(10);

      const res = await getStats(new NextRequest("http://localhost/api/contests/c1/stats"), {
        params: Promise.resolve({ slug: "c1" }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.stats.participantCount).toBe(1);
      expect(body.breakdowns.department.CS).toBe(1);
      expect(body.breakdowns.cohort["2026"]).toBe(1);

      // Verify departmentId filter was applied
      expect(prisma.contestParticipation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentEnrollment: {
              departmentId: "cs-dept-uuid",
            },
          }),
        })
      );
    });
  });
});
