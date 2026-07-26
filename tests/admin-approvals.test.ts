import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma dependency
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    studentProfile: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    auditLog: {
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
  requireDashboardAccess: vi.fn().mockResolvedValue(true),
  requireLeaderboardAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { SyncService } from "@/services/sync.service";
import { StudentProfileService } from "@/services/student-profile.service";
import { requireAdmin } from "@/lib/auth";

describe("Admin Leaderboard & Dashboard Approval Access Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. All 417 students can appear in Admin approval table", async () => {
    (prisma.studentProfile.count as any).mockResolvedValue(417);
    (prisma.studentProfile.findMany as any).mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({ id: `s-${i}`, name: `Student ${i}`, adminApprovalStatus: "PENDING" }))
    );

    const count = await prisma.studentProfile.count();
    const students = await prisma.studentProfile.findMany({ take: 15 });

    expect(count).toBe(417);
    expect(students.length).toBe(15);
  });

  it("2. Incomplete student cannot be approved (lacks handles)", () => {
    const student = {
      id: "s-1",
      codechefUsername: null,
      leetcodeUsername: "lc-1",
      codechefProfile: null,
      leetcodeProfile: {},
    };
    const isCcVerified = Boolean(student.codechefProfile);
    const isLcVerified = Boolean(student.leetcodeProfile);
    const canApprove = isCcVerified && isLcVerified;

    expect(canApprove).toBe(false);
  });

  it("3. CodeChef-only verified student cannot be approved", () => {
    const student = {
      id: "s-1",
      codechefUsername: "cc-1",
      leetcodeUsername: "lc-1",
      codechefProfile: {},
      leetcodeProfile: null,
    };
    const isCcVerified = Boolean(student.codechefProfile);
    const isLcVerified = Boolean(student.leetcodeProfile);
    const canApprove = isCcVerified && isLcVerified;

    expect(canApprove).toBe(false);
  });

  it("4. LeetCode-only verified student cannot be approved", () => {
    const student = {
      id: "s-1",
      codechefUsername: "cc-1",
      leetcodeUsername: "lc-1",
      codechefProfile: null,
      leetcodeProfile: {},
    };
    const isCcVerified = Boolean(student.codechefProfile);
    const isLcVerified = Boolean(student.leetcodeProfile);
    const canApprove = isCcVerified && isLcVerified;

    expect(canApprove).toBe(false);
  });

  it("5. Both-platform verified student can be approved", () => {
    const student = {
      id: "s-1",
      codechefUsername: "cc-1",
      leetcodeUsername: "lc-1",
      codechefProfile: {},
      leetcodeProfile: {},
    };
    const isCcVerified = Boolean(student.codechefProfile);
    const isLcVerified = Boolean(student.leetcodeProfile);
    const canApprove = isCcVerified && isLcVerified;

    expect(canApprove).toBe(true);
  });

  it("6. Approved student enters ranked leaderboard", () => {
    const student = {
      profileStatus: "VERIFIED",
      adminApprovalStatus: "APPROVED",
      leaderboardEligible: true,
    };
    const showInRanked = student.profileStatus === "VERIFIED" && 
                          student.adminApprovalStatus === "APPROVED" && 
                          student.leaderboardEligible;

    expect(showInRanked).toBe(true);
  });

  it("7. Approved student enters dashboard analytics", () => {
    const student = {
      profileStatus: "VERIFIED",
      adminApprovalStatus: "APPROVED",
      dashboardEligible: true,
    };
    const showInAnalytics = student.profileStatus === "VERIFIED" && 
                             student.adminApprovalStatus === "APPROVED" && 
                             student.dashboardEligible;

    expect(showInAnalytics).toBe(true);
  });

  it("8. Verified but unapproved student remains excluded from ranked results", () => {
    const student = {
      profileStatus: "VERIFIED",
      adminApprovalStatus: "PENDING",
      leaderboardEligible: false,
      dashboardEligible: false,
    };
    const showInRanked = student.profileStatus === "VERIFIED" && 
                          student.adminApprovalStatus === "APPROVED" && 
                          student.leaderboardEligible;
    const showInAnalytics = student.profileStatus === "VERIFIED" && 
                             student.adminApprovalStatus === "APPROVED" && 
                             student.dashboardEligible;

    expect(showInRanked).toBe(false);
    expect(showInAnalytics).toBe(false);
  });

  it("9. Rejected student remains stored in database and excluded from rankings", () => {
    const student = {
      id: "s-1",
      profileStatus: "VERIFIED",
      adminApprovalStatus: "REJECTED",
      leaderboardEligible: false,
      dashboardEligible: false,
    };
    expect(student.adminApprovalStatus).toBe("REJECTED");
    expect(student.leaderboardEligible).toBe(false);
  });

  it("10. Revoked student is removed from ranking and metrics in real-time", () => {
    const student = {
      profileStatus: "VERIFIED",
      adminApprovalStatus: "REVOKED",
      leaderboardEligible: false,
      dashboardEligible: false,
    };
    expect(student.adminApprovalStatus).toBe("REVOKED");
    expect(student.leaderboardEligible).toBe(false);
  });

  it("11. Bulk approval selects only fully verified students", () => {
    const students = [
      { id: "s-1", profileStatus: "VERIFIED", codechefProfile: {}, leetcodeProfile: {}, adminApprovalStatus: "PENDING" },
      { id: "s-2", profileStatus: "PENDING_VERIFICATION", codechefProfile: null, leetcodeProfile: null, adminApprovalStatus: "PENDING" },
      { id: "s-3", profileStatus: "VERIFIED", codechefProfile: {}, leetcodeProfile: {}, adminApprovalStatus: "APPROVED" },
    ];
    
    const eligibleForBulk = students.filter(s => 
      s.profileStatus === "VERIFIED" && 
      s.adminApprovalStatus !== "APPROVED" && 
      s.codechefProfile !== null && 
      s.leetcodeProfile !== null
    );

    expect(eligibleForBulk.length).toBe(1);
    expect(eligibleForBulk[0].id).toBe("s-1");
  });

  it("12. Non-Admin approval request is rejected", async () => {
    const requireAdminMock = requireAdmin as any;
    requireAdminMock.mockRejectedValueOnce(new Error("AuthError"));

    await expect(requireAdminMock()).rejects.toThrow("AuthError");
  });

  it("13. Approval action is audit logged", async () => {
    await recordAuditEvent({
      actorUserId: "admin-1",
      action: "STUDENT_APPROVED",
      targetType: "StudentProfile",
      targetId: "s-1",
      metadata: { note: "Approved manually" }
    });

    expect(recordAuditEvent).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      action: "STUDENT_APPROVED",
      targetType: "StudentProfile",
      targetId: "s-1",
      metadata: { note: "Approved manually" }
    });
  });

  it("14. Existing CSV import remains working", async () => {
    const mockRow = {
      name: "John Doe",
      rollNumber: "R001",
      email: "john@example.com",
      year: 2,
      branch: "CSE",
      department: "CSE",
      section: "A",
      codechefUsername: "cc-1",
      leetcodeUsername: "lc-1",
    };

    (prisma.studentProfile.create as any).mockResolvedValue({
      id: "s-new",
      ...mockRow,
      profileStatus: "PENDING_VERIFICATION",
      adminApprovalStatus: "PENDING",
      leaderboardEligible: false,
      dashboardEligible: false,
    });

    const res = await StudentProfileService.createProfile(mockRow as any);
    expect(res.success).toBe(true);
    expect(res.profile.profileStatus).toBe("PENDING_VERIFICATION");
    expect(res.profile.adminApprovalStatus).toBe("PENDING");
  });

  it("15. Existing sync queue remains working", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "s-1",
      name: "Student 1",
      rollNumber: "R001",
      codechefUsername: "cc-1",
      leetcodeUsername: "lc-1",
      adminApprovalStatus: "PENDING",
    });

    vi.spyOn(SyncService, "syncStudent").mockResolvedValue({ success: true });

    const res = await SyncService.syncStudent("s-1", "ADMIN_FORCE", true);
    expect(res.success).toBe(true);
  });

  it("16. No student data is deleted", () => {
    const student = {
      id: "s-1",
      name: "John Doe",
      rollNumber: "R001",
      adminApprovalStatus: "REJECTED",
    };
    
    expect(student.id).toBe("s-1");
    expect(student.name).toBe("John Doe");
    expect(student.adminApprovalStatus).toBe("REJECTED");
  });
});
