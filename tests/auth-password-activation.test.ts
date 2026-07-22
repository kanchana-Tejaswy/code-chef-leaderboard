import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UserRole, AccountStatus } from "@prisma/client";

// Mocks
let mockUserAccessStore: any[] = [];
let mockSupabaseUser: any = null;
let mockUpdateUserError: any = null;
let mockPrismaUpdateError: any = null;
let mockSignOutCalled = false;
let mockAuditEvents: any[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userAccess: {
      findUnique: vi.fn(({ where }: any) => {
        if (where.authUserId) {
          return mockUserAccessStore.find(u => u.authUserId === where.authUserId) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        if (mockPrismaUpdateError) {
          throw mockPrismaUpdateError;
        }
        const record = mockUserAccessStore.find(u => u.id === where.id || u.authUserId === where.authUserId);
        if (record) {
          Object.assign(record, data);
          return record;
        }
        throw new Error("Record not found");
      })
    }
  }
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockSupabaseUser },
        error: mockSupabaseUser ? null : { message: "No session" }
      })),
      updateUser: vi.fn(async (params: any) => {
        if (mockUpdateUserError) {
          return { data: { user: null }, error: mockUpdateUserError };
        }
        return { data: { user: mockSupabaseUser }, error: null };
      }),
      signOut: vi.fn(async () => {
        mockSignOutCalled = true;
        mockSupabaseUser = null;
        return { error: null };
      })
    }
  }))
}));

vi.mock("@/services/audit.service", () => ({
  AuditAction: {
    SESSION_MISMATCH: "SESSION_MISMATCH",
    FIRST_PASSWORD_SET_FAILED: "FIRST_PASSWORD_SET_FAILED",
    FIRST_PASSWORD_SET: "FIRST_PASSWORD_SET",
    ACCOUNT_ACTIVATED: "ACCOUNT_ACTIVATED",
    ACCOUNT_STATE_CONFLICT: "ACCOUNT_STATE_CONFLICT"
  },
  recordAuditEvent: vi.fn(async (params: any) => {
    mockAuditEvents.push(params);
  })
}));

import { POST as handleSetPassword } from "../src/app/api/auth/set-password/route";

describe("Password Activation Security Route", () => {
  beforeEach(() => {
    mockUserAccessStore = [];
    mockSupabaseUser = null;
    mockUpdateUserError = null;
    mockPrismaUpdateError = null;
    mockSignOutCalled = false;
    mockAuditEvents = [];
  });

  it("1. Unauthenticated request is rejected with 401", async () => {
    mockSupabaseUser = null;
    const req = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Password123!", confirmPassword: "Password123!" })
    });

    const res = await handleSetPassword(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("2. PENDING Admin password setup succeeds and updates status to ACTIVE", async () => {
    mockSupabaseUser = { id: "supa-admin-1", email: "admin@domain.com" };
    mockUserAccessStore.push({
      id: "ua-admin-1",
      authUserId: "supa-admin-1",
      email: "admin@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "ComplexAdminPass#2026", confirmPassword: "ComplexAdminPass#2026" })
    });

    const res = await handleSetPassword(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.redirectTo).toBe("/dashboard");

    const updated = mockUserAccessStore[0];
    expect(updated.status).toBe(AccountStatus.ACTIVE);
    expect(updated.mustSetPassword).toBe(false);
    expect(updated.firstLoginCompleted).toBe(true);
    expect(updated.passwordSetAt).toBeInstanceOf(Date);
  });

  it("3. Already ACTIVE Admin repeating setup returns idempotent 200 with /dashboard redirect", async () => {
    mockSupabaseUser = { id: "supa-admin-1", email: "admin@domain.com" };
    mockUserAccessStore.push({
      id: "ua-admin-1",
      authUserId: "supa-admin-1",
      email: "admin@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false,
      firstLoginCompleted: true
    });

    const req = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "ComplexAdminPass#2026", confirmPassword: "ComplexAdminPass#2026" })
    });

    const res = await handleSetPassword(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.redirectTo).toBe("/dashboard");
  });

  it("4. SUSPENDED user is blocked with 401", async () => {
    mockSupabaseUser = { id: "supa-bad", email: "bad@domain.com" };
    mockUserAccessStore.push({
      id: "ua-bad",
      authUserId: "supa-bad",
      email: "bad@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.SUSPENDED,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "ComplexAdminPass#2026", confirmPassword: "ComplexAdminPass#2026" })
    });

    const res = await handleSetPassword(req);
    expect(res.status).toBe(401);
    expect(mockSignOutCalled).toBe(true);
  });

  it("5. DISABLED user is blocked with 401", async () => {
    mockSupabaseUser = { id: "supa-disabled", email: "disabled@domain.com" };
    mockUserAccessStore.push({
      id: "ua-disabled",
      authUserId: "supa-disabled",
      email: "disabled@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.DISABLED,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "ComplexAdminPass#2026", confirmPassword: "ComplexAdminPass#2026" })
    });

    const res = await handleSetPassword(req);
    expect(res.status).toBe(401);
    expect(mockSignOutCalled).toBe(true);
  });

  it("6. Supabase update failure returns 500 without modifying Prisma state", async () => {
    mockSupabaseUser = { id: "supa-admin-1", email: "admin@domain.com" };
    mockUserAccessStore.push({
      id: "ua-admin-1",
      authUserId: "supa-admin-1",
      email: "admin@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    mockUpdateUserError = { message: "Supabase rate limit or network error" };

    const req = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "ComplexAdminPass#2026", confirmPassword: "ComplexAdminPass#2026" })
    });

    const res = await handleSetPassword(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.message).toBe("Temporary failure updating password");
    expect(mockUserAccessStore[0].status).toBe(AccountStatus.PENDING);
  });

  it("7. Safe retry after Prisma failure activates account", async () => {
    mockSupabaseUser = { id: "supa-admin-1", email: "admin@domain.com" };
    mockUserAccessStore.push({
      id: "ua-admin-1",
      authUserId: "supa-admin-1",
      email: "admin@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    // First attempt fails at Prisma
    mockPrismaUpdateError = new Error("DB Connection Busy");

    const req1 = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "ComplexAdminPass#2026", confirmPassword: "ComplexAdminPass#2026" })
    });

    const res1 = await handleSetPassword(req1);
    expect(res1.status).toBe(500);

    // Second attempt (retry) succeeds
    mockPrismaUpdateError = null;

    const req2 = new NextRequest("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "ComplexAdminPass#2026", confirmPassword: "ComplexAdminPass#2026" })
    });

    const res2 = await handleSetPassword(req2);
    const data2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(data2.success).toBe(true);
    expect(mockUserAccessStore[0].status).toBe(AccountStatus.ACTIVE);
  });
});
