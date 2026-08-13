import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getContests } from "../src/app/api/contests/route";
import { GET as getParticipants } from "../src/app/api/contests/[slug]/participants/route";
import { GET as getStats } from "../src/app/api/contests/[slug]/stats/route";
import { POST as syncContest } from "../src/app/api/admin/contests/sync/route";
import { prisma } from "../src/lib/prisma";
import { NextRequest } from "next/server";
import { ContestPlatform, ContestStatus, UserRole, AccountStatus } from "@prisma/client";

// Mock Prisma
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    contest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    studentProfile: {
      count: vi.fn(),
    },
    contestParticipation: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

const mockRequireActiveUser = vi.fn();
const mockRequireAdmin = vi.fn();

vi.mock("../src/lib/auth", () => ({
  requireActiveUser: () => mockRequireActiveUser(),
  requireAdmin: () => mockRequireAdmin(),
}));

vi.mock("../src/services/contest-discovery.service", () => ({
  ContestDiscoveryService: {
    discoverContests: vi.fn().mockResolvedValue({ discovered: 5, upserted: 5, errors: [] }),
  },
}));

vi.mock("../src/services/contest-sync.service", () => ({
  ContestSyncService: {
    syncContestResults: vi.fn().mockResolvedValue({
      eligibleHandles: 10,
      matchedParticipants: 5,
      nonparticipants: 5,
      recordsInserted: 5,
      recordsUpdated: 0,
      fetchFailures: 0,
    }),
  },
}));

describe("Phase 5 Contest Analytics UI Integration & Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Live/Upcoming/Past Classification & Filters", () => {
    it("fetches list of contests using search and platform parameters", async () => {
      mockRequireActiveUser.mockResolvedValue({
        id: "user-1",
        role: UserRole.STUDENT,
        status: AccountStatus.ACTIVE,
      });

      const contestsData = [
        {
          id: "contest-1",
          name: "Starters 251",
          platform: ContestPlatform.CODECHEF,
          status: ContestStatus.COMPLETED,
        },
      ];

      vi.mocked(prisma.contest.findMany).mockResolvedValue(contestsData as any);
      vi.mocked(prisma.contest.count).mockResolvedValue(1);
      vi.mocked(prisma.contestParticipation.groupBy).mockResolvedValue([]);

      const req = new NextRequest(
        "http://localhost/api/contests?platform=CODECHEF&status=COMPLETED&search=Starters"
      );
      const res = await getContests(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data[0].name).toBe("Starters 251");
      expect(prisma.contest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: "CODECHEF",
            status: "COMPLETED",
          }),
        })
      );
    });
  });

  describe("2. STUDENT vs ADMIN Sync Control Permissions", () => {
    it("allows ADMIN to invoke metadata sync", async () => {
      mockRequireAdmin.mockResolvedValue({
        id: "admin-1",
        role: UserRole.ADMIN,
        status: AccountStatus.ACTIVE,
      });

      const req = new NextRequest("http://localhost/api/admin/contests/sync", {
        method: "POST",
        body: JSON.stringify({ action: "discover" }),
      });
      const res = await syncContest(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain("Contest discovery completed");
    });

    it("blocks STUDENT from invoking contest sync", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));

      const req = new NextRequest("http://localhost/api/admin/contests/sync", {
        method: "POST",
        body: JSON.stringify({ action: "discover" }),
      });
      const res = await syncContest(req);
      const json = await res.json();

      expect(res.status).toBe(401); // Unauthorized wrapper
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("3. HOD Scoping Filters", () => {
    it("scopes participant list and statistics to HOD's assigned departmentId", async () => {
      mockRequireActiveUser.mockResolvedValue({
        id: "hod-1",
        role: UserRole.HOD,
        departmentId: "dept-cse-uuid",
        status: AccountStatus.ACTIVE,
      });

      const mockContest = { id: "contest-uuid", slug: "starters-251" };
      vi.mocked(prisma.contest.findUnique).mockResolvedValue(mockContest as any);
      vi.mocked(prisma.contestParticipation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contestParticipation.count).mockResolvedValue(0);
      vi.mocked(prisma.studentProfile.count).mockResolvedValue(0);

      // Verify stats API scopes to dept-cse-uuid
      const reqStats = new NextRequest("http://localhost/api/contests/starters-251/stats");
      const resStats = await getStats(reqStats, { params: Promise.resolve({ slug: "starters-251" }) });
      expect(resStats.status).toBe(200);
      expect(prisma.contestParticipation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentEnrollment: {
              departmentId: "dept-cse-uuid",
            },
          }),
        })
      );

      // Verify participant API scopes to dept-cse-uuid
      const reqPart = new NextRequest("http://localhost/api/contests/starters-251/participants");
      const resPart = await getParticipants(reqPart, { params: Promise.resolve({ slug: "starters-251" }) });
      expect(resPart.status).toBe(200);
      expect(prisma.contestParticipation.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentEnrollment: expect.objectContaining({
              departmentId: "dept-cse-uuid",
            }),
          }),
        })
      );
    });
  });

  describe("4. Unavailable Metric & Empty States Handling", () => {
    it("safely resolves N/A metrics and formats them appropriately", async () => {
      mockRequireActiveUser.mockResolvedValue({
        id: "user-1",
        role: UserRole.STUDENT,
        status: AccountStatus.ACTIVE,
      });

      const mockContest = { id: "contest-uuid", slug: "starters-251" };
      vi.mocked(prisma.contest.findUnique).mockResolvedValue(mockContest as any);
      
      // Participations mock with zero results (empty contest stats boundary)
      vi.mocked(prisma.contestParticipation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.studentProfile.count).mockResolvedValue(0);

      const reqStats = new NextRequest("http://localhost/api/contests/starters-251/stats");
      const resStats = await getStats(reqStats, { params: Promise.resolve({ slug: "starters-251" }) });
      const json = await resStats.json();

      expect(resStats.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.stats.highestRank).toBeNull();
      expect(json.stats.averageRank).toBeNull();
      expect(json.stats.averageRatingChange).toBeNull();
    });
  });
});
