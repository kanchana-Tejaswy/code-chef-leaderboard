import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, AccountStatus } from "@prisma/client";

// Mock dependencies
let mockUserAccess: any[] = [];
let mockSupabaseUser: any = null;
let mockExchangeCodeResult: any = { error: null };
let mockVerifyOtpResult: any = { error: null };
let mockSignOutCalled = false;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userAccess: {
      findUnique: vi.fn(({ where }: any) => {
        if (where.authUserId) {
          return mockUserAccess.find(u => u.authUserId === where.authUserId) || null;
        }
        if (where.email) {
          return mockUserAccess.find(u => u.email?.toLowerCase() === where.email.toLowerCase()) || null;
        }
        return null;
      })
    }
  }
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn(async (code: string) => {
        if (code === "valid_code") {
          mockSupabaseUser = { id: "supa-1", email: "admin@t.com" };
          return { data: { user: mockSupabaseUser }, error: null };
        }
        mockSupabaseUser = null;
        return { data: { user: null }, error: { message: "Invalid code" } };
      }),
      verifyOtp: vi.fn(async ({ token_hash }: any) => {
        if (token_hash === "valid_hash") {
          mockSupabaseUser = { id: "supa-1", email: "admin@t.com" };
          return { data: { user: mockSupabaseUser }, error: null };
        }
        mockSupabaseUser = null;
        return { data: { user: null }, error: { message: "Invalid token" } };
      }),
      getUser: vi.fn(async () => ({
        data: { user: mockSupabaseUser },
        error: mockSupabaseUser ? null : { message: "No user" }
      })),
      signOut: vi.fn(async () => {
        mockSignOutCalled = true;
        mockSupabaseUser = null;
        return { error: null };
      })
    }
  }))
}));

// Import handler after mocks
import { GET as handleCallback } from "../src/app/auth/callback/route";

describe("Auth Magic Link Callback Route", () => {
  beforeEach(() => {
    mockUserAccess = [];
    mockSupabaseUser = null;
    mockExchangeCodeResult = { error: null };
    mockVerifyOtpResult = { error: null };
    mockSignOutCalled = false;
  });

  it("1. Valid PENDING Admin magic-link callback via code redirects to /auth/set-password", async () => {
    mockUserAccess.push({
      id: "a1",
      authUserId: "supa-1",
      email: "admin@t.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid_code");
    const res = await handleCallback(req);

    expect(res.status).toBe(307); // Next.js redirect
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/set-password");
  });

  it("2. Valid PENDING Admin magic-link callback via token_hash redirects to /auth/set-password", async () => {
    mockUserAccess.push({
      id: "a1",
      authUserId: "supa-1",
      email: "admin@t.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?token_hash=valid_hash&type=email");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/set-password");
  });

  it("3. Invalid or expired callback code redirects to /login?error=invalid_callback", async () => {
    const req = new NextRequest("http://localhost:3000/auth/callback?code=invalid_code");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=invalid_callback");
  });

  it("4. Missing callback parameters redirects to /login?error=invalid_callback", async () => {
    const req = new NextRequest("http://localhost:3000/auth/callback");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=invalid_callback");
  });

  it("5. Callback with auth error parameter redirects to /login?error=authentication_failed", async () => {
    const req = new NextRequest("http://localhost:3000/auth/callback?error=access_denied");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=authentication_failed");
  });

  it("6. Supabase user without UserAccess record signs out and redirects to /login?error=account_not_found", async () => {
    // mockUserAccess is empty (no DB record)
    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid_code");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=account_not_found");
    expect(mockSignOutCalled).toBe(true);
  });

  it("7. ACTIVE account callback redirects to role home path /admin/control-center", async () => {
    mockUserAccess.push({
      id: "a1",
      authUserId: "supa-1",
      email: "admin@t.com",
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false,
      firstLoginCompleted: true
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid_code");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/admin/control-center");
  });

  it("8. SUSPENDED account callback signs out and redirects to /login?error=account_disabled", async () => {
    mockUserAccess.push({
      id: "a1",
      authUserId: "supa-1",
      email: "admin@t.com",
      role: UserRole.ADMIN,
      status: AccountStatus.SUSPENDED,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid_code");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=account_disabled");
    expect(mockSignOutCalled).toBe(true);
  });

  it("9. DISABLED account callback signs out and redirects to /login?error=account_disabled", async () => {
    mockUserAccess.push({
      id: "a1",
      authUserId: "supa-1",
      email: "admin@t.com",
      role: UserRole.ADMIN,
      status: AccountStatus.DISABLED,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid_code");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=account_disabled");
    expect(mockSignOutCalled).toBe(true);
  });

  it("10. Open redirect attempts (e.g. next=//evil.com) are sanitized to fallback path", async () => {
    mockUserAccess.push({
      id: "a1",
      authUserId: "supa-1",
      email: "admin@t.com",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
      mustSetPassword: true,
      firstLoginCompleted: false
    });

    const req1 = new NextRequest("http://localhost:3000/auth/callback?code=valid_code&next=//evil.com");
    const res1 = await handleCallback(req1);
    expect(res1.headers.get("location")).toBe("http://localhost:3000/auth/set-password");

    const req2 = new NextRequest("http://localhost:3000/auth/callback?code=valid_code&next=https://evil.com");
    const res2 = await handleCallback(req2);
    expect(res2.headers.get("location")).toBe("http://localhost:3000/auth/set-password");
  });
});
