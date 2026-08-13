import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma dependency
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    studentProfile: {
      findUnique: vi.fn(),
    },
    syncJob: { deleteMany: vi.fn() },
    leaderboardEntry: { deleteMany: vi.fn() },
    codechefProfile: { deleteMany: vi.fn() },
    leetcodeProfile: { deleteMany: vi.fn() },
    githubProfile: { deleteMany: vi.fn() },
    aiAnalysis: { deleteMany: vi.fn() },
    syncLog: { deleteMany: vi.fn() },
    activityLog: { deleteMany: vi.fn() },
    normalizedProfile: { deleteMany: vi.fn() },
    userAccess: { deleteMany: vi.fn() },
    studentProfile: { delete: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn) => {
      if (typeof fn === "function") return fn(mockPrisma);
      return Promise.all(fn);
    }),
  };
  return { prisma: mockPrisma };
});

// Mock Auth to return an admin with canDeleteStudents true
vi.mock("@/lib/auth", () => ({
  requireAdmin: () => Promise.resolve({ id: "admin-1", role: "ADMIN", canDeleteStudents: true }),
}));

// Mock recordAuditEvent
vi.mock("@/services/audit.service", () => ({ recordAuditEvent: vi.fn().mockResolvedValue(true) }));

// Mock SyncService
vi.mock("@/services/sync.service", () => ({ SyncService: { recalculateLeaderboardRanks: vi.fn().mockResolvedValue(true) } }));

// Mock next/cache
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock Supabase admin client to throw on creation
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: () => { throw new Error("missing creds"); } }));

import { prisma } from "@/lib/prisma";
import { DELETE as deleteStudent } from "@/app/api/admin/students/[id]/route";
import { NextRequest } from "next/server";

describe("Regression: Deletion when Supabase admin client is unavailable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("proceeds with DB deletion when Supabase admin client creation throws", async () => {
    const student = {
      id: "s-dummy-22cs999",
      name: "Test Dev student",
      rollNumber: "22CS999",
      email: "testdev@example.com",
      userAccess: { authUserId: "auth-missing" },
    };

    (prisma.studentProfile.findUnique as any).mockResolvedValue(student);

    const req = new NextRequest("http://localhost/api/admin/students/s-dummy-22cs999", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE", reason: "Dummy / Test Profile", notes: "cleanup" }),
    });

    const res = await deleteStudent(req, { params: Promise.resolve({ id: "s-dummy-22cs999" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Ensure prisma deletion calls executed
    expect(prisma.syncJob.deleteMany).toHaveBeenCalled();
    expect(prisma.studentProfile.delete).toHaveBeenCalledWith({ where: { id: "s-dummy-22cs999" } });
  });
});
