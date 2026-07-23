import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole, AccountStatus } from "@prisma/client";

// Mocks
let mockUserAccessStore: any[] = [];
let mockSupabaseUser: any = null;
let mockRedirectUrl: string | null = null;

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    mockRedirectUrl = url;
    const error: any = new Error(`NEXT_REDIRECT: ${url}`);
    error.digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw error;
  })
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userAccess: {
      findUnique: vi.fn(({ where }: any) => {
        if (where.authUserId) {
          return mockUserAccessStore.find(u => u.authUserId === where.authUserId) || null;
        }
        return null;
      }),
      findMany: vi.fn(async () => mockUserAccessStore)
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
      signOut: vi.fn(async () => {
        mockSupabaseUser = null;
        return { error: null };
      })
    }
  }))
}));

import {
  requireAuthenticatedUser,
  requireActiveUser,
  requireRole,
  requireDashboardAccess,
  requireActivePageUser,
  requireAdminPageAccess,
  requireDashboardPageAccess,
  requireLeaderboardPageAccess,
  requireStudentProfileReadPageAccess,
  AuthError
} from "../src/lib/auth";

describe("Protected Page Redirect vs API JSON Security Suite", () => {
  beforeEach(() => {
    mockUserAccessStore = [];
    mockSupabaseUser = null;
    mockRedirectUrl = null;
  });

  it("1. Unauthenticated page user is redirected to /login", async () => {
    mockSupabaseUser = null;
    await expect(requireDashboardPageAccess()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirectUrl).toBe("/login");
  });

  it("2. PENDING user visiting protected page is redirected to /auth/set-password", async () => {
    mockSupabaseUser = { id: "supa-pending", email: "pending@domain.com" };
    mockUserAccessStore.push({
      id: "ua-pending",
      authUserId: "supa-pending",
      email: "pending@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    await expect(requireDashboardPageAccess()).rejects.toThrow("NEXT_REDIRECT: /login?error=account_pending");
    expect(mockRedirectUrl).toBe("/login?error=account_pending");
  });

  it("3. ACTIVE user visiting protected dashboard layout passes successfully without redirect", async () => {
    mockSupabaseUser = { id: "supa-active", email: "active@domain.com" };
    mockUserAccessStore.push({
      id: "ua-active",
      authUserId: "supa-active",
      email: "active@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false,
      firstLoginCompleted: true
    });

    const access = await requireDashboardPageAccess();
    expect(access.email).toBe("active@domain.com");
    expect(access.status).toBe(AccountStatus.ACTIVE);
    expect(mockRedirectUrl).toBeNull();
  });

  it("4. SUSPENDED page user is redirected to /login?error=account_suspended", async () => {
    mockSupabaseUser = { id: "supa-suspended", email: "suspended@domain.com" };
    mockUserAccessStore.push({
      id: "ua-suspended",
      authUserId: "supa-suspended",
      email: "suspended@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.SUSPENDED,
      mustSetPassword: false,
      firstLoginCompleted: true
    });

    await expect(requireDashboardPageAccess()).rejects.toThrow("NEXT_REDIRECT: /login?error=account_suspended");
    expect(mockRedirectUrl).toBe("/login?error=account_suspended");
  });

  it("5. DISABLED page user is redirected to /login?error=account_disabled", async () => {
    mockSupabaseUser = { id: "supa-disabled", email: "disabled@domain.com" };
    mockUserAccessStore.push({
      id: "ua-disabled",
      authUserId: "supa-disabled",
      email: "disabled@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.DISABLED,
      mustSetPassword: false,
      firstLoginCompleted: true
    });

    await expect(requireDashboardPageAccess()).rejects.toThrow("NEXT_REDIRECT: /login?error=account_disabled");
    expect(mockRedirectUrl).toBe("/login?error=account_disabled");
  });

  it("6. API auth helper (requireActiveUser) throws AuthError without redirecting", async () => {
    mockSupabaseUser = { id: "supa-pending", email: "pending@domain.com" };
    mockUserAccessStore.push({
      id: "ua-pending",
      authUserId: "supa-pending",
      email: "pending@domain.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    try {
      await requireDashboardAccess();
      expect.fail("Should have thrown AuthError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AuthError);
      expect(err.code).toBe("PENDING_ACCOUNT");
      expect(err.message).toBe("Password setup required");
      expect(mockRedirectUrl).toBeNull(); // NO redirect for API routes!
    }
  });

  it("7. Student page access check redirects unauthorized student to role home path", async () => {
    mockSupabaseUser = { id: "supa-student", email: "student@domain.com" };
    mockUserAccessStore.push({
      id: "ua-student",
      authUserId: "supa-student",
      email: "student@domain.com",
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false,
      firstLoginCompleted: true,
      studentProfileId: "sp-own"
    });

    // Student trying to read another student's profile
    await expect(requireStudentProfileReadPageAccess("sp-other")).rejects.toThrow("NEXT_REDIRECT: /student/sp-own");
    expect(mockRedirectUrl).toBe("/student/sp-own");
  });

  it("8. Leaderboard page access permits STUDENT role to view leaderboard page", async () => {
    mockSupabaseUser = { id: "supa-student", email: "student@domain.com" };
    mockUserAccessStore.push({
      id: "ua-student",
      authUserId: "supa-student",
      email: "student@domain.com",
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false,
      firstLoginCompleted: true,
      studentProfileId: "sp-own"
    });

    const access = await requireLeaderboardPageAccess();
    expect(access.role).toBe(UserRole.STUDENT);
    expect(mockRedirectUrl).toBeNull();
  });
});
