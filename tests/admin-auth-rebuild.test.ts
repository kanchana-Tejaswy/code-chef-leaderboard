import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mocks for dependencies
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userAccess: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/services/audit.service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(true),
  AuditAction: {
    PASSWORD_LOGIN_SUCCESS: "PASSWORD_LOGIN_SUCCESS",
    PASSWORD_LOGIN_FAILED: "PASSWORD_LOGIN_FAILED",
    PASSWORD_LOGIN_RATE_LIMITED: "PASSWORD_LOGIN_RATE_LIMITED",
    ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
    SESSION_LOGOUT: "SESSION_LOGOUT",
  },
}));

vi.mock("@/services/auth-rate-limit.service", () => ({
  checkPasswordLoginRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  hashIdentifier: vi.fn().mockReturnValue("hashed_identifier"),
}));

import { POST as loginPostHandler } from "@/app/api/auth/login/password/route";
import { POST as logoutPostHandler } from "@/app/api/auth/logout/route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";

describe("Admin Authentication Rebuild Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1 & 2: Component files & No blue colors check
  it("1 & 2. Admin login components render without any blue color classes or hex codes", () => {
    const loginFormPath = path.resolve(process.cwd(), "src/app/login/LoginForm.tsx");
    const loginPagePath = path.resolve(process.cwd(), "src/app/login/page.tsx");

    expect(fs.existsSync(loginFormPath)).toBe(true);
    expect(fs.existsSync(loginPagePath)).toBe(true);

    const formContent = fs.readFileSync(loginFormPath, "utf-8");
    const pageContent = fs.readFileSync(loginPagePath, "utf-8");

    const bluePattern = /\b(text-blue-\d+|bg-blue-\d+|border-blue-\d+|ring-blue-\d+|from-blue-\d+|to-blue-\d+|via-blue-\d+|#3b82f6|#2563eb|#1d4ed8|#1e40af|#60a5fa|#93c5fd)\b/i;

    expect(formContent).not.toMatch(bluePattern);
    expect(pageContent).not.toMatch(bluePattern);
  });

  // 3. Valid Admin email and password
  it("3. Authenticates valid active Admin email and password successfully", async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-auth-id", email: "admin@college.edu" } },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (prisma.userAccess.findFirst as any).mockResolvedValue({
      id: "admin-db-id",
      authUserId: "admin-auth-id",
      email: "admin@college.edu",
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
    });

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@college.edu", password: "SecureAdminPassword123!" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.redirectTo).toBe("/admin/control-center");
  });

  // 4. Invalid password
  it("4. Rejects invalid password with generic invalid credentials message", async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid login credentials" },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@college.edu", password: "WrongPassword" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("Invalid email or password.");
  });

  // 5. Unknown email
  it("5. Rejects unknown email with generic message without revealing existence", async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid login credentials" },
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown@college.edu", password: "AnyPassword123!" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("Invalid email or password.");
  });

  // 6. Non-Admin user rejected
  it("6. Rejects authenticated non-Admin user and immediately signs user out", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({});
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "student-auth-id", email: "student@college.edu" } },
          error: null,
        }),
        signOut: mockSignOut,
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (prisma.userAccess.findFirst as any).mockResolvedValue({
      id: "student-db-id",
      authUserId: "student-auth-id",
      email: "student@college.edu",
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
    });

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@college.edu", password: "StudentPassword123!" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("This portal is available to authorised administrators and institutional staff.");
    expect(mockSignOut).toHaveBeenCalled();
  });

  // 7. PENDING Admin rejected
  it("7. Rejects PENDING Admin account and signs out", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({});
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "pending-admin-id", email: "pendingadmin@college.edu" } },
          error: null,
        }),
        signOut: mockSignOut,
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (prisma.userAccess.findFirst as any).mockResolvedValue({
      id: "pending-admin-db-id",
      authUserId: "pending-admin-id",
      email: "pendingadmin@college.edu",
      role: UserRole.ADMIN,
      status: AccountStatus.PENDING,
    });

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pendingadmin@college.edu", password: "PendingPassword123!" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toContain("activation pending");
    expect(mockSignOut).toHaveBeenCalled();
  });

  // 8. SUSPENDED Admin rejected
  it("8. Rejects SUSPENDED Admin account with safe access-denied message", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({});
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "suspended-admin-id", email: "suspended@college.edu" } },
          error: null,
        }),
        signOut: mockSignOut,
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (prisma.userAccess.findFirst as any).mockResolvedValue({
      id: "suspended-admin-db-id",
      authUserId: "suspended-admin-id",
      email: "suspended@college.edu",
      role: UserRole.ADMIN,
      status: AccountStatus.SUSPENDED,
    });

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "suspended@college.edu", password: "Password123!" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("This account has been suspended or disabled.");
    expect(mockSignOut).toHaveBeenCalled();
  });

  // 9. DISABLED Admin rejected
  it("9. Rejects DISABLED Admin account with safe access-denied message", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({});
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "disabled-admin-id", email: "disabled@college.edu" } },
          error: null,
        }),
        signOut: mockSignOut,
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (prisma.userAccess.findFirst as any).mockResolvedValue({
      id: "disabled-admin-db-id",
      authUserId: "disabled-admin-id",
      email: "disabled@college.edu",
      role: UserRole.ADMIN,
      status: AccountStatus.DISABLED,
    });

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "disabled@college.edu", password: "Password123!" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("This account has been suspended or disabled.");
    expect(mockSignOut).toHaveBeenCalled();
  });

  // 10. Missing access record rejected
  it("10. Rejects user with missing UserAccess record", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({});
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "no-db-user-id", email: "nodb@college.edu" } },
          error: null,
        }),
        signOut: mockSignOut,
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (prisma.userAccess.findFirst as any).mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/login/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nodb@college.edu", password: "Password123!" }),
    });

    const res = await loginPostHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe("This portal is available to authorised administrators and institutional staff.");
    expect(mockSignOut).toHaveBeenCalled();
  });

  // 13. Logout
  it("13. Calls Supabase signOut and clears session on logout", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-id" } } }),
        signOut: mockSignOut,
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new Request("http://localhost/api/auth/logout", { method: "POST" });
    const res = await logoutPostHandler(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockSignOut).toHaveBeenCalled();
  });

  // 16 & 17. Light and dark theme contrast classes
  it("16 & 17. Includes exact light and dark theme contrast design system classes", () => {
    const formContent = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/login/LoginForm.tsx"),
      "utf-8"
    );

    expect(formContent).toContain("bg-[#FAFAFA]");
    expect(formContent).toContain("dark:bg-[#0A0A0A]");
    expect(formContent).toContain("bg-[#FFFFFF]");
    expect(formContent).toContain("dark:bg-[#111111]");
    expect(formContent).toContain("text-[#0F172A]");
    expect(formContent).toContain("dark:text-[#FAFAFA]");
    expect(formContent).toContain("bg-[#EAB308]");
  });
});
