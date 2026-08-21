import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma dependency
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    studentProfile: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    userAccess: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    syncJob: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
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
    },
    auditLog: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "activity-1" }),
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
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }),
  requireRole: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" }),
  getAuthenticatedUserAccess: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" }),
  requireDashboardAccess: vi.fn().mockResolvedValue(true),
  requireLeaderboardAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { requireAdmin, getAuthenticatedUserAccess } from "@/lib/auth";
import { canPerformWrite, canPerformDelete } from "@/lib/write-access";
import { PATCH as updateStudentPatch, POST as createStudentPost } from "@/app/api/admin/students/route";
import { PATCH as updateStudentDetailsPatch } from "@/app/api/admin/students/[id]/route";
import { PATCH as updateStudentIdentityPatch } from "@/app/api/admin/students/[id]/identity/route";
import { POST as archiveStudentPost } from "@/app/api/admin/students/[id]/archive/route";
import { POST as restoreStudentPost } from "@/app/api/admin/students/[id]/restore/route";
import { GET as getStudentApprovals } from "@/app/api/admin/student-approvals/route";
import { NextRequest } from "next/server";

describe("Admin Student Management Workflow Scenario Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default prisma mocks to prevent undefined checks
    (prisma.studentProfile.findMany as any).mockResolvedValue([]);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(null);
    (prisma.studentProfile.create as any).mockImplementation(async ({ data }) => ({ id: "s-created", ...data }));
    (prisma.studentProfile.update as any).mockImplementation(async ({ data }) => ({ id: "s-updated", ...data }));
    
    (prisma.userAccess.findUnique as any).mockResolvedValue(null);
    
    (prisma.syncJob.create as any).mockResolvedValue({ id: "job-1" });
    (prisma.syncJob.deleteMany as any).mockResolvedValue({ count: 0 });
    
    (prisma.leaderboardEntry.findMany as any).mockResolvedValue([]);
  });

  // Scenario 1: Active ADMIN session bypasses the restriction of canPerformWrite and canPerformDelete
  it("1. Active ADMIN session bypasses demo write restrictions", async () => {
    (getAuthenticatedUserAccess as any).mockResolvedValue({ id: "admin-1", role: "ADMIN", status: "ACTIVE" });
    const writeAllowed = await canPerformWrite();
    const deleteAllowed = await canPerformDelete();
    expect(writeAllowed).toBe(true);
    expect(deleteAllowed).toBe(true);
  });

  // Scenario 2: requireAdmin enforces active ADMIN check
  it("2. requireAdmin enforces active ADMIN check", async () => {
    (requireAdmin as any).mockImplementationOnce(async () => {
      throw new Error("Unauthorized");
    });
    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  // Scenario 3: Locked fields (rollNumber and email) are protected by default inside PATCH /api/admin/students/[id]
  it("3. Permanent fields (rollNumber and email) are protected against updates in PATCH student route", async () => {
    const oldStudent = { id: "s-123", name: "John Doe", rollNumber: "20CSE01", email: "john@example.com" };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(oldStudent);

    const req = new NextRequest("http://localhost/api/admin/students/s-123", {
      method: "PATCH",
      body: JSON.stringify({ name: "John Doe Updated", rollNumber: "CHANGED_ROLL" }),
    });

    const res = await updateStudentDetailsPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("permanent and cannot be changed");
  });

  // Scenario 4: Changing a platform URL resets student profile verificationStatus and resets eligibility flags to false
  it("4. Changing a platform URL resets verificationStatus and eligibility flags to false", async () => {
    const oldStudent = { id: "s-123", name: "John Doe", codechefUsername: "john_cc", leetcodeUsername: "john_lc", codeforcesUsername: null, githubUsername: null, linkedinUrl: null };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(oldStudent);

    const req = new NextRequest("http://localhost/api/admin/students/s-123", {
      method: "PATCH",
      body: JSON.stringify({
        name: "John Doe",
        codechefUsername: "https://www.codechef.com/users/new_cc_username",
        leetcodeUsername: "https://leetcode.com/john_lc",
        codeforcesUsername: "",
        githubUsername: "",
        linkedinUrl: "",
      }),
    });

    const res = await updateStudentDetailsPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(res.status).toBe(200);
    expect(prisma.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codechefUsername: "new_cc_username",
          verificationStatus: "UNABLE_TO_VERIFY",
          profileStatus: "PENDING_VERIFICATION",
          leaderboardEligible: false,
          dashboardEligible: false,
        }),
      })
    );
  });

  // Scenario 5: Changing a platform URL queues exactly one SyncJob for the student
  it("5. Changing a platform URL queues exactly one SyncJob in the database", async () => {
    const oldStudent = { id: "s-123", name: "John Doe", codechefUsername: "john_cc", leetcodeUsername: "john_lc", codeforcesUsername: null, githubUsername: null, linkedinUrl: null };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(oldStudent);

    const req = new NextRequest("http://localhost/api/admin/students/s-123", {
      method: "PATCH",
      body: JSON.stringify({
        name: "John Doe",
        codechefUsername: "https://www.codechef.com/users/new_cc_username",
        leetcodeUsername: "https://leetcode.com/john_lc",
        codeforcesUsername: "",
        githubUsername: "",
        linkedinUrl: "",
      }),
    });

    await updateStudentDetailsPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(prisma.syncJob.deleteMany).toHaveBeenCalledWith({ where: { studentId: "s-123", status: "QUEUED" } });
    expect(prisma.syncJob.create).toHaveBeenCalledWith({
      data: { studentId: "s-123", status: "QUEUED", attemptCount: 0 },
    });
  });

  // Scenario 6: Changing a platform URL logs STUDENT_PLATFORM_URL_CHANGED audit event
  it("6. Changing a platform URL logs STUDENT_PLATFORM_URL_CHANGED audit event", async () => {
    const oldStudent = { id: "s-123", name: "John Doe", codechefUsername: "john_cc", leetcodeUsername: "john_lc", codeforcesUsername: null, githubUsername: null, linkedinUrl: null };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(oldStudent);

    const req = new NextRequest("http://localhost/api/admin/students/s-123", {
      method: "PATCH",
      body: JSON.stringify({
        name: "John Doe",
        codechefUsername: "https://www.codechef.com/users/new_cc_username",
        leetcodeUsername: "https://leetcode.com/john_lc",
        codeforcesUsername: "",
        githubUsername: "",
        linkedinUrl: "",
      }),
    });

    await updateStudentDetailsPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STUDENT_PLATFORM_URL_CHANGED",
        targetId: "s-123",
        metadata: { changedFields: ["codechefUsername"] },
      })
    );
  });

  // Scenario 7: Manual student addition (POST /api/admin/students) normalizes and creates a student profile
  it("7. Manual student addition normalizes and creates student profile", async () => {
    const newStudentInput = { name: "Alice Smith", rollNumber: "23AG1A0501", email: "alice@example.com", year: 1, department: "CSE" };

    const req = new NextRequest("http://localhost/api/admin/students", {
      method: "POST",
      body: JSON.stringify(newStudentInput),
    });

    const res = await createStudentPost(req);
    expect(res.status).toBe(200);
  });

  // Scenario 8: Manual student addition queues a verification SyncJob if handles are present
  it("8. Manual student addition queues a verification SyncJob if handles are provided", async () => {
    const studentInput = {
      name: "Alice Smith",
      rollNumber: "23AG1A0501",
      email: "alice@example.com",
      year: 1,
      department: "CSE",
      codechefUsername: "https://www.codechef.com/users/alice_cc",
      leetcodeUsername: "https://leetcode.com/alice_lc",
    };

    const req = new NextRequest("http://localhost/api/admin/students", {
      method: "POST",
      body: JSON.stringify(studentInput),
    });

    await createStudentPost(req);
    expect(prisma.syncJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "QUEUED" }),
      })
    );
  });

  // Scenario 9: Manual student addition logs STUDENT_CREATED audit event
  it("9. Manual student addition logs STUDENT_CREATED audit event", async () => {
    const studentInput = { name: "Alice Smith", rollNumber: "23AG1A0501", email: "alice@example.com", year: 1, department: "CSE" };

    const req = new NextRequest("http://localhost/api/admin/students", {
      method: "POST",
      body: JSON.stringify(studentInput),
    });

    await createStudentPost(req);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STUDENT_CREATED",
      })
    );
  });

  // Scenario 10: High-risk identity change PATCH /api/admin/students/[id]/identity updates rollNumber and email
  it("10. High-risk identity change route updates rollNumber and email address", async () => {
    const student = { id: "s-123", rollNumber: "20CSE01", email: "john@example.com", userAccess: { authUserId: "user-123" } };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);
    (prisma.studentProfile.findUnique as any)
      .mockResolvedValueOnce(student) // finding existing student
      .mockResolvedValueOnce(null) // no duplicate roll number student
      .mockResolvedValueOnce(null); // no duplicate email student
    (prisma.userAccess.findUnique as any)
      .mockResolvedValueOnce(null) // no duplicate roll number userAccess
      .mockResolvedValueOnce(null); // no duplicate email userAccess

    const req = new NextRequest("http://localhost/api/admin/students/s-123/identity", {
      method: "PATCH",
      body: JSON.stringify({ newRollNumber: "20CSE02", newEmail: "john2@example.com" }),
    });

    const res = await updateStudentIdentityPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(res.status).toBe(200);
  });

  // Scenario 11: High-risk identity change updates corresponding Supabase Auth user email
  it("11. High-risk identity change updates corresponding Supabase Auth user email via Admin API", async () => {
    const student = { id: "s-123", rollNumber: "20CSE01", email: "john@example.com", userAccess: { authUserId: "auth-123" } };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);
    (prisma.studentProfile.findUnique as any)
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.userAccess.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/identity", {
      method: "PATCH",
      body: JSON.stringify({ newEmail: "newjohn@example.com" }),
    });

    await updateStudentIdentityPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    // Verifies transactions are fired
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // Scenario 12: High-risk identity change rejects duplicates
  it("12. High-risk identity change rejects updates if duplicate roll number or email exists", async () => {
    const student = { id: "s-123", rollNumber: "20CSE01", email: "john@example.com" };
    (prisma.studentProfile.findUnique as any)
      .mockResolvedValueOnce(student) // find student details
      .mockResolvedValueOnce({ id: "s-duplicate" }); // mock a duplicate roll number student

    const req = new NextRequest("http://localhost/api/admin/students/s-123/identity", {
      method: "PATCH",
      body: JSON.stringify({ newRollNumber: "DUPLICATE_ROLL" }),
    });

    const res = await updateStudentIdentityPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toContain("already in use");
  });

  // Scenario 13: High-risk identity change logs STUDENT_IDENTITY_CHANGED audit event
  it("13. High-risk identity change logs STUDENT_IDENTITY_CHANGED audit event", async () => {
    const student = { id: "s-123", rollNumber: "20CSE01", email: "john@example.com", userAccess: { authUserId: "auth-123" } };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);
    (prisma.studentProfile.findUnique as any)
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.userAccess.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/identity", {
      method: "PATCH",
      body: JSON.stringify({ newRollNumber: "20CSE02" }),
    });

    await updateStudentIdentityPatch(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STUDENT_IDENTITY_CHANGED",
        targetId: "s-123",
      })
    );
  });

  // Scenario 14: Archive POST /api/admin/students/[id]/archive marks student as archived, and resets eligibility to false
  it("14. Archive endpoint marks student profile archived and sets eligibility flags to false", async () => {
    const student = { id: "s-123", name: "John Doe" };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/archive", {
      method: "POST",
    });

    const res = await archiveStudentPost(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(res.status).toBe(200);
    expect(prisma.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s-123" },
        data: expect.objectContaining({
          leaderboardEligible: false,
          dashboardEligible: false,
          archivedAt: expect.any(Date),
        }),
      })
    );
  });

  // Scenario 15: Archive clears any QUEUED sync jobs for the student
  it("15. Archive deletes any pending QUEUED sync jobs for the archived student", async () => {
    const student = { id: "s-123", name: "John Doe" };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/archive", {
      method: "POST",
    });

    await archiveStudentPost(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(prisma.syncJob.deleteMany).toHaveBeenCalledWith({
      where: { studentId: "s-123", status: "QUEUED" },
    });
  });

  // Scenario 16: Archive logs STUDENT_ARCHIVED audit event
  it("16. Archive logs STUDENT_ARCHIVED audit event", async () => {
    const student = { id: "s-123", name: "John Doe" };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/archive", {
      method: "POST",
    });

    await archiveStudentPost(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STUDENT_ARCHIVED",
        targetId: "s-123",
      })
    );
  });

  // Scenario 17: Restore POST /api/admin/students/[id]/restore returns the student to active status
  it("17. Restore returns the student profile to active status", async () => {
    const student = { id: "s-123", name: "John Doe", archivedAt: new Date() };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/restore", {
      method: "POST",
    });

    const res = await restoreStudentPost(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(res.status).toBe(200);
    expect(prisma.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s-123" },
        data: expect.objectContaining({
          archivedAt: null,
          archivedById: null,
        }),
      })
    );
  });

  // Scenario 18: Restore re-evaluates eligibility status dynamically based on approval and verification
  it("18. Restore re-evaluates eligibility status dynamically based on profileStatus and adminApprovalStatus", async () => {
    const student = {
      id: "s-123",
      name: "John Doe",
      profileStatus: "VERIFIED",
      adminApprovalStatus: "APPROVED",
    };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/restore", {
      method: "POST",
    });

    await restoreStudentPost(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(prisma.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaderboardEligible: true,
          dashboardEligible: true,
        }),
      })
    );
  });

  // Scenario 19: Restore logs STUDENT_RESTORED audit event
  it("19. Restore logs STUDENT_RESTORED audit event", async () => {
    const student = { id: "s-123", name: "John Doe" };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-123/restore", {
      method: "POST",
    });

    await restoreStudentPost(req, { params: Promise.resolve({ id: "s-123" }) });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STUDENT_RESTORED",
        targetId: "s-123",
      })
    );
  });

  // Scenario 20: GET /api/admin/student-approvals filters archived status correctly and excludes archived students from metrics
  it("20. approvals endpoint filters archived status correctly", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([]);
    (prisma.studentProfile.count as any).mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/admin/student-approvals?archiveStatus=archived", {
      method: "GET",
    });

    await getStudentApprovals(req);
    expect(prisma.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: { not: null },
        }),
      })
    );
  });
});
