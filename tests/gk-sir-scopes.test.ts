import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";

// Global mock state
let mockSessionUser: any = null;
let mockSupabaseUser: any = null;

// Mock database
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    studentProfile: {
      count: vi.fn().mockResolvedValue(100),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: "student-123", name: "Alice", department: "CSE" }),
      update: vi.fn().mockResolvedValue({ id: "student-123" }),
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
        where: {}
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
});
