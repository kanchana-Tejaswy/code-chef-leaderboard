import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";

// Global mock state
let mockSessionUser: any = null;
let mockSupabaseUser: any = null;

vi.mock("next/cache", () => ({
  unstable_cache: (cb: any) => cb,
}));

// Mock database
vi.mock("@/lib/prisma", () => {
  const mockFindManyLeaderboard = vi.fn().mockResolvedValue([]);
  const mockPrisma = {
    studentProfile: {
      count: vi.fn().mockResolvedValue(100),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: "student-123", name: "Alice", department: "CSE" }),
      update: vi.fn().mockResolvedValue({ id: "student-123" }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    userAccess: {
      findUnique: vi.fn().mockImplementation(() => {
        if (mockSessionUser) return mockSessionUser;
        return null;
      }),
      update: vi.fn().mockImplementation(({ data }: any) => {
        if (mockSessionUser) {
          mockSessionUser = { ...mockSessionUser, ...data };
          return mockSessionUser;
        }
        return null;
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-123" }),
    },
    leaderboardEntry: {
      count: vi.fn().mockResolvedValue(100),
      findMany: mockFindManyLeaderboard,
      aggregate: vi.fn().mockResolvedValue({ _avg: { overallScore: 80 }, _max: { overallScore: 100 } }),
    },
    codechefProfile: {
      count: vi.fn().mockResolvedValue(50),
      aggregate: vi.fn().mockResolvedValue({ _avg: { currentRating: 80, stars: 3, contestCount: 5 } }),
    },
    leetcodeProfile: {
      count: vi.fn().mockResolvedValue(50),
      aggregate: vi.fn().mockResolvedValue({ _avg: { contestRating: 80, problemsSolved: 80, acceptanceRate: 80 } }),
    },
    githubProfile: {
      count: vi.fn().mockResolvedValue(50),
      aggregate: vi.fn().mockResolvedValue({ _avg: { totalRepositories: 10, totalStars: 10, openSourceScore: 10 } }),
    },
    syncHistory: {
      count: vi.fn().mockResolvedValue(10),
    },
    syncJob: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  return { prisma: mockPrisma };
});

// Mock auth guards
vi.mock("@/lib/auth", () => {
  class AuthError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  }

  return {
    AuthError,
    requireRole: vi.fn(async (...allowedRoles: any[]) => {
      if (!mockSessionUser) {
        throw new AuthError("Unauthorized", "UNAUTHORIZED");
      }
      if (!allowedRoles.includes(mockSessionUser.role)) {
        throw new AuthError("Forbidden", "FORBIDDEN_ROLE");
      }
      return mockSessionUser;
    }),
    requireAdmin: vi.fn(async () => {
      if (!mockSessionUser || mockSessionUser.role !== "ADMIN") {
        throw new AuthError("Forbidden", "FORBIDDEN_ROLE");
      }
      return mockSessionUser;
    }),
    requireStaffReadAccess: vi.fn(async () => {
      if (!mockSessionUser || (mockSessionUser.role !== "ADMIN" && mockSessionUser.role !== "GK_SIR" && mockSessionUser.role !== "HOD")) {
        throw new AuthError("Forbidden", "FORBIDDEN_ROLE");
      }
      return mockSessionUser;
    }),
    requireLeaderboardAccess: vi.fn(async () => {
      if (!mockSessionUser) {
        throw new AuthError("Unauthorized", "UNAUTHORIZED");
      }
      const allowed = ["ADMIN", "GK_SIR", "HOD", "STUDENT"];
      if (!allowed.includes(mockSessionUser.role)) {
        throw new AuthError("Forbidden", "FORBIDDEN_ROLE");
      }
      return mockSessionUser;
    }),
    requireDashboardAccess: vi.fn(async () => {
      if (!mockSessionUser) {
        throw new AuthError("Unauthorized", "UNAUTHORIZED");
      }
      const allowed = ["ADMIN"];
      if (!allowed.includes(mockSessionUser.role)) {
        throw new AuthError("Forbidden", "FORBIDDEN_ROLE");
      }
      return mockSessionUser;
    }),
    requireStudentProfileReadAccess: vi.fn(async (id: string) => {
      if (!mockSessionUser) {
        throw new AuthError("Unauthorized", "UNAUTHORIZED");
      }
      return mockSessionUser;
    }),
    getRoleHomePath: vi.fn(() => "/leaderboard"),
  };
});

// Mock Supabase
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockSupabaseUser },
        error: mockSupabaseUser ? null : new Error("No user")
      })),
      updateUser: vi.fn(async () => ({ error: null }))
    }
  }))
}));

// Mock audit service
vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn(async () => {}),
  AuditAction: {
    ACCOUNT_ACTIVATED: "ACCOUNT_ACTIVATED"
  }
}));

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { GET as handleStudentApprovals } from "../src/app/api/admin/student-approvals/route";
import { GET as handleProfileDetails } from "../src/app/api/profile/details/route";
import { GET as handleAnalytics } from "../src/app/api/analytics/route";
import { POST as handleSetPassword } from "../src/app/api/auth/set-password/route";
import { GET as handleLeaderboard } from "../src/app/api/leaderboard/route";
import { GET as handleLeaderboardCache } from "../src/app/api/dashboard/leaderboard-cache/route";
import { GET as handleDashboardStats } from "../src/app/api/dashboard/stats/route";
import { POST as handleBulkApprove } from "../src/app/api/admin/student-approvals/bulk-approve/route";

describe("GK_SIR Scopes, Write Locks, and Audit Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = null;
    mockSupabaseUser = null;
  });

  it("1. GK_SIR has institution-wide read scope on student approvals directory", async () => {
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/admin/student-approvals?page=1&limit=20");
    await handleStudentApprovals(req);

    // Verify findMany was called with no department restriction in where clause
    expect(prisma.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { archivedAt: null }
      })
    );
  });

  it("2. HOD has department-scoped read access on student approvals directory", async () => {
    mockSessionUser = {
      id: "hod-1",
      role: "HOD",
      departmentId: "CSE",
      email: "hod@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/admin/student-approvals?page=1&limit=20");
    await handleStudentApprovals(req);

    // Verify findMany was called with department set to CSE
    expect(prisma.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          department: "CSE"
        })
      })
    );
  });

  it("3. GK_SIR viewing student profile details logs GK_SIR_VIEWED_STUDENT event", async () => {
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/profile/details?userId=student-123");
    await handleProfileDetails(req);

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "gk-1",
        action: "GK_SIR_VIEWED_STUDENT",
        targetId: "student-123"
      })
    );
  });

  it("4. GK_SIR exporting student directory logs GK_SIR_EXPORTED_REPORT event", async () => {
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/admin/student-approvals?export=true");
    await handleStudentApprovals(req);

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "gk-1",
        action: "GK_SIR_EXPORTED_REPORT"
      })
    );
  });

  it("5. GK_SIR viewing Analytics logs GK_SIR_VIEWED_ANALYTICS event", async () => {
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/analytics");
    await handleAnalytics(req);

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "gk-1",
        action: "GK_SIR_VIEWED_ANALYTICS"
      })
    );
  });

  it("6. GK_SIR password activation logs GK_SIR_PASSWORD_CHANGED event", async () => {
    mockSupabaseUser = { id: "supa-gk" };
    mockSessionUser = {
      id: "gk-1",
      authUserId: "supa-gk",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      mustSetPassword: true,
      status: "PENDING"
    };

    const req = new NextRequest("http://localhost/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "aB3$kL9#mP1!qZ8&", confirmPassword: "aB3$kL9#mP1!qZ8&" })
    });
    const res = await handleSetPassword(req);

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "gk-1",
        action: "GK_SIR_PASSWORD_CHANGED"
      })
    );
  });

  it("7. ADMIN can load all institution leaderboard data", async () => {
    mockSessionUser = {
      id: "admin-1",
      role: "ADMIN",
      email: "admin@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/leaderboard?mode=ranked");
    const res = await handleLeaderboard(req);
    expect(res.status).toBe(200);

    // Verify no department filter was applied
    const mockPrisma = (await import("@/lib/prisma")).prisma;
    expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          student: expect.objectContaining({
            department: expect.anything()
          })
        })
      })
    );
  });

  it("8. GK_SIR can load all institution-wide leaderboard data", async () => {
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/leaderboard?mode=ranked");
    const res = await handleLeaderboard(req);
    expect(res.status).toBe(200);

    // Verify no department filter was applied
    const mockPrisma = (await import("@/lib/prisma")).prisma;
    expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          student: expect.objectContaining({
            department: expect.anything()
          })
        })
      })
    );
  });

  it("9. HOD can load only department-scoped leaderboard data", async () => {
    mockSessionUser = {
      id: "hod-1",
      role: "HOD",
      departmentId: "CSE",
      email: "hod@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/leaderboard?mode=ranked");
    const res = await handleLeaderboard(req);
    expect(res.status).toBe(200);

    // Verify department filter was applied to CSE
    const mockPrisma = (await import("@/lib/prisma")).prisma;
    expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          student: expect.objectContaining({
            department: "CSE"
          })
        })
      })
    );
  });

  it("10. GK_SIR cannot access /api/dashboard/stats API", async () => {
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/dashboard/stats");
    const res = await handleDashboardStats(req);
    expect(res.status).toBe(403);
  });

  it("11. GK_SIR cannot call Admin write APIs", async () => {
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/admin/student-approvals/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: ["student-1"] })
    });
    const res = await handleBulkApprove(req);
    expect(res.status).toBe(403);
  });

  it("12. Dashboard stats API remains ADMIN-only", async () => {
    mockSessionUser = {
      id: "admin-1",
      role: "ADMIN",
      email: "admin@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/dashboard/stats");
    const res = await handleDashboardStats(req);
    expect(res.status).toBe(200);
  });

  it("13. Leaderboard API does not depend on Dashboard access", async () => {
    // Leaderboard access allows GK_SIR
    mockSessionUser = {
      id: "gk-1",
      role: "GK_SIR",
      email: "gksir@aceec.ac.in",
      status: "ACTIVE"
    };

    const req = new NextRequest("http://localhost/api/leaderboard?mode=ranked");
    const res = await handleLeaderboard(req);
    expect(res.status).toBe(200);
  });
});
