import { describe, it, expect, vi } from "vitest";
import {
  validateAdminPassword,
  processAdminPasswordUpdate,
} from "../scripts/set-admin-password";

describe("Admin Password Setup & Security Validation", () => {
  describe("validateAdminPassword", () => {
    it("rejects passwords shorter than 12 characters", () => {
      const res = validateAdminPassword("P@ss1");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Password must be at least 12 characters long.");
    });

    it("rejects passwords without an uppercase letter", () => {
      const res = validateAdminPassword("validp@ssword123");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Password must contain at least one uppercase letter.");
    });

    it("rejects passwords without a lowercase letter", () => {
      const res = validateAdminPassword("VALIDP@SSWORD123");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Password must contain at least one lowercase letter.");
    });

    it("rejects passwords without a number", () => {
      const res = validateAdminPassword("ValidP@sswordNoNum");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Password must contain at least one number.");
    });

    it("rejects passwords without a special character", () => {
      const res = validateAdminPassword("ValidPassword123");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Password must contain at least one special character.");
    });

    it("accepts passwords satisfying all security requirements", () => {
      const res = validateAdminPassword("ValidP@ssword2026");
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });

  describe("processAdminPasswordUpdate", () => {
    it("handles password mismatch", async () => {
      let outputBuffer = "";
      const mockOutputStream: any = {
        write: (str: string) => {
          outputBuffer += str;
        },
      };

      const result = await processAdminPasswordUpdate({
        overridePassword: "ValidP@ssword2026",
        overrideConfirmPassword: "DifferentP@ss2026",
        outputStream: mockOutputStream,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Error: Passwords do not match.");
      expect(outputBuffer).toContain("Error: Passwords do not match.");
    });

    it("handles weak password rejection", async () => {
      let outputBuffer = "";
      const mockOutputStream: any = {
        write: (str: string) => {
          outputBuffer += str;
        },
      };

      const result = await processAdminPasswordUpdate({
        overridePassword: "short",
        overrideConfirmPassword: "short",
        outputStream: mockOutputStream,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Password must be at least 12 characters long.");
      expect(outputBuffer).toContain("Error: Password must be at least 12 characters long.");
    });

    it("does not update database if Supabase password update fails", async () => {
      let outputBuffer = "";
      const mockOutputStream: any = {
        write: (str: string) => {
          outputBuffer += str;
        },
      };

      const updateDbSpy = vi.fn();
      const mockSupabase: any = {
        auth: {
          admin: {
            listUsers: vi.fn().mockResolvedValue({
              data: { users: [{ id: "admin-user-id-123", email: "admin@example.com" }] },
              error: null,
            }),
            updateUserById: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Supabase Auth service unreachable" },
            }),
          },
        },
        from: vi.fn().mockReturnValue({
          update: updateDbSpy,
        }),
      };

      const result = await processAdminPasswordUpdate({
        overridePassword: "ValidP@ssword2026",
        overrideConfirmPassword: "ValidP@ssword2026",
        overrideEmail: "admin@example.com",
        supabaseClient: mockSupabase,
        outputStream: mockOutputStream,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Supabase Auth service unreachable");
      expect(updateDbSpy).not.toHaveBeenCalled();
    });

    it("successfully updates Supabase Auth and activates UserAccess record in database", async () => {
      let outputBuffer = "";
      const mockOutputStream: any = {
        write: (str: string) => {
          outputBuffer += str;
        },
      };

      let dbUpdatePayload: any = null;
      let dbFilterEmail: string = "";

      const mockSupabase: any = {
        auth: {
          admin: {
            listUsers: vi.fn().mockResolvedValue({
              data: { users: [{ id: "admin-user-id-123", email: "admin@example.com" }] },
              error: null,
            }),
            updateUserById: vi.fn().mockResolvedValue({
              data: { user: { id: "admin-user-id-123" } },
              error: null,
            }),
          },
        },
        from: (tableName: string) => {
          expect(tableName).toBe("user_access");
          return {
            update: (payload: any) => {
              dbUpdatePayload = payload;
              return {
                ilike: (col: string, val: string) => {
                  dbFilterEmail = val;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };

      const result = await processAdminPasswordUpdate({
        overridePassword: "ValidP@ssword2026",
        overrideConfirmPassword: "ValidP@ssword2026",
        overrideEmail: "admin@example.com",
        supabaseClient: mockSupabase,
        outputStream: mockOutputStream,
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        "admin-user-id-123",
        expect.objectContaining({ password: "ValidP@ssword2026", email_confirm: true })
      );
      expect(dbUpdatePayload).not.toBeNull();
      expect(dbUpdatePayload.status).toBe("ACTIVE");
      expect(dbUpdatePayload.must_set_password).toBe(false);
      expect(dbUpdatePayload.first_login_completed).toBe(true);
      expect(dbFilterEmail).toBe("admin@example.com");
      expect(outputBuffer).not.toContain("ValidP@ssword2026"); // Ensure password is never printed
    });
  });
});
