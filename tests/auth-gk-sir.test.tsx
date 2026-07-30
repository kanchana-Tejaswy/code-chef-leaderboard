import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole, AccountStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NextRequest } from "next/server";

// State for mocks
let mockUserAccessRecord: any = null;
let mockSupabaseUser: any = null;
let mockUpdateUserResult: any = { error: null };
let mockRedirectUrl: string | null = null;

// Mock modules
vi.mock("next/navigation", () => ({
  usePathname: () => "/leaderboard",
  redirect: vi.fn((url: string) => {
    mockRedirectUrl = url;
    const error: any = new Error(`NEXT_REDIRECT: ${url}`);
    error.digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw error;
  })
}));

vi.mock("@/app/providers", () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    signOut: vi.fn(),
  }),
  useTheme: () => ({
    theme: "dark",
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userAccess: {
      findUnique: vi.fn(() => mockUserAccessRecord),
      update: vi.fn(({ where, data }: any) => {
        if (mockUserAccessRecord && mockUserAccessRecord.id === where.id) {
          mockUserAccessRecord = {
            ...mockUserAccessRecord,
            ...data
          };
          return mockUserAccessRecord;
        }
        return null;
      })
    }
  }
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockSupabaseUser },
        error: mockSupabaseUser ? null : new Error("No user")
      })),
      updateUser: vi.fn(async () => mockUpdateUserResult)
    }
  }))
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn(async (code: string) => {
        return { data: { user: mockSupabaseUser }, error: null };
      }),
      verifyOtp: vi.fn(async () => {
        return { data: { user: mockSupabaseUser }, error: null };
      }),
      getUser: vi.fn(async () => ({
        data: { user: mockSupabaseUser },
        error: mockSupabaseUser ? null : new Error("No user")
      })),
      signOut: vi.fn(async () => {
        mockSupabaseUser = null;
        return { error: null };
      })
    }
  }))
}));

vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn(async () => {}),
  AuditAction: {
    ACCOUNT_ACTIVATED: "ACCOUNT_ACTIVATED"
  }
}));

import { getRoleHomePath, requireDashboardPageAccess, requireLeaderboardPageAccess, requireStaffReadPageAccess } from "../src/lib/auth";
import { POST as handleSetPassword } from "../src/app/api/auth/set-password/route";
import { Navbar } from "../src/components/shared/navbar";
import { GET as handleCallback } from "../src/app/auth/callback/route";

describe("GK Sir Workflow Authentication and Activation Tests", () => {
  beforeEach(() => {
    mockUserAccessRecord = null;
    mockSupabaseUser = null;
    mockUpdateUserResult = { error: null };
    mockRedirectUrl = null;
    vi.clearAllMocks();
  });

  it("1. getRoleHomePath returns /leaderboard for GK_SIR", () => {
    const access = {
      id: "gk-1",
      authUserId: "supa-gk",
      email: "gksir@aceec.ac.in",
      role: UserRole.GK_SIR,
      status: AccountStatus.ACTIVE,
      studentProfileId: null,
      departmentId: null,
      mustSetPassword: false,
      firstLoginCompleted: true,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      passwordSetAt: new Date(),
      loginId: "gksir"
    };
    expect(getRoleHomePath(access)).toBe("/leaderboard");
  });

  it("2. Returns 410 for unauthenticated set-password POST requests", async () => {
    const req = new Request("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "NewPassword123!", confirmPassword: "NewPassword123!" })
    });

    const res = await handleSetPassword(req);
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("Set password wizard is disabled.");
  });

  it("3. Returns 410 for authenticated non-GK_SIR set-password requests", async () => {
    mockSupabaseUser = { id: "supa-student", email: "student@aceec.ac.in" };
    mockUserAccessRecord = {
      id: "std-1",
      authUserId: "supa-student",
      email: "student@aceec.ac.in",
      role: UserRole.STUDENT,
      status: AccountStatus.PENDING,
      mustSetPassword: true
    };

    const req = new Request("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "NewPassword123!", confirmPassword: "NewPassword123!" })
    });

    const res = await handleSetPassword(req);
    expect(res.status).toBe(410);
  });

  it("4. Allows GK_SIR to set password and activates the account (redirects to /leaderboard)", async () => {
    mockSupabaseUser = { id: "supa-gk", email: "gksir@aceec.ac.in" };
    mockUserAccessRecord = {
      id: "gk-1",
      authUserId: "supa-gk",
      email: "gksir@aceec.ac.in",
      role: UserRole.GK_SIR,
      status: AccountStatus.PENDING,
      mustSetPassword: true
    };

    const req = new Request("http://localhost:3000/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "GKPass2026#GreatLeader", confirmPassword: "GKPass2026#GreatLeader" })
    });

    const res = await handleSetPassword(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.redirectTo).toBe("/leaderboard");

    // Verify UserAccess status was transitioned to ACTIVE
    expect(mockUserAccessRecord.status).toBe(AccountStatus.ACTIVE);
    expect(mockUserAccessRecord.mustSetPassword).toBe(false);
    expect(mockUserAccessRecord.firstLoginCompleted).toBe(true);
  });

  it("5. GK_SIR direct access to /dashboard layout redirects to /leaderboard", async () => {
    mockSupabaseUser = { id: "supa-gk", email: "gksir@aceec.ac.in" };
    mockUserAccessRecord = {
      id: "gk-1",
      authUserId: "supa-gk",
      email: "gksir@aceec.ac.in",
      role: UserRole.GK_SIR,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false
    };

    await expect(requireDashboardPageAccess()).rejects.toThrow("NEXT_REDIRECT: /leaderboard");
    expect(mockRedirectUrl).toBe("/leaderboard");
  });

  it("6. GK_SIR can access /leaderboard page layout", async () => {
    mockSupabaseUser = { id: "supa-gk", email: "gksir@aceec.ac.in" };
    mockUserAccessRecord = {
      id: "gk-1",
      authUserId: "supa-gk",
      email: "gksir@aceec.ac.in",
      role: UserRole.GK_SIR,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false
    };

    const access = await requireLeaderboardPageAccess();
    expect(access.role).toBe(UserRole.GK_SIR);
    expect(mockRedirectUrl).toBeNull();
  });

  it("7. GK_SIR can access Analytics, Departments, and Insights page layouts", async () => {
    mockSupabaseUser = { id: "supa-gk", email: "gksir@aceec.ac.in" };
    mockUserAccessRecord = {
      id: "gk-1",
      authUserId: "supa-gk",
      email: "gksir@aceec.ac.in",
      role: UserRole.GK_SIR,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false
    };

    const access = await requireStaffReadPageAccess();
    expect(access.role).toBe(UserRole.GK_SIR);
    expect(mockRedirectUrl).toBeNull();
  });

  it("8. ADMIN Dashboard access remains unchanged", async () => {
    mockSupabaseUser = { id: "supa-admin", email: "admin@aceec.ac.in" };
    mockUserAccessRecord = {
      id: "admin-1",
      authUserId: "supa-admin",
      email: "admin@aceec.ac.in",
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false
    };

    const access = await requireDashboardPageAccess();
    expect(access.role).toBe(UserRole.ADMIN);
    expect(mockRedirectUrl).toBeNull();
  });

  it("9. GK_SIR does not see the Dashboard navigation link in navbar", () => {
    const gkNavbar = renderToStaticMarkup(
      <Navbar userRole={UserRole.GK_SIR} studentProfileId={null} />
    );
    expect(gkNavbar).not.toContain('href="/dashboard"');
    expect(gkNavbar).not.toContain('href="/admin/control-center"');
    
    // GK_SIR should see other permitted links
    expect(gkNavbar).toContain('href="/leaderboard"');
    expect(gkNavbar).toContain('href="/analytics"');
    expect(gkNavbar).toContain('href="/departments"');
    expect(gkNavbar).toContain('href="/insights"');
  });

  it("10. ADMIN sees the Dashboard navigation link in navbar", () => {
    const adminNavbar = renderToStaticMarkup(
      <Navbar userRole={UserRole.ADMIN} studentProfileId={null} />
    );
    expect(adminNavbar).toContain('href="/dashboard"');
    expect(adminNavbar).toContain('href="/admin/control-center"');
  });

  it("11. getRoleHomePath returns /admin/control-center for ADMIN (Existing Admin account remains unchanged)", () => {
    const access = {
      id: "admin-1",
      authUserId: "supa-admin",
      email: "admin@aceec.ac.in",
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      studentProfileId: null,
      departmentId: null,
      mustSetPassword: false,
      firstLoginCompleted: true,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      passwordSetAt: new Date(),
      loginId: "admin"
    };
    expect(getRoleHomePath(access)).toBe("/admin/control-center");
  });

  it("12. Valid active GK_SIR login via callback redirects to /leaderboard", async () => {
    mockSupabaseUser = { id: "supa-gk", email: "gksir@aceec.ac.in" };
    mockUserAccessRecord = {
      id: "gk-1",
      authUserId: "supa-gk",
      email: "gksir@aceec.ac.in",
      role: UserRole.GK_SIR,
      status: AccountStatus.ACTIVE,
      mustSetPassword: false,
      firstLoginCompleted: true
    };

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid_code");
    const res = await handleCallback(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/leaderboard");
  });
});
