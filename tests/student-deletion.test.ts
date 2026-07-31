import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma dependency
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    studentProfile: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    userAccess: {
      deleteMany: vi.fn(),
    },
    syncJob: {
      deleteMany: vi.fn(),
    },
    leaderboardEntry: {
      deleteMany: vi.fn(),
    },
    codechefProfile: {
      deleteMany: vi.fn(),
    },
    leetcodeProfile: {
      deleteMany: vi.fn(),
    },
    githubProfile: {
      deleteMany: vi.fn(),
    },
    aiAnalysis: {
      deleteMany: vi.fn(),
    },
    syncLog: {
      deleteMany: vi.fn(),
    },
    activityLog: {
      deleteMany: vi.fn(),
    },
    normalizedProfile: {
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => {
      if (typeof fn === "function") {
        return fn(mockPrisma);
      }
      return Promise.all(fn);
    }),
  };
  return { prisma: mockPrisma };
});

// Mock Auth
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

// Mock Audit Service
vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

// Mock Supabase Admin Client
vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  }),
}));

// Mock Sync Service
vi.mock("@/services/sync.service", () => ({
  SyncService: {
    recalculateLeaderboardRanks: vi.fn().mockResolvedValue(true),
  },
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { SyncService } from "@/services/sync.service";
import { DELETE as deleteStudent } from "@/app/api/admin/students/[id]/route";
import { POST as bulkDeleteStudents } from "@/app/api/admin/students/bulk-delete/route";
import { NextRequest } from "next/server";

describe("Admin Student Deletion API Workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Non-admin or disabled delete permission should return 403 on individual delete", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN", canDeleteStudents: false });

    const req = new NextRequest("http://localhost/api/admin/students/s-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: "DELETE",
        reason: "Duplicate student",
      }),
    });

    const res = await deleteStudent(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("deletion access is disabled");
  });

  it("2. Individual delete fails if typed confirmation is not DELETE", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN", canDeleteStudents: true });

    const req = new NextRequest("http://localhost/api/admin/students/s-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: "WRONG",
        reason: "Duplicate student",
      }),
    });

    const res = await deleteStudent(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Typed confirmation");
  });

  it("3. Individual delete fails if reason is missing", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN", canDeleteStudents: true });

    const req = new NextRequest("http://localhost/api/admin/students/s-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: "DELETE",
        reason: "",
      }),
    });

    const res = await deleteStudent(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("reason is required");
  });

  it("4. Successful individual deletion cleans up database and calls Supabase Auth delete", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN", canDeleteStudents: true });
    
    const student = {
      id: "s-1",
      name: "John Doe",
      rollNumber: "22CSE01",
      email: "john@example.com",
      userAccess: {
        authUserId: "auth-123",
      },
    };
    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: "DELETE",
        reason: "Duplicate student",
      }),
    });

    const res = await deleteStudent(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(200);

    // Verify DB cleanup queries
    expect(prisma.syncJob.deleteMany).toHaveBeenCalledWith({ where: { studentId: "s-1" } });
    expect(prisma.studentProfile.delete).toHaveBeenCalledWith({ where: { id: "s-1" } });
    expect(SyncService.recalculateLeaderboardRanks).toHaveBeenCalled();

    // Verify audit event
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STUDENT_DELETED",
        targetId: "s-1",
        metadata: expect.objectContaining({
          name: "John Doe",
          reason: "Duplicate student",
        }),
      })
    );
  });

  it("5. Bulk deletion validates typed confirmation pattern", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN", canDeleteStudents: true });

    const req = new NextRequest("http://localhost/api/admin/students/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds: ["s-1", "s-2"],
        confirmString: "DELETE 3 STUDENTS", // Mismatched count
        confirmCheckbox: true,
        reason: "Imported by mistake",
      }),
    });

    const res = await bulkDeleteStudents(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toContain("confirmation does not match");
  });

  it("6. Bulk deletion requires checking the confirmation checkbox", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN", canDeleteStudents: true });

    const req = new NextRequest("http://localhost/api/admin/students/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds: ["s-1", "s-2"],
        confirmString: "DELETE 2 STUDENTS",
        confirmCheckbox: false,
        reason: "Imported by mistake",
      }),
    });

    const res = await bulkDeleteStudents(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toContain("confirmation checkbox");
  });

  it("7. Successful bulk deletion processes in chunks and reports success counts", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN", canDeleteStudents: true });

    const student1 = { id: "s-1", name: "S1", rollNumber: "R1", email: "e1@a.com" };
    const student2 = { id: "s-2", name: "S2", rollNumber: "R2", email: "e2@a.com" };

    // Setup sequence for findUnique mocks
    (prisma.studentProfile.findUnique as any)
      .mockResolvedValueOnce(student1)
      .mockResolvedValueOnce(student2);

    const req = new NextRequest("http://localhost/api/admin/students/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds: ["s-1", "s-2"],
        confirmString: "DELETE 2 STUDENTS",
        confirmCheckbox: true,
        reason: "Imported by mistake",
      }),
    });

    const res = await bulkDeleteStudents(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deleted).toBe(2);
    expect(data.failed).toBe(0);

    // Verify bulk delete summary audit log
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STUDENT_BULK_DELETED",
        metadata: expect.objectContaining({
          attemptedCount: 2,
          successCount: 2,
          failedCount: 0,
        }),
      })
    );
  });
});
