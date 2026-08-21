import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeRollNumber, normalizeStudentLoginId } from "@/utils/normalization";
import { UserRole, AccountStatus } from "@prisma/client";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    studentProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    userAccess: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    $transaction: vi.fn((callback) => callback({
      userAccess: {
        upsert: vi.fn().mockResolvedValue({ id: "access-123" })
      }
    }))
  }
}));

vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: "supa-student-auth-1" } },
          error: null
        }),
        listUsers: vi.fn().mockResolvedValue({
          data: { users: [] },
          error: null
        })
      }
    }
  })
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "supa-student-auth-1", email: "student@example.com" } }, error: null }),
      signInWithPassword: vi.fn().mockImplementation(({ email, password }) => {
        if (password === "23AG1A0502" || password === "NewSecretPass123!") {
          return Promise.resolve({ data: { user: { id: "supa-student-auth-1", email } }, error: null });
        }
        return Promise.resolve({ data: { user: null }, error: new Error("Invalid credentials") });
      }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null })
    }
  })
}));

import { provisionStudentAccount } from "@/services/auth-provisioning.service";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

describe("Student Identity & Authentication Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("A. Roll Number Normalization", () => {
    it("normalizes internal spaces: '23 AG 1A 0502' -> '23AG1A0502'", () => {
      expect(normalizeRollNumber("23 AG 1A 0502")).toBe("23AG1A0502");
    });

    it("trims whitespace: ' 23AG1A0502 ' -> '23AG1A0502'", () => {
      expect(normalizeRollNumber(" 23AG1A0502 ")).toBe("23AG1A0502");
    });

    it("converts lowercase to uppercase: '23ag1a0502' -> '23AG1A0502'", () => {
      expect(normalizeRollNumber("23ag1a0502")).toBe("23AG1A0502");
    });

    it("returns null for empty strings", () => {
      expect(normalizeRollNumber("")).toBeNull();
      expect(normalizeRollNumber("   ")).toBeNull();
    });

    it("produces identical login IDs for equivalent variations", () => {
      const v1 = normalizeStudentLoginId("23 AG 1A 0502");
      const v2 = normalizeStudentLoginId("23AG1A0502");
      const v3 = normalizeStudentLoginId(" 23ag1a0502 ");
      expect(v1).toBe("23AG1A0502");
      expect(v1).toBe(v2);
      expect(v2).toBe(v3);
    });
  });

  describe("B. Student Account Provisioning", () => {
    it("provisions a STUDENT role account with normalized roll number as login ID and initial password", async () => {
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
        id: "student-uuid-1",
        name: "Test Student",
        rollNumber: "23 AG 1A 0502",
        department: "CSE",
        email: null,
      } as any);

      vi.mocked(prisma.userAccess.findUnique).mockResolvedValue(null);

      const result = await provisionStudentAccount("student-uuid-1");
      expect(result.status).toBe("CREATED");
    });

    it("handles optional email gracefully during provisioning", async () => {
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
        id: "student-uuid-no-email",
        name: "No Email Student",
        rollNumber: "23AG1A0509",
        department: "ECE",
        email: null
      } as any);

      vi.mocked(prisma.userAccess.findUnique).mockResolvedValue(null);

      const result = await provisionStudentAccount("student-uuid-no-email");
      expect(result.status).toBe("CREATED");
    });
  });

  describe("C. Existing Student Account Safety", () => {
    it("returns ALREADY_PROVISIONED and avoids duplicating profile or account", async () => {
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
        id: "student-uuid-existing",
        name: "Existing Student",
        rollNumber: "23AG1A0502",
        department: "CSE"
      } as any);

      vi.mocked(prisma.userAccess.findUnique).mockImplementation(({ where }: any) => {
        if (where.studentProfileId === "student-uuid-existing") {
          return Promise.resolve({
            id: "access-existing",
            authUserId: "supa-auth-existing",
            loginId: "23AG1A0502",
            role: UserRole.STUDENT,
            mustSetPassword: false, // Activated student
          } as any);
        }
        return Promise.resolve(null);
      });

      const result = await provisionStudentAccount("student-uuid-existing");
      expect(result.status).toBe("ALREADY_PROVISIONED");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("D. Role Authorization Guards", () => {
    it("prohibits STUDENT role from accessing ADMIN guards", async () => {
      vi.mocked(prisma.userAccess.findUnique).mockResolvedValue({
        id: "access-student",
        authUserId: "supa-student-auth-1",
        email: "student@example.com",
        loginId: "23AG1A0502",
        role: UserRole.STUDENT,
        status: AccountStatus.ACTIVE,
        studentProfileId: "profile-100"
      } as any);

      await expect(auth.requireAdmin()).rejects.toThrow();
    });

    it("allows STUDENT to access own student profile but blocks other profiles", async () => {
      vi.mocked(prisma.userAccess.findUnique).mockResolvedValue({
        id: "access-student",
        authUserId: "supa-student-auth-1",
        email: "student@example.com",
        loginId: "23AG1A0502",
        role: UserRole.STUDENT,
        status: AccountStatus.ACTIVE,
        studentProfileId: "profile-100"
      } as any);

      const ownAccess = await auth.requireOwnStudentProfile("profile-100");
      expect(ownAccess.studentProfileId).toBe("profile-100");

      await expect(auth.requireOwnStudentProfile("profile-999")).rejects.toThrow();
    });

    it("computes correct role home paths", () => {
      const studentAccess = { role: UserRole.STUDENT, status: AccountStatus.ACTIVE, studentProfileId: "prof-1" } as any;
      const adminAccess = { role: UserRole.ADMIN, status: AccountStatus.ACTIVE } as any;
      const gkSirAccess = { role: UserRole.GK_SIR, status: AccountStatus.ACTIVE } as any;

      expect(auth.getRoleHomePath(studentAccess)).toBe("/student/prof-1");
      expect(auth.getRoleHomePath(adminAccess)).toBe("/admin/control-center");
      expect(auth.getRoleHomePath(gkSirAccess)).toBe("/leaderboard");
    });
  });
});
