import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock Supabase and Prisma
const { mockAdminAuth, mockPrisma, mockAdminAccess, mockAuthUser } = vi.hoisted(() => {
  const mockAdminAuth = {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    listUsers: vi.fn(),
    generateLink: vi.fn(),
  };

  const mockPrisma = {
    userAccess: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const mockAuthUser = { id: "admin-auth-id", email: "admin@aceec.ac.in" };
  const mockAdminAccess = {
    id: "admin-access-id",
    authUserId: "admin-auth-id",
    email: "admin@aceec.ac.in",
    loginId: "admin@aceec.ac.in",
    role: "ADMIN",
    status: "ACTIVE",
    departmentId: null,
    studentProfileId: null,
  };

  return { mockAdminAuth, mockPrisma, mockAdminAccess, mockAuthUser };
});

vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: mockAdminAuth,
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => mockAuthUser),
  getAuthenticatedUserAccess: vi.fn(async () => mockAdminAccess),
  requireAdmin: vi.fn(async () => mockAdminAccess),
  requireAdminPageAccess: vi.fn(async () => mockAdminAccess),
  requireActivePageUser: vi.fn(async () => mockAdminAccess),
  requireRole: vi.fn(async (...roles: any[]) => {
    if (!roles.includes(mockAdminAccess.role)) {
      throw new Error("Forbidden");
    }
    return mockAdminAccess;
  }),
  AuthError: class AuthError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

import { UserRole, AccountStatus } from "@prisma/client";
import { POST as handleProvision } from "../src/app/api/admin/accounts/provision/route";
import { CreateAccountTab } from "../src/app/admin/control-center/AdminControlCenterClient";

describe("Create Account Form & Provisioning Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuth.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockAdminAuth.generateLink.mockResolvedValue({ data: { properties: {} }, error: null });
  });

  describe("Frontend Component Rendering Safety", () => {
    it("1. Form opens with all fields empty, and never prefilled with active Admin credentials", () => {
      const html = renderToStaticMarkup(
        <CreateAccountTab onAccountCreated={vi.fn()} />
      );

      // Verify no credentials of logged-in admin are prefilled
      expect(html).not.toContain('value="admin@aceec.ac.in"');
      expect(html).not.toContain('value="admin-access-id"');
      expect(html).not.toContain('value="admin-auth-id"');

      // Verify structure checks (inputs have empty values initially or no values)
      // Name and Email Inputs must have unique safe field names and autocompletes
      expect(html).toContain('name="newAccountFullName"');
      expect(html).toContain('name="newAccountEmail"');
      expect(html).toContain('name="newAccountPassword"');
      expect(html).toContain('name="newAccountConfirmPassword"');
    });

    it("2. Autocomplete attributes are configured with new-account-safe and off values", () => {
      const html = renderToStaticMarkup(
        <CreateAccountTab onAccountCreated={vi.fn()} />
      );

      const htmlLower = html.toLowerCase();
      expect(htmlLower).toContain('autocomplete="off"');
      expect(htmlLower).toContain('autocomplete="new-account-email"');
      expect(htmlLower).toContain('autocomplete="new-password"');
    });
  });

  describe("Backend Account Provisioning API", () => {
    it("3. Empty password fields for staff (HOD/ADMIN/GK_SIR) trigger activation-email recovery flow", async () => {
      mockAdminAuth.createUser.mockResolvedValue({
        data: { user: { id: "new-staff-auth-id" } },
        error: null,
      });
      mockPrisma.userAccess.create.mockResolvedValue({
        id: "new-staff-access-id",
        role: UserRole.HOD,
        status: AccountStatus.PENDING,
      });

      const payload = {
        newAccountFullName: "HOD Test User",
        newAccountEmail: "hod.test@aceec.ac.in",
        role: UserRole.HOD,
        departmentId: "CSE",
        newAccountPassword: "",
        newAccountConfirmPassword: "",
        status: AccountStatus.ACTIVE,
      };

      const req = new Request("http://localhost:3000/api/admin/accounts/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await handleProvision(req as any);
      const data = await res.json();
      if (res.status !== 201) {
        console.error("PROVISION API ERROR:", data);
      }
      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toContain("Secure activation link has been sent");

      // Verify that recovery flow was triggered
      expect(mockAdminAuth.generateLink).toHaveBeenCalledWith({
        type: "recovery",
        email: "hod.test@aceec.ac.in",
      });

      // Verify that database status was PENDING, and passwordSetAt null
      const prismaCreateCall = mockPrisma.userAccess.create.mock.calls[0][0].data;
      expect(prismaCreateCall.status).toBe(AccountStatus.PENDING);
      expect(prismaCreateCall.mustSetPassword).toBe(true);
      expect(prismaCreateCall.firstLoginCompleted).toBe(false);
      expect(prismaCreateCall.passwordSetAt).toBeNull();
    });

    it("4. Password and confirmation must match when supplied", async () => {
      const payload = {
        newAccountFullName: "Staff Match Test",
        newAccountEmail: "match.test@aceec.ac.in",
        role: UserRole.HOD,
        departmentId: "CSE",
        newAccountPassword: "Password123!",
        newAccountConfirmPassword: "DifferentPassword123!",
        status: AccountStatus.ACTIVE,
      };

      const req = new Request("http://localhost:3000/api/admin/accounts/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await handleProvision(req as any);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Passwords do not match.");
    });

    it("5. Duplicate email handles conflict and returns the exact required message", async () => {
      // Mock that email already exists in UserAccess
      mockPrisma.userAccess.findFirst.mockResolvedValue({
        id: "existing-access-id",
        email: "duplicate@aceec.ac.in",
      });

      const payload = {
        newAccountFullName: "Duplicate Test",
        newAccountEmail: "duplicate@aceec.ac.in",
        role: UserRole.GK_SIR,
        newAccountPassword: "",
        newAccountConfirmPassword: "",
        status: AccountStatus.ACTIVE,
      };

      const req = new Request("http://localhost:3000/api/admin/accounts/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await handleProvision(req as any);
      expect(res.status).toBe(409);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("An account already exists with this email address.");
      
      // Ensure we didn't try to create a Supabase user or modify anything
      expect(mockAdminAuth.createUser).not.toHaveBeenCalled();
    });
  });
});
