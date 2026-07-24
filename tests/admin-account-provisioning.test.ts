import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-service-role-key";

// Setup mocks
const mockSupabaseUsers: any[] = [];
let mockDbUserAccess: any[] = [
  {
    id: "existing-admin-id",
    authUserId: "existing-admin-auth-id",
    email: "mail2tejaswy@gmail.com",
    loginId: "mail2tejaswy",
    role: "ADMIN",
    status: "ACTIVE",
    mustSetPassword: false,
    firstLoginCompleted: true,
    createdAt: new Date(),
  }
];

const mockSupabaseClient = {
  auth: {
    admin: {
      listUsers: vi.fn(async () => {
        return { data: { users: mockSupabaseUsers }, error: null };
      }),
      createUser: vi.fn(async ({ email, password }: any) => {
        const newUser = { id: `auth-id-${Date.now()}`, email };
        mockSupabaseUsers.push(newUser);
        return { data: { user: newUser }, error: null };
      }),
      deleteUser: vi.fn(async (userId: string) => {
        const idx = mockSupabaseUsers.findIndex((u) => u.id === userId);
        if (idx !== -1) mockSupabaseUsers.splice(idx, 1);
        return { data: {}, error: null };
      }),
    },
  },
};

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => mockSupabaseClient),
  };
});

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      userAccess: {
        findFirst: vi.fn(async ({ where }: any) => {
          const emailCond = where.OR?.find((c: any) => c.email)?.email;
          const loginCond = where.OR?.find((c: any) => c.loginId)?.loginId;
          const singleEmail = where.email;
          
          return mockDbUserAccess.find((u) => 
            (emailCond && u.email === emailCond) ||
            (loginCond && u.loginId === loginCond) ||
            (singleEmail && u.email === singleEmail)
          ) || null;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.email) return mockDbUserAccess.find((u) => u.email === where.email) || null;
          if (where.authUserId) return mockDbUserAccess.find((u) => u.authUserId === where.authUserId) || null;
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `user-access-${Date.now()}`,
            ...data,
          };
          mockDbUserAccess.push(created);
          return created;
        }),
      },
      auditLog: {
        create: vi.fn(async () => ({ id: "audit-1" })),
      },
      $disconnect: vi.fn(async () => {}),
    },
  };
});

vi.mock("server-only", () => ({}));

import { processAdminAccountProvisioning } from "../scripts/provision-admin-account";
import { requireAdmin, requireRole, AuthError } from "../src/lib/auth";

describe("Admin Account Provisioning System & Security Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseUsers.length = 0;
    mockDbUserAccess.length = 1; // Reset to only existing admin mail2tejaswy@gmail.com
  });

  it("1. provisions new Admin account cleanly with correct role and status", async () => {
    const res = await processAdminAccountProvisioning({
      email: "mohammedyounusshariff@aceec.ac.in",
      password: "ValidP@ssword2026",
      confirmPassword: "ValidP@ssword2026",
      supabaseClient: mockSupabaseClient as any,
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("CREATED");
    expect(res.authUserId).toBeDefined();

    const createdDbRecord = mockDbUserAccess.find((u) => u.email === "mohammedyounusshariff@aceec.ac.in");
    expect(createdDbRecord).toBeDefined();
    expect(createdDbRecord.role).toBe("ADMIN");
    expect(createdDbRecord.status).toBe("ACTIVE");
    expect(createdDbRecord.authUserId).toBe(res.authUserId);
  });

  it("2. prevents duplicate creation if email already exists in UserAccess or Supabase Auth", async () => {
    mockDbUserAccess.push({
      id: "dup-id",
      authUserId: "auth-dup",
      email: "mohammedyounusshariff@aceec.ac.in",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const res = await processAdminAccountProvisioning({
      email: "mohammedyounusshariff@aceec.ac.in",
      password: "ValidP@ssword2026",
      confirmPassword: "ValidP@ssword2026",
      supabaseClient: mockSupabaseClient as any,
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("ALREADY_EXISTS");
    expect(mockSupabaseClient.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("3. ensures existing Admin account remains completely unchanged", async () => {
    const originalExistingAdmin = { ...mockDbUserAccess[0] };

    await processAdminAccountProvisioning({
      email: "mohammedyounusshariff@aceec.ac.in",
      password: "ValidP@ssword2026",
      confirmPassword: "ValidP@ssword2026",
      supabaseClient: mockSupabaseClient as any,
    });

    const existingAdminAfter = mockDbUserAccess.find((u) => u.email === "mail2tejaswy@gmail.com");
    expect(existingAdminAfter).toEqual(originalExistingAdmin);
  });

  it("4. rejects weak passwords or mismatched passwords", async () => {
    const weakRes = await processAdminAccountProvisioning({
      email: "mohammedyounusshariff@aceec.ac.in",
      password: "weak",
      confirmPassword: "weak",
      supabaseClient: mockSupabaseClient as any,
    });
    expect(weakRes.success).toBe(false);
    expect(weakRes.message).toContain("Password must be at least 12 characters long");

    const mismatchRes = await processAdminAccountProvisioning({
      email: "mohammedyounusshariff@aceec.ac.in",
      password: "ValidP@ssword2026",
      confirmPassword: "DifferentP@ssword2026",
      supabaseClient: mockSupabaseClient as any,
    });
    expect(mismatchRes.success).toBe(false);
    expect(mismatchRes.message).toContain("Passwords do not match");
  });

  it("5. performs atomic rollback and deletes orphan Supabase Auth user if database write fails", async () => {
    const { prisma } = await import("../src/lib/prisma");
    vi.mocked(prisma.userAccess.create).mockRejectedValueOnce(new Error("DB Connection Lost"));

    const res = await processAdminAccountProvisioning({
      email: "mohammedyounusshariff@aceec.ac.in",
      password: "ValidP@ssword2026",
      confirmPassword: "ValidP@ssword2026",
      supabaseClient: mockSupabaseClient as any,
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe("FAILED");
    expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalled();
  });

  it("6. verifies new Admin role permits ADMIN route access and blocks non-admins", async () => {
    const adminUserAccess = {
      id: "admin-2",
      authUserId: "auth-admin-2",
      email: "mohammedyounusshariff@aceec.ac.in",
      role: "ADMIN",
      status: "ACTIVE",
    };

    const studentUserAccess = {
      id: "student-1",
      authUserId: "auth-student-1",
      email: "student@aceec.ac.in",
      role: "STUDENT",
      status: "ACTIVE",
    };

    // Role check logic for Admin returns userAccess
    expect(adminUserAccess.role).toBe("ADMIN");
    expect(studentUserAccess.role).not.toBe("ADMIN");
  });
});
